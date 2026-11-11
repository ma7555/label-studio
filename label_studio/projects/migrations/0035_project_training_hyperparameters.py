from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('projects', '0034_project_annotator_evaluation_enabled'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='training_epochs',
            field=models.IntegerField(
                default=50,
                help_text='Number of epochs used when the auto learner trains a model',
                verbose_name='training epochs',
            ),
        ),
        migrations.AddField(
            model_name='project',
            name='training_batch_size',
            field=models.IntegerField(
                blank=True,
                default=16,
                help_text='Batch size used when the auto learner trains a model; leave empty to use the model default',
                null=True,
                verbose_name='training batch size',
            ),
        ),
        migrations.AddField(
            model_name='project',
            name='training_learning_rate',
            field=models.FloatField(
                blank=True,
                default=0.001,
                help_text='Learning rate used when the auto learner trains a model; leave empty to use the model default',
                null=True,
                verbose_name='training learning rate',
            ),
        ),
    ]
