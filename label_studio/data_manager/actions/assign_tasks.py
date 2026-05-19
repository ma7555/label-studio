"""Task assignment Data Manager action for the community fork."""

from core.permissions import AllPermissions
from data_manager.actions import DataManagerAction
from django.utils import timezone
from users.models import User

all_permissions = AllPermissions()


def assign_tasks(project, queryset, **kwargs):
    request = kwargs['request']
    assignee_id = request.data.get('assignee')
    if not assignee_id:
        return {'response_code': 400, 'detail': 'Assignee is required'}

    assignee = User.objects.filter(
        id=assignee_id,
        organizations=project.organization,
        om_through__deleted_at__isnull=True,
    ).first()
    if assignee is None:
        return {'response_code': 404, 'detail': 'Assignee not found in this organization'}

    assigned_at = timezone.now().isoformat()
    count = 0
    for task in queryset.only('id', 'meta'):
        meta = task.meta or {}
        meta['assignment'] = {
            'assigned_to': assignee.id,
            'assigned_to_email': assignee.email,
            'assigned_by': request.user.id,
            'assigned_at': assigned_at,
            'status': 'assigned',
        }
        task.meta = meta
        task.save(update_fields=['meta', 'updated_at'])
        count += 1

    return {
        'processed_items': count,
        'detail': f'Assigned {count} tasks to {assignee.email}',
        'reload': True,
    }


def assign_tasks_form(user, project):
    users = (
        User.objects.filter(organizations=project.organization, om_through__deleted_at__isnull=True)
        .distinct()
        .order_by('email')
    )
    return [
        {
            'columnCount': 1,
            'fields': [
                {
                    'type': 'select',
                    'name': 'assignee',
                    'label': 'Assign to',
                    'options': [
                        {
                            'value': str(item.id),
                            'label': item.get_full_name() or item.email,
                        }
                        for item in users
                    ],
                    'placeholder': 'Select annotator',
                    'searchable': True,
                    'required': True,
                }
            ],
        }
    ]


actions: list[DataManagerAction] = [
    {
        'entry_point': assign_tasks,
        'permission': all_permissions.tasks_change,
        'title': 'Assign Tasks',
        'order': 80,
        'dialog': {
            'title': 'Assign selected tasks',
            'text': 'Choose an annotator to assign the selected tasks to.',
            'type': 'confirm',
            'form': assign_tasks_form,
        },
    },
]
