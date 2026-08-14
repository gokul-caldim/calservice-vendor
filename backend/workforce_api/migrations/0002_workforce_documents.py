from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('workforce_api', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='workforceemployeecompliance',
            name='status',
            field=models.CharField(
                choices=[
                    ('MISSING', 'Missing'),
                    ('PENDING_REVIEW', 'Pending Review'),
                    ('VALID', 'Valid'),
                    ('EXPIRING', 'Expiring Soon'),
                    ('EXPIRED', 'Expired'),
                    ('REJECTED', 'Rejected'),
                ],
                db_index=True,
                default='VALID',
                max_length=20,
            ),
        ),
        migrations.CreateModel(
            name='WorkforceRequiredDocument',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=150)),
                ('category', models.CharField(db_index=True, max_length=100)),
                ('is_mandatory', models.BooleanField(db_index=True, default=True)),
                ('description', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='required_documents', to='companies.company')),
            ],
            options={
                'db_table': 'workforce_required_document',
                'ordering': ['category', 'title'],
                'unique_together': {('company', 'category')},
            },
        ),
        migrations.CreateModel(
            name='WorkforceEmployeeDocument',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('document_number', models.CharField(blank=True, default='', max_length=100)),
                ('file_url', models.CharField(blank=True, default='', max_length=500)),
                ('status', models.CharField(choices=[('MISSING', 'Missing'), ('PENDING_REVIEW', 'Pending Review'), ('APPROVED', 'Approved'), ('REJECTED', 'Rejected'), ('EXPIRED', 'Expired')], db_index=True, default='PENDING_REVIEW', max_length=20)),
                ('issue_date', models.DateField(blank=True, null=True)),
                ('expiry_date', models.DateField(blank=True, db_index=True, null=True)),
                ('verified_at', models.DateTimeField(blank=True, null=True)),
                ('rejection_reason', models.TextField(blank=True, default='')),
                ('history_log', models.JSONField(blank=True, default=list)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('employee', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='documents', to='employees.employee')),
                ('requirement', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='employee_documents', to='workforce_api.workforcerequireddocument')),
                ('verified_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'workforce_employee_document',
                'unique_together': {('requirement', 'employee')},
            },
        ),
        migrations.CreateModel(
            name='WorkforceServiceCatalog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('category', models.CharField(db_index=True, max_length=150)),
                ('name', models.CharField(max_length=200)),
                ('price', models.DecimalField(decimal_places=2, default=0.0, max_digits=10)),
                ('duration_minutes', models.IntegerField(default=60)),
                ('is_active', models.BooleanField(db_index=True, default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'workforce_service_catalog',
                'ordering': ['category', 'name'],
            },
        ),
    ]
