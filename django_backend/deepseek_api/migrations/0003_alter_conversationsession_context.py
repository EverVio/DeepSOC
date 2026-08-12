from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('deepseek_api', '0002_alter_conversationsession_context'),
    ]

    operations = [
        migrations.AlterField(
            model_name='conversationsession',
            name='context',
            field=models.TextField(blank=True),
        ),
    ]
