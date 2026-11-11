from django.db import migrations, models


def set_default_batch_size(apps, schema_editor):
    """Update rows still holding the previous default (8) to the new default (2)."""
    Project = apps.get_model('projects', 'Project')
    Project.objects.filter(training_batch_size=8).update(training_batch_size=2)


def restore_default_batch_size(apps, schema_editor):
    """Reverse: move rows holding the new default back to the previous one."""
    Project = apps.get_model('projects', 'Project')
    Project.objects.filter(training_batch_size=2).update(training_batch_size=8)


class Migration(migrations.Migration):
    dependencies = [
        ('projects', '0037_project_training_batch_size_default'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='training_optimizer',
            field=models.CharField(
                blank=True,
                default='auto',
                help_text='Optimizer used when the auto learner trains a model; "auto" lets Ultralytics choose',
                max_length=32,
                verbose_name='training optimizer',
            ),
        ),
        migrations.AddField(
            model_name='project',
            name='training_fraction',
            field=models.FloatField(
                blank=True,
                default=1.0,
                help_text='Fraction of the training dataset to use, between 0 and 1; 1.0 uses all data',
                null=True,
                verbose_name='training fraction',
            ),
        ),
        migrations.AlterField(
            model_name='project',
            name='training_batch_size',
            field=models.IntegerField(
                blank=True,
                default=2,
                help_text='Batch size used when the auto learner trains a model; leave empty to use the model default',
                null=True,
                verbose_name='training batch size',
            ),
        ),
        migrations.RunPython(set_default_batch_size, restore_default_batch_size),
    ]
