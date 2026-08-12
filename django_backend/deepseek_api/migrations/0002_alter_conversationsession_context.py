from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('deepseek_api', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='conversationsession',
            name='context',
            field=models.TextField(blank=True, default=''),
        ),
    ]
