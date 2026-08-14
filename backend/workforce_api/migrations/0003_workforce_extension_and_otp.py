from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('workforce_api', '0002_workforce_documents'),
    ]

    operations = [
        migrations.CreateModel(
            name='PreServiceVerification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('geofence_passed', models.BooleanField(default=False)),
                ('arrival_lat', models.FloatField(blank=True, null=True)),
                ('arrival_lon', models.FloatField(blank=True, null=True)),
                ('arrived_at', models.DateTimeField(blank=True, null=True)),
                ('presence_photo', models.FileField(blank=True, null=True, upload_to='pre_service/presence/')),
                ('appliance_photo', models.FileField(blank=True, null=True, upload_to='pre_service/appliance/')),
                ('work_area_photo', models.FileField(blank=True, null=True, upload_to='pre_service/work_area/')),
                ('otp_code', models.CharField(default='', max_length=6)),
                ('otp_generated_at', models.DateTimeField(blank=True, null=True)),
                ('otp_expires_at', models.DateTimeField(blank=True, null=True)),
                ('otp_attempts', models.IntegerField(default=0)),
                ('otp_verified', models.BooleanField(default=False)),
                ('otp_verified_at', models.DateTimeField(blank=True, null=True)),
                ('is_complete', models.BooleanField(db_index=True, default=False)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('employee', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='pre_service_verifications', to='employees.employee')),
                ('job', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='pre_service_verification', to='service_requests.servicerequest')),
            ],
            options={
                'db_table': 'workforce_pre_service_verification',
            },
        ),
        migrations.CreateModel(
            name='PostServiceProof',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('after_appliance_photo', models.FileField(blank=True, null=True, upload_to='post_service/appliance/')),
                ('after_work_area_photo', models.FileField(blank=True, null=True, upload_to='post_service/work_area/')),
                ('completion_notes', models.TextField(blank=True, default='')),
                ('parts_used', models.JSONField(blank=True, default=list)),
                ('is_submitted', models.BooleanField(db_index=True, default=False)),
                ('submitted_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('employee', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='post_service_proofs', to='employees.employee')),
                ('job', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='post_service_proof', to='service_requests.servicerequest')),
            ],
            options={
                'db_table': 'workforce_post_service_proof',
            },
        ),
        migrations.CreateModel(
            name='WorkforceWorkExtension',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(default='Scope Extension', max_length=200)),
                ('description', models.TextField(blank=True, default='')),
                ('reason', models.TextField()),
                ('estimated_labor_cost', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('estimated_materials_cost', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('requested_amount', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('approved_amount', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ('requires_specialist', models.BooleanField(default=False)),
                ('is_critical', models.BooleanField(default=False)),
                ('supporting_notes', models.TextField(blank=True, default='')),
                ('supporting_photo', models.FileField(blank=True, null=True, upload_to='work_extensions/photos/')),
                ('status', models.CharField(choices=[('REQUESTED', 'Requested'), ('ADMIN_APPROVED', 'Admin Approved'), ('ADMIN_REJECTED', 'Admin Rejected'), ('CUSTOMER_ACCEPTED', 'Customer Accepted'), ('CUSTOMER_DECLINED', 'Customer Declined'), ('IN_PROGRESS', 'In Progress'), ('COMPLETED', 'Completed'), ('RESOLVED', 'Resolved')], db_index=True, default='REQUESTED', max_length=30)),
                ('admin_review_reason', models.TextField(blank=True, default='')),
                ('admin_reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('customer_decided_at', models.DateTimeField(blank=True, null=True)),
                ('customer_decline_reason', models.TextField(blank=True, default='')),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('resolved_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('admin_reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reviewed_extensions', to=settings.AUTH_USER_MODEL)),
                ('company', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='work_extensions', to='companies.company')),
                ('job', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='work_extensions', to='service_requests.servicerequest')),
                ('required_skill', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='extensions', to='workforce_api.workforceskill')),
                ('technician', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='work_extensions', to='employees.employee')),
            ],
            options={
                'db_table': 'workforce_work_extension',
                'ordering': ['-created_at'],
            },
        ),
    ]
