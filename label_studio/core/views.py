"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license."""

import io
import json
import logging
import mimetypes
import os
import csv
import shutil
from pathlib import Path
from wsgiref.util import FileWrapper

import pandas as pd
import yaml
from core import utils
from core.feature_flags import all_flags, flag_set, get_feature_file_path
from core.label_config import generate_time_series_json
from core.utils.common import collect_versions
from core.utils.io import find_file
from django.conf import settings
from django.contrib.auth import logout
from django.contrib.auth.decorators import login_required
from django.http import FileResponse, HttpResponse, HttpResponseForbidden, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render, reverse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from drf_spectacular.utils import extend_schema
from projects.models import Project
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

MODEL_REGISTRY_ROOT = Path(os.getenv('MODEL_REGISTRY', '/models/projects'))
EVAL_ROOT = Path(os.getenv('EVAL_ROOT', '/eval'))
EVAL_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tif', '.tiff'}
EVAL_LABEL_EXTENSION = '.txt'


_PARAGRAPH_SAMPLE = None


def main(request):
    user = request.user

    if user.is_authenticated:
        if user.active_organization is None and 'organization_pk' not in request.session:
            logout(request)
            return redirect(reverse('user-login'))

        # business mode access
        if flag_set('fflag_all_feat_dia_1777_ls_homepage_short', user):
            return render(request, 'home/home.html')
        else:
            return redirect(reverse('projects:project-index'))

    # not authenticated
    return redirect(reverse('user-login'))


@login_required
def documentation_page(request):
    """Serve the SPA shell for the in-app documentation route."""
    return render(request, 'base.html')


def _read_json(path, default=None):
    if not path.exists():
        return default
    try:
        with path.open() as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        logger.exception('Failed to read JSON dashboard file: %s', path)
        return default


def _version_project_id(version):
    """Parse the project ID from a version name (yolo-p<ID>-<timestamp>)."""
    try:
        return int(version.split('-')[1].lstrip('p'))
    except (AttributeError, IndexError, ValueError):
        return None


def _project_registry(project_id):
    if project_id is None:
        return None
    return MODEL_REGISTRY_ROOT / f'p{project_id}' / 'registry'


def _project_version_project(request, version):
    """Resolve the project owning a model version, enforcing organization access."""
    project_id = _version_project_id(version)
    if project_id is None:
        return None
    return Project.objects.filter(pk=project_id, organization=request.user.active_organization).first()


def _can_download_models(user):
    """Only instance administrators may download trained model weights."""
    return bool(getattr(user, 'is_authenticated', False) and getattr(user, 'is_superuser', False))


def _model_registry_index(project, can_download_models=False):
    registry = _project_registry(project.id)
    index = {}
    versions_by_name = {}

    if registry:
        stored_index = _read_json(registry / 'index.json', {}) or {}
        for key in ('current_version', 'promotion_metric', 'promotion_min_delta', 'updated_at', 'active_model'):
            index[key] = stored_index.get(key)
        for item in stored_index.get('versions') or []:
            if item.get('version'):
                versions_by_name[item['version']] = dict(item)

        if registry.exists():
            for version_dir in registry.iterdir():
                if not version_dir.is_dir():
                    continue
                version = version_dir.name
                status = _read_json(version_dir / 'status.json', {}) or {}
                metrics = _read_json(version_dir / 'metrics.json', {}) or {}
                comparison = _read_json(version_dir / 'comparison.json', {}) or {}
                versions_by_name[version] = {
                    **versions_by_name.get(version, {}),
                    'version': version,
                    'status': status.get('status') or versions_by_name.get(version, {}).get('status'),
                    'promoted': status.get('promoted', versions_by_name.get(version, {}).get('promoted', False)),
                    'updated_at': status.get('updated_at') or status.get('created_at') or versions_by_name.get(version, {}).get('updated_at'),
                    'fitness': metrics.get('fitness'),
                    'map50': metrics.get('map50'),
                    'map50_95': metrics.get('map50_95'),
                    'precision': metrics.get('precision'),
                    'recall': metrics.get('recall'),
                    'decision': comparison.get('decision'),
                    'reason': comparison.get('reason'),
                }

    current_best = registry.parent / 'current' / 'best.pt' if registry else None
    index['active_metadata'] = (
        _read_json(registry.parent / 'current' / 'version.json', {}) or {}
        if current_best and current_best.exists() else {}
    )
    index['active_metrics'] = (
        _read_json(registry.parent / 'current' / 'metrics.json', {}) or {}
        if current_best and current_best.exists() else {}
    )

    versions = list(versions_by_name.values())
    enriched_versions = []
    for item in versions:
        item = dict(item)
        item['project_id'] = item.get('project_id') or _version_project_id(item.get('version'))
        root = _version_dir(item.get('version'))
        if root:
            item['progress'] = _model_training_progress(root)
        item['download_url'] = f'/api/custom-dashboard/models/{item.get("version")}/download'
        item['has_model_file'] = bool(root and (root / 'best.pt').is_file())
        enriched_versions.append(item)
    index['versions'] = sorted(
        enriched_versions,
        key=lambda item: item.get('updated_at') or item.get('version') or '',
        reverse=True,
    )
    index['active_download_url'] = f'/api/custom-dashboard/models/current/download?project={project.id}'
    index['can_download_models'] = can_download_models
    return index


def _version_dir(version):
    project_id = _version_project_id(version)
    registry = _project_registry(project_id)
    if registry is None:
        return None
    path = (registry / version).resolve()
    root = registry.resolve()
    if root not in path.parents and path != root:
        return None
    if not path.is_dir():
        return None
    return path


def _model_version_detail(version, can_download_models=False):
    root = _version_dir(version)
    if not root:
        return None
    return {
        'version': version,
        'metrics': _read_json(root / 'metrics.json', {}) or {},
        'comparison': _read_json(root / 'comparison.json', {}) or {},
        'status': _read_json(root / 'status.json', {}) or {},
        'training_config': _read_json(root / 'training_config.json', {}) or {},
        'results': _read_results_csv(root / 'training' / 'results.csv'),
        'artifacts': _collect_model_artifacts(root),
        'progress': _model_training_progress(root),
        'download_url': f'/api/custom-dashboard/models/{version}/download',
        'has_model_file': (root / 'best.pt').exists(),
        'can_download_models': can_download_models,
    }


def _model_training_progress(root):
    status = _read_json(root / 'status.json', {}) or {}
    training_config = _read_json(root / 'training_config.json', {}) or {}
    results = _read_results_csv(root / 'training' / 'results.csv')
    total_epochs = training_config.get('epochs')
    current_epoch = len(results)

    progress_percent = status.get('progress_percent')
    if progress_percent is None and total_epochs:
        progress_percent = min(100, round((current_epoch / max(1, total_epochs)) * 100))
    if progress_percent is None:
        progress_percent = 0 if status.get('status') == 'training' else None

    latest = results[-1] if results else {}
    return {
        'status': status.get('status'),
        'phase': status.get('phase') or ('training' if status.get('status') == 'training' else None),
        'message': status.get('message'),
        'current_epoch': status.get('current_epoch') or current_epoch,
        'total_epochs': status.get('total_epochs') or total_epochs,
        'progress_percent': progress_percent,
        'latest': latest,
    }


def _read_results_csv(path):
    if not path.exists():
        return []
    try:
        with path.open(newline='') as f:
            return [{key.strip().replace('/', '_'): value for key, value in row.items()} for row in csv.DictReader(f)]
    except OSError:
        logger.exception('Failed to read model training CSV: %s', path)
        return []


def _collect_model_artifacts(root):
    artifact_names = [
        'training/results.png',
        'training/confusion_matrix.png',
        'training/confusion_matrix_normalized.png',
        'training/PR_curve.png',
        'training/F1_curve.png',
        'training/P_curve.png',
        'training/R_curve.png',
        'evaluation_new/confusion_matrix.png',
        'evaluation_new/confusion_matrix_normalized.png',
        'evaluation_current/confusion_matrix.png',
        'evaluation_current/confusion_matrix_normalized.png',
    ]
    artifacts = []
    for name in artifact_names:
        path = root / name
        if path.exists():
            artifacts.append(
                {
                    'name': name,
                    'url': f'/api/custom-dashboard/models/{root.name}/artifacts/{name}',
                }
            )
    return artifacts


@login_required
def dashboard_model_api(request, version=None):
    can_download = _can_download_models(request.user)
    if version:
        project = _project_version_project(request, version)
        if project is None:
            return JsonResponse({'detail': 'Version not found'}, status=404)
        detail = _model_version_detail(version, can_download_models=can_download)
        if detail is None:
            return JsonResponse({'detail': 'Version not found'}, status=404)
        return JsonResponse(detail)

    project_id = request.GET.get('project')
    if not project_id:
        return JsonResponse({'detail': 'A project query parameter is required'}, status=400)
    project = get_object_or_404(Project, pk=project_id, organization=request.user.active_organization)
    return JsonResponse(_model_registry_index(project, can_download_models=can_download))


@login_required
def dashboard_model_artifact(request, version, artifact_path):
    if _project_version_project(request, version) is None:
        return JsonResponse({'detail': 'Version not found'}, status=404)
    root = _version_dir(version)
    if not root:
        return JsonResponse({'detail': 'Version not found'}, status=404)

    path = (root / artifact_path).resolve()
    if root.resolve() not in path.parents or not path.exists() or not path.is_file():
        return JsonResponse({'detail': 'Artifact not found'}, status=404)

    content_type = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
    return FileResponse(path.open('rb'), content_type=content_type)


def _download_model_file(path, filename):
    """Send a model weights file as a download attachment."""
    response = FileResponse(path.open('rb'), content_type='application/octet-stream')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    response['Content-Length'] = path.stat().st_size
    return response


@login_required
def dashboard_model_download(request, version):
    """Download the trained model weights for a version or the currently active model."""
    if not _can_download_models(request.user):
        return JsonResponse({'detail': 'Only administrators can download trained models'}, status=403)

    if version == 'current':
        project_id = request.GET.get('project')
        if not project_id:
            return JsonResponse({'detail': 'A project query parameter is required'}, status=400)
        project = get_object_or_404(Project, pk=project_id, organization=request.user.active_organization)
        registry = _project_registry(project.id)
        if registry is None:
            return JsonResponse({'detail': 'Model not found'}, status=404)
        path = registry.parent / 'current' / 'best.pt'
        if not path.exists() or not path.is_file():
            return JsonResponse({'detail': 'Model not found'}, status=404)
        return _download_model_file(path, f'{project.id}-best.pt')

    project = _project_version_project(request, version)
    if project is None:
        return JsonResponse({'detail': 'Version not found'}, status=404)
    root = _version_dir(version)
    if not root:
        return JsonResponse({'detail': 'Version not found'}, status=404)

    path = root / 'best.pt'
    if not path.exists() or not path.is_file():
        return JsonResponse({'detail': 'Model not found'}, status=404)

    return _download_model_file(path, f'{version}-best.pt')


def _project_eval_config(project_id):
    """Resolve the private evaluation dataset directories for a project."""
    config_path = EVAL_ROOT / f'p{project_id}' / 'dataset.yaml'
    if not config_path.is_file():
        return None
    try:
        config = yaml.safe_load(config_path.read_text()) or {}
    except (OSError, yaml.YAMLError):
        logger.exception('Failed to read private evaluation config: %s', config_path)
        return None

    val = config.get('val')
    if not val:
        return None

    root = Path(str(config.get('path') or config_path.parent))
    images_dir = Path(str(val))
    if not images_dir.is_absolute():
        images_dir = root / images_dir
    images_dir = images_dir.resolve()
    if not images_dir.is_dir():
        return None

    return {
        'config': config_path,
        'images_dir': images_dir,
        'labels_dir': images_dir.parent / 'labels',
        'class_names': config.get('names') or {},
    }


def _safe_eval_member(directory, name, allowed_extensions=None):
    """Resolve a file inside a directory, rejecting path traversal and unwanted extensions."""
    if not name:
        return None
    name = Path(str(name)).name
    if not name:
        return None
    candidate = (directory / name).resolve()
    try:
        candidate.relative_to(directory.resolve())
    except ValueError:
        return None
    if allowed_extensions is not None and candidate.suffix.lower() not in allowed_extensions:
        return None
    return candidate


def _invalidate_eval_cache(config):
    """Drop Ultralytics' label scan cache so the next evaluation sees new files."""
    cache = config['images_dir'].parent / 'labels.cache'
    try:
        if cache.is_file():
            cache.unlink()
    except OSError:
        logger.warning('Could not remove stale evaluation label cache: %s', cache)


def _eval_dataset_payload(project, config):
    images_dir = config['images_dir']
    labels_dir = config['labels_dir']
    images = []
    for path in sorted(images_dir.iterdir()):
        if not path.is_file() or path.suffix.lower() not in EVAL_IMAGE_EXTENSIONS:
            continue
        label_path = labels_dir / f'{path.stem}{EVAL_LABEL_EXTENSION}'
        images.append(
            {
                'name': path.name,
                'size': path.stat().st_size,
                'has_label': label_path.is_file(),
            }
        )
    return {
        'available': True,
        'project': project.id,
        'images_dir': str(images_dir),
        'labels_dir': str(labels_dir),
        'class_names': config['class_names'],
        'count': len(images),
        'images': images,
    }


@login_required
@require_http_methods(['GET', 'POST'])
def dashboard_eval_dataset(request, project_id):
    """List or upload images for a project's private evaluation dataset."""
    project = get_object_or_404(Project, pk=project_id, organization=request.user.active_organization)
    config = _project_eval_config(project.id)
    if config is None:
        return JsonResponse(
            {'available': False, 'detail': 'No private evaluation dataset is configured for this project'},
            status=404,
        )

    if request.method == 'POST':
        files = request.FILES.getlist('files') or request.FILES.getlist('file')
        if not files:
            return JsonResponse({'detail': 'No files were uploaded'}, status=400)

        saved = []
        skipped = []
        for uploaded in files:
            suffix = Path(uploaded.name).suffix.lower()
            if suffix in EVAL_IMAGE_EXTENSIONS:
                target_dir = config['images_dir']
            elif suffix == EVAL_LABEL_EXTENSION:
                target_dir = config['labels_dir']
            else:
                skipped.append(uploaded.name)
                continue

            target = _safe_eval_member(target_dir, uploaded.name, {suffix})
            if target is None:
                skipped.append(uploaded.name)
                continue

            target_dir.mkdir(parents=True, exist_ok=True)
            with target.open('wb') as destination:
                for chunk in uploaded.chunks():
                    destination.write(chunk)
            saved.append(target.name)

        if saved:
            _invalidate_eval_cache(config)

        return JsonResponse(
            {
                'saved': saved,
                'skipped': skipped,
                'dataset': _eval_dataset_payload(project, config),
            }
        )

    return JsonResponse(_eval_dataset_payload(project, config))


@login_required
@require_http_methods(['GET', 'DELETE'])
def dashboard_eval_dataset_file(request, project_id, filename):
    """Serve or delete a single image from a project's private evaluation dataset."""
    project = get_object_or_404(Project, pk=project_id, organization=request.user.active_organization)
    config = _project_eval_config(project.id)
    if config is None:
        return JsonResponse({'detail': 'Private evaluation dataset not found'}, status=404)

    target = _safe_eval_member(config['images_dir'], filename, EVAL_IMAGE_EXTENSIONS)
    if target is None or not target.is_file():
        return JsonResponse({'detail': 'Image not found'}, status=404)

    if request.method == 'DELETE':
        target.unlink()
        label_path = _safe_eval_member(
            config['labels_dir'], f'{target.stem}{EVAL_LABEL_EXTENSION}', {EVAL_LABEL_EXTENSION}
        )
        if label_path is not None and label_path.is_file():
            label_path.unlink()
        _invalidate_eval_cache(config)
        return JsonResponse({'deleted': target.name, 'dataset': _eval_dataset_payload(project, config)})

    content_type = mimetypes.guess_type(target.name)[0] or 'application/octet-stream'
    return FileResponse(target.open('rb'), content_type=content_type)


@login_required
@require_http_methods(['POST', 'DELETE'])
def dashboard_model_delete(request, version):
    if _project_version_project(request, version) is None:
        return JsonResponse({'detail': 'Version not found'}, status=404)
    root = _version_dir(version)
    if not root:
        return JsonResponse({'detail': 'Version not found'}, status=404)

    try:
        body = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'detail': 'Invalid request body'}, status=400)
    if body.get('confirmation') != 'DELETE':
        return JsonResponse({'detail': 'Confirmation must be "DELETE"'}, status=400)

    status = _read_json(root / 'status.json', {}) or {}
    if status.get('status') == 'training':
        return JsonResponse({'detail': 'Cannot delete a version while it is training'}, status=409)

    shutil.rmtree(root)
    return JsonResponse({'status': 'deleted', 'version': version})


@login_required
@require_http_methods(['POST'])
def dashboard_model_re_evaluate(request, version):
    """Re-score one model version, or the active/baseline model, on the private eval dataset."""
    if version == 'current':
        project_id = request.GET.get('project')
        if not project_id:
            return JsonResponse({'detail': 'A project query parameter is required'}, status=400)
        project = get_object_or_404(Project, pk=project_id, organization=request.user.active_organization)
    else:
        project = _project_version_project(request, version)
        if project is None:
            return JsonResponse({'detail': 'Version not found'}, status=404)
        if _version_dir(version) is None:
            return JsonResponse({'detail': 'Version not found'}, status=404)

    ml_backend = project.ml_backend
    if ml_backend is None:
        return JsonResponse({'detail': 'No ML backend is configured for this project'}, status=400)

    result = ml_backend.api.re_evaluate(project, version=version)
    if result.is_error:
        return JsonResponse({'detail': result.error_message or 'Re-evaluation failed'}, status=400)

    return JsonResponse(result.response, status=200)


def version_page(request):
    """Get platform version"""
    # update the latest version from pypi response
    # from label_studio.core.utils.common import check_for_the_latest_version
    # check_for_the_latest_version(print_message=False)
    http_page = request.path == '/version/'
    result = collect_versions(force=http_page)

    # html / json response
    if request.path == '/version/':
        # other settings from backend
        if not getattr(settings, 'CLOUD_INSTANCE', False) and request.user.is_superuser:
            result['settings'] = {
                key: str(getattr(settings, key))
                for key in dir(settings)
                if not key.startswith('_') and not hasattr(getattr(settings, key), '__call__')
            }

        result = json.dumps(result, indent=2, ensure_ascii=False)
        return HttpResponse('<pre>' + result + '</pre>')
    else:
        return JsonResponse(result)


def health(request):
    """System health info"""
    logger.debug('Got /health request.')
    return HttpResponse(json.dumps({'status': 'UP'}))


def metrics(request):
    """Empty page for metrics evaluation"""
    return HttpResponse('')


class TriggerAPIError(APIView):
    """500 response for testing"""

    authentication_classes = ()
    permission_classes = ()

    @extend_schema(exclude=True)
    def get(self, request):
        raise Exception('test')


def editor_files(request):
    """Get last editor files"""
    response = utils.common.find_editor_files()
    return HttpResponse(json.dumps(response), status=200)


def samples_time_series(request):
    """Generate time series example for preview"""
    time_column = request.GET.get('time', '')
    value_columns = request.GET.get('values', '').split(',')
    time_format = request.GET.get('tf')

    # separator processing
    separator = request.GET.get('sep', ',')
    separator = separator.replace('\\t', '\t')
    aliases = {'dot': '.', 'comma': ',', 'tab': '\t', 'space': ' '}
    if separator in aliases:
        separator = aliases[separator]

    # check headless or not
    header = True
    if all(n.isdigit() for n in [time_column] + value_columns):
        header = False

    # generate all columns for headless csv
    if not header:
        max_column_n = max([int(v) for v in value_columns] + [0])
        value_columns = range(1, max_column_n + 1)

    ts = generate_time_series_json(time_column, value_columns, time_format)
    csv_data = pd.DataFrame.from_dict(ts).to_csv(index=False, header=header, sep=separator).encode('utf-8')

    # generate response data as file
    filename = 'time-series.csv'
    response = HttpResponse(csv_data, content_type='application/csv')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    response['filename'] = filename
    return response


def samples_paragraphs(request):
    """Generate paragraphs example for preview"""
    global _PARAGRAPH_SAMPLE

    if _PARAGRAPH_SAMPLE is None:
        with open(find_file('paragraphs.json'), encoding='utf-8') as f:
            _PARAGRAPH_SAMPLE = json.load(f)
    name_key = request.GET.get('nameKey', 'author')
    text_key = request.GET.get('textKey', 'text')

    result = []
    for line in _PARAGRAPH_SAMPLE:
        result.append({name_key: line['author'], text_key: line['text']})

    return HttpResponse(json.dumps(result), content_type='application/json')


def heidi_tips(request):
    """Serve tips from the local bundle only.

    Upstream live tips used to be proxied from the public Label Studio repository,
    which reintroduced third-party branding and external links. The frontend falls
    back to its bundled, rebranded tips when this returns 404.
    """
    return HttpResponse(json.dumps({'detail': 'Live tips are disabled'}), content_type='application/json', status=404)


def static_file_with_host_resolver(path_on_disk, content_type):
    """Load any file, replace {{HOSTNAME}} => settings.HOSTNAME, send it as http response"""
    path_on_disk = os.path.join(settings.STATIC_ROOT, path_on_disk)

    def serve_file(request):
        with open(path_on_disk, 'r') as f:
            body = f.read()
            body = body.replace('{{HOSTNAME}}', settings.HOSTNAME)

            out = io.StringIO()
            out.write(body)
            out.seek(0)

            wrapper = FileWrapper(out)
            response = HttpResponse(wrapper, content_type=content_type)
            response['Content-Length'] = len(body)
            return response

    return serve_file


def feature_flags(request):
    user = request.user
    if not user.is_authenticated:
        return HttpResponseForbidden()

    flags = all_flags(request.user)
    flags['$system'] = {
        'FEATURE_FLAGS_DEFAULT_VALUE': settings.FEATURE_FLAGS_DEFAULT_VALUE,
        'FEATURE_FLAGS_FROM_FILE': settings.FEATURE_FLAGS_FROM_FILE,
        'FEATURE_FLAGS_FILE': get_feature_file_path(),
        'VERSION_EDITION': settings.VERSION_EDITION,
        'CLOUD_INSTANCE': settings.CLOUD_INSTANCE if hasattr(settings, 'CLOUD_INSTANCE') else None,
    }

    return HttpResponse('<pre>' + json.dumps(flags, indent=4) + '</pre>', status=200)


@csrf_exempt
@require_http_methods(['POST', 'GET'])
def collect_metrics(request):
    """Lightweight endpoint to collect usage metrics from the frontend only when COLLECT_ANALYTICS is enabled"""
    return HttpResponse(status=204)
