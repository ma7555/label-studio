import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, buttonVariant, SimpleCard, Spinner, Typography } from "@humansignal/ui";
import { IconFileDownload } from "@humansignal/icons";
import { useUpdatePageTitle } from "@humansignal/core";
import { useProject } from "../../providers/ProjectProvider";
import { useAPI } from "../../providers/ApiProvider";
import { Space } from "../../components/Space/Space";
import { TrainingHyperparameters } from "./TrainingHyperparameters";
import { EvaluationDataset } from "./EvaluationDataset";
import { ModelsTab } from "./ModelsTab";

const DASHBOARD_TABS = [
  { id: "overview", label: "Overview" },
  { id: "models", label: "Models" },
  { id: "evaluation", label: "Evaluation Dataset" },
];

export const ProjectDashboardPage = () => {
  const { project } = useProject();
  const api = useAPI();
  const [registry, setRegistry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("overview");

  useUpdatePageTitle(project?.title ? `${project.title} Dashboard` : "Project Dashboard");

  const loadRegistry = useCallback(async ({ silent = false } = {}) => {
    if (!project?.id) return null;
    if (!silent) setLoading(true);
    setError(null);

    try {
      const response = await api.callApi("customDashboardModels", {
        params: { project: project.id },
      });
      setRegistry(response);
      return response;
    } catch (err) {
      setError(err);
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, [api, project?.id]);

  useEffect(() => {
    let cancelled = false;
    let timer;
    const tick = async () => {
      if (cancelled) return;
      const response = await loadRegistry({ silent: true });
      if (cancelled) return;
      if (hasActiveTraining(response)) {
        timer = setTimeout(tick, 5000);
      }
    };
    loadRegistry().then((response) => {
      if (cancelled) return;
      if (hasActiveTraining(response)) {
        timer = setTimeout(tick, 5000);
      }
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loadRegistry]);

  if (loading) return <Loading />;

  if (error) {
    return (
      <main className="p-6">
        <SimpleCard title="Dashboard error">
          <Typography size="small" className="text-negative-content">
            Unable to load dashboard data.
          </Typography>
        </SimpleCard>
      </main>
    );
  }

  const versions = registry?.versions ?? [];
  const canDownloadCurrent = Boolean(registry?.active_download_url) && Boolean(registry?.can_download_models);

  return (
    <main className="p-6 flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Typography variant="headline" size="medium">
            {project?.title} Dashboard
          </Typography>
          <Typography size="small" className="text-neutral-content-subtler">
            Project-specific YOLO training and evaluation history.
          </Typography>
        </div>
        <div className="flex items-center gap-2">
          {canDownloadCurrent && (
            <a
              className={buttonVariant({ look: "outlined" }, "gap-tight")}
              href={registry.active_download_url}
              aria-label="Download current model"
            >
              <IconFileDownload width={16} height={16} />
              Download model
            </a>
          )}
          <Link className={buttonVariant({ look: "outlined" })} to={`/projects/${project?.id}/data`} aria-label="Back to data">
            Back to Data
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-neutral-border-subtle">
        {DASHBOARD_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={[
              "px-4 py-2 -mb-px border-b-2 text-sm transition-colors",
              tab === item.id
                ? "border-primary-content text-neutral-content font-medium"
                : "border-transparent text-neutral-content-subtler hover:text-neutral-content",
            ].join(" ")}
            aria-current={tab === item.id ? "page" : undefined}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="grid grid-cols-4 gap-4 max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1">
            <MetricCard title="Current Version" value={registry?.current_version ?? "None promoted yet"} />
            <MetricCard
              title="Promotion Metric"
              value={registry?.promotion_metric ?? "fitness"}
              note={`minimum delta ${registry?.promotion_min_delta ?? 0}`}
            />
            <MetricCard title="Versions" value={versions.length} />
            <MetricCard title="Updated" value={registry?.updated_at ?? "Not available"} />
          </div>

          <TrainingHyperparameters />

          <TrainingProgress versions={versions} projectId={project?.id} />

          <SimpleCard
            title="Version History"
            description={
              registry?.active_model ? (
                <span>
                  Active model: <code>{registry.active_model}</code>
                </span>
              ) : undefined
            }
          >
            {versions.length === 0 ? (
              <div className="h-40 flex justify-center items-center border border-primary-border-subtle bg-primary-emphasis-subtle rounded-lg">
                <Typography size="small" className="text-neutral-content-subtler">
                  No model versions found for this project yet.
                </Typography>
              </div>
            ) : (
              <DataManagerLikeTable
                columns={[
                  "Version",
                  "Status",
                  "Progress",
                  "Decision",
                  "mAP50-95",
                  "mAP50",
                  "Precision",
                  "Recall",
                  "Updated",
                  "Download",
                ]}
                rows={versions.map((item) => [
                  <Link to={`/projects/${project?.id}/dashboard/${item.version}`} className="text-primary-link hover:underline font-mono">
                    {item.version}
                  </Link>,
                  <StatusBadge status={item.status} />,
                  <ProgressCell progress={item.progress} />,
                  item.decision ?? "-",
                  formatMetric(item.map50_95),
                  formatMetric(item.map50),
                  formatMetric(item.precision),
                  formatMetric(item.recall),
                  item.updated_at ?? "-",
                  item.has_model_file && registry?.can_download_models ? (
                    <a
                      href={item.download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Download model ${item.version}`}
                      className="inline-flex items-center gap-1 text-primary-link hover:underline"
                    >
                      <IconFileDownload width={16} height={16} />
                      .pt
                    </a>
                  ) : (
                    "-"
                  ),
                ])}
              />
            )}
          </SimpleCard>
        </>
      )}

      {tab === "models" && <ModelsTab registry={registry} projectId={project?.id} onRefresh={loadRegistry} />}

      {tab === "evaluation" && <EvaluationDataset />}
    </main>
  );
};


export const ProjectModelVersionPage = ({ version }) => {
  const { project } = useProject();
  const api = useAPI();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useUpdatePageTitle(version ? `${version} Metrics` : "Model Version");

  const loadDetail = useCallback(async ({ silent = false } = {}) => {
    if (!version) return null;
    if (!silent) setLoading(true);
    setError(null);

    try {
      const response = await api.callApi("customDashboardModel", {
        params: { version },
      });
      setDetail(response);
      return response;
    } catch (err) {
      setError(err);
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, [api, version]);

  useEffect(() => {
    let cancelled = false;
    let timer;
    const active = (resp) => resp?.progress?.status === "training" || resp?.status?.status === "training";
    const tick = async () => {
      if (cancelled) return;
      const response = await loadDetail({ silent: true });
      if (cancelled) return;
      if (active(response)) {
        timer = setTimeout(tick, 5000);
      }
    };
    loadDetail().then((response) => {
      if (cancelled) return;
      if (active(response)) {
        timer = setTimeout(tick, 5000);
      }
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loadDetail]);

  if (loading) return <Loading />;

  if (error || !detail) {
    return (
      <main className="p-6">
        <SimpleCard title="Model version error">
          <Typography size="small" className="text-negative-content">
            Unable to load model version details.
          </Typography>
        </SimpleCard>
      </main>
    );
  }

  const results = detail.results ?? [];
  const resultRows = results.slice(-10);
  const canDelete = detail.status?.status !== "training";

  const deleteModel = async () => {
    const confirmation = window.prompt(`This will permanently delete ${version} from disk. Type DELETE to continue.`);
    if (!confirmation || confirmation.toLowerCase() !== "delete") return;

    setDeleting(true);
    try {
      await api.callApi("customDashboardModelDelete", {
        params: { version },
        body: { confirmation },
      });
      window.location.href = `/projects/${project?.id}/dashboard`;
    } catch (err) {
      window.alert(err?.detail || err?.message || "Failed to delete model version");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="p-6 flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Typography variant="headline" size="medium">
            {detail.version}
          </Typography>
          <Typography size="small" className="text-neutral-content-subtler">
            {detail.comparison?.reason ?? detail.status?.status ?? "Model version details"}
          </Typography>
        </div>
        <div className="flex gap-2">
          <Link className={buttonVariant({ look: "outlined" })} to={`/projects/${project?.id}/dashboard`} aria-label="Back to dashboard">
            Back to Dashboard
          </Link>
          {detail.download_url && detail.has_model_file && detail.can_download_models && (
            <a
              className={buttonVariant({ look: "outlined" }, "gap-tight")}
              href={detail.download_url}
              aria-label="Download model"
            >
              <IconFileDownload width={16} height={16} />
              Download model
            </a>
          )}
          <Button
            look="destructive"
            disabled={!canDelete || deleting}
            onClick={deleteModel}
            aria-label="Delete model version"
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1">
        <MetricCard title="mAP50-95" value={formatMetric(detail.metrics?.map50_95)} />
        <MetricCard title="mAP50" value={formatMetric(detail.metrics?.map50)} />
        <MetricCard title="Precision" value={formatMetric(detail.metrics?.precision)} />
        <MetricCard title="Recall" value={formatMetric(detail.metrics?.recall)} />
      </div>

      {detail.progress?.status === "training" && (
        <SimpleCard title="Training Progress">
          <TrainingProgressBar progress={detail.progress} />
        </SimpleCard>
      )}

      <SimpleCard title="Version Details">
        <div className="grid grid-cols-3 gap-4 max-[1100px]:grid-cols-1">
          <DetailGroup
            title="Candidate Metrics"
            rows={[
              ["mAP50-95", formatMetric(detail.metrics?.map50_95)],
              ["mAP50", formatMetric(detail.metrics?.map50)],
              ["Precision", formatMetric(detail.metrics?.precision)],
              ["Recall", formatMetric(detail.metrics?.recall)],
              ["Fitness", formatMetric(detail.metrics?.fitness)],
            ]}
          />
          <DetailGroup
            title="Promotion Comparison"
            rows={[
              ["Decision", detail.comparison?.decision ?? "-"],
              ["Metric", detail.comparison?.metric ?? "-"],
              ["Old version", detail.comparison?.old_version ?? "-"],
              ["Old score", formatMetric(detail.comparison?.old_score)],
              ["New score", formatMetric(detail.comparison?.new_score)],
              ["Delta", formatMetric(detail.comparison?.delta)],
            ]}
          />
          <DetailGroup
            title="Training Config"
            rows={[
              ["Project", detail.training_config?.project_id ?? detail.status?.project_id ?? "-"],
              ["Epochs", detail.training_config?.epochs ?? "-"],
              ["Annotated images", detail.training_config?.annotated_images ?? "-"],
              ["Private eval", detail.training_config?.private_eval_dataset ?? detail.metrics?.dataset ?? "-"],
              ["Validation images", detail.training_config?.validation_images ?? "-"],
            ]}
          />
        </div>
      </SimpleCard>

      {detail.artifacts?.length > 0 && (
        <SimpleCard title="Artifacts">
          <div className="grid grid-cols-3 gap-4 max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1">
            {detail.artifacts.map((artifact) => (
              <a key={artifact.name} href={artifact.url} target="_blank" rel="noreferrer" className="block border border-neutral-border-subtle rounded p-3 hover:bg-neutral-surface-hover">
                <img src={artifact.url} alt={artifact.name} className="w-full h-64 object-contain bg-neutral-surface rounded" />
                <Typography size="small" className="mt-2 font-mono text-primary-link">
                  {artifact.name}
                </Typography>
              </a>
            ))}
          </div>
        </SimpleCard>
      )}

      <SimpleCard title="Training Results CSV">
        {resultRows.length === 0 ? (
          <Typography size="small" className="text-neutral-content-subtler">
            No training results CSV found.
          </Typography>
        ) : (
          <DataManagerLikeTable
            columns={Object.keys(resultRows[0])}
            rows={resultRows.map((row) => Object.values(row))}
          />
        )}
      </SimpleCard>
    </main>
  );
};

export const ProjectModelVersionRoute = () => {
  const version = window.location.pathname.split("/dashboard/")[1]?.replace(/\/$/, "");
  return <ProjectModelVersionPage version={version} />;
};

ProjectDashboardPage.title = "Dashboard";
ProjectDashboardPage.path = "/dashboard";
ProjectDashboardPage.exact = true;

ProjectModelVersionRoute.title = "Model Version";
ProjectModelVersionRoute.path = "/dashboard/:version";
ProjectModelVersionRoute.exact = true;

ProjectDashboardPage.context = ({ project }) => {
  const projectId = project?.id ?? getProjectIdFromPath();
  return (
    <Space size="small">
      <Link className={buttonVariant({ size: "small", look: "outlined" })} to={`/projects/${projectId}/data`} aria-label="Back to data">
        Data
      </Link>
    </Space>
  );
};

ProjectModelVersionRoute.context = ({ project }) => {
  const projectId = project?.id ?? getProjectIdFromPath();
  return (
    <Space size="small">
      <Link className={buttonVariant({ size: "small", look: "outlined" })} to={`/projects/${projectId}/dashboard`} aria-label="Back to dashboard">
        Dashboard
      </Link>
    </Space>
  );
};

const Loading = () => (
  <main className="p-6">
    <div className="h-64 flex justify-center items-center">
      <Spinner />
    </div>
  </main>
);

const MetricCard = ({ title, value, note }) => (
  <SimpleCard title={title}>
    <Typography variant="headline" size="small">
      {value}
    </Typography>
    {note && (
      <Typography size="small" className="text-neutral-content-subtler">
        {note}
      </Typography>
    )}
  </SimpleCard>
);

const formatMetric = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return Number(value).toFixed(4);
};

const StatusBadge = ({ status }) => {
  const normalized = status ?? "unknown";
  const variant = normalized === "approved" ? "positive" : normalized === "rejected" || normalized === "failed" ? "negative" : "neutral";

  return (
    <Badge variant={variant} size="small">
      {normalized}
    </Badge>
  );
};

const TrainingProgress = ({ versions, projectId }) => {
  const active = versions.filter((item) => item.progress?.status === "training" || item.status === "training");

  if (active.length === 0) return null;

  return (
    <SimpleCard title="Training In Progress">
      <div className="flex flex-col gap-4">
        {active.map((item) => (
          <div key={item.version} className="flex flex-col gap-2">
            <div className="flex justify-between gap-4">
              <Link to={`/projects/${projectId}/dashboard/${item.version}`} className="text-primary-link hover:underline font-mono">
                {item.version}
              </Link>
              <Typography size="small" className="text-neutral-content-subtler">
                {formatEpoch(item.progress)}
              </Typography>
            </div>
            <TrainingProgressBar progress={item.progress} />
          </div>
        ))}
      </div>
    </SimpleCard>
  );
};

const ProgressCell = ({ progress }) => {
  if (!progress || progress.progress_percent === null || progress.progress_percent === undefined) return "-";
  return `${progress.progress_percent}% ${formatEpoch(progress)}`;
};

const TrainingProgressBar = ({ progress }) => {
  const percent = Math.max(0, Math.min(100, Number(progress?.progress_percent ?? 0)));
  const latest = progress?.latest ?? {};

  return (
    <div className="flex flex-col gap-2">
      <div className="h-2 rounded bg-neutral-emphasis-subtle overflow-hidden">
        <div className="h-full bg-primary-content" style={{ width: `${percent}%` }} />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-neutral-content-subtler">
        <span>{percent}%</span>
        <span>{formatEpoch(progress)}</span>
        {progress?.phase && <span>Phase: {progress.phase}</span>}
        {progress?.message && <span>{progress.message}</span>}
        {latest.metrics_mAP50B && <span>mAP50: {latest.metrics_mAP50B}</span>}
        {latest.metrics_mAP50_95B && <span>mAP50-95: {latest.metrics_mAP50_95B}</span>}
      </div>
    </div>
  );
};

const formatEpoch = (progress) => {
  if (!progress?.total_epochs) return "";
  return `Epoch ${progress.current_epoch ?? 0}/${progress.total_epochs}`;
};

const hasActiveTraining = (registry) => {
  return (registry?.versions ?? []).some((item) => item.progress?.status === "training" || item.status === "training");
};

const DetailGroup = ({ title, rows }) => {
  return (
    <section className="rounded border border-neutral-border-subtle bg-neutral-background p-base">
      <Typography variant="headline" size="small" className="mb-base">
        {title}
      </Typography>
      <dl className="grid grid-cols-[140px_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-neutral-content-subtler">{label}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

const DataManagerLikeTable = ({ columns, rows }) => {
  return (
    <div className="overflow-x-auto border border-neutral-border-subtle rounded bg-neutral-background">
      <table className="w-full min-w-[1040px] border-collapse text-sm">
        <thead className="bg-neutral-surface sticky top-0 z-10">
          <tr className="border-b border-neutral-border-subtle text-left">
            {columns.map((column) => (
              <th key={column} className="px-tight py-tight h-[50px] font-medium text-neutral-content-subtler whitespace-nowrap">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={`${rowIndex % 2 ? "bg-neutral-emphasis-subtle" : "bg-neutral-background"} hover:bg-primary-emphasis-subtle transition-colors`}
            >
              {row.map((value, valueIndex) => (
                <td key={valueIndex} className="px-tight py-tight h-[48px] text-neutral-content whitespace-nowrap align-middle">
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const getProjectIdFromPath = () => {
  return window.location.pathname.match(/\/projects\/(\d+)/)?.[1];
};
