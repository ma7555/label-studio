from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('projects', '0035_project_training_hyperparameters'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='training_imgsz',
            field=models.IntegerField(
                blank=True,
                default=640,
                help_text='Image size in pixels used when the auto learner trains a model; leave empty to use the model default',
                null=True,
                verbose_name='training image size',
            ),
        ),
    ]
