from django.db import migrations, models


def set_default_batch_size(apps, schema_editor):
    """Update rows still holding the previous default (16) to the new default (8)."""
    Project = apps.get_model('projects', 'Project')
    Project.objects.filter(training_batch_size=16).update(training_batch_size=8)


def restore_default_batch_size(apps, schema_editor):
    """Reverse: move rows holding the new default back to the previous one."""
    Project = apps.get_model('projects', 'Project')
    Project.objects.filter(training_batch_size=8).update(training_batch_size=16)


class Migration(migrations.Migration):
    dependencies = [
        ('projects', '0036_project_training_imgsz'),
    ]

    operations = [
        migrations.AlterField(
            model_name='project',
            name='training_batch_size',
            field=models.IntegerField(
                blank=True,
                default=8,
                help_text='Batch size used when the auto learner trains a model; leave empty to use the model default',
                null=True,
                verbose_name='training batch size',
            ),
        ),
        migrations.RunPython(set_default_batch_size, restore_default_batch_size),
    ]
