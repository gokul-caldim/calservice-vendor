from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('workforce_api', '0004_customer_handover_and_billing'),
    ]


    operations = [
        migrations.CreateModel(
            name='WorkforceEmployeeChangeRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('field_name', models.CharField(db_index=True, max_length=100)),
                ('field_label', models.CharField(default='', max_length=150)),
                ('old_value', models.TextField(blank=True, default='')),
                ('new_value', models.TextField()),
                ('reason', models.TextField()),
                ('status', models.CharField(choices=[('PENDING', 'Pending Review'), ('APPROVED', 'Approved'), ('REJECTED', 'Rejected')], db_index=True, default='PENDING', max_length=20)),
                ('admin_notes', models.TextField(blank=True, default='')),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('company', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='employee_change_requests', to='companies.company')),
                ('employee', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='change_requests', to='employees.employee')),
                ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reviewed_change_requests', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'workforce_employee_change_request',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='WorkforceUserPreference',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('theme', models.CharField(default='light', max_length=20)),
                ('accent_color', models.CharField(default='blue', max_length=30)),
                ('layout_density', models.CharField(default='comfortable', max_length=20)),
                ('font_size', models.CharField(default='medium', max_length=20)),
                ('high_contrast', models.BooleanField(default=False)),
                ('reduced_motion', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('company', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='user_preferences', to='companies.company')),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='workforce_preference', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'workforce_user_preference',
            },
        ),
        migrations.CreateModel(
            name='WorkforceNotificationPreference',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('security_alerts', models.BooleanField(default=True)),
                ('login_alerts', models.BooleanField(default=True)),
                ('leave_updates', models.BooleanField(default=True)),
                ('job_assignments', models.BooleanField(default=True)),
                ('shift_reminders', models.BooleanField(default=True)),
                ('payroll_notifications', models.BooleanField(default=True)),
                ('weekly_digest', models.BooleanField(default=True)),
                ('product_updates', models.BooleanField(default=False)),
                ('workspace_announcements', models.BooleanField(default=True)),
                ('channel_email', models.BooleanField(default=True)),
                ('channel_in_app', models.BooleanField(default=True)),
                ('channel_sms', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('company', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='user_notification_preferences', to='companies.company')),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='workforce_notification_preference', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'workforce_notification_preference',
            },
        ),
        migrations.CreateModel(
            name='WorkforceJobFeedback',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('rating', models.IntegerField(default=5)),
                ('review', models.TextField(blank=True, default='')),
                ('csat_score', models.IntegerField(default=5)),
                ('resolution_ontime', models.BooleanField(default=True)),
                ('customer_name', models.CharField(blank=True, default='', max_length=150)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('customer', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='workforce_feedbacks_given', to=settings.AUTH_USER_MODEL)),
                ('employee', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='customer_feedbacks', to='employees.employee')),
                ('job', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='feedback_review', to='service_requests.servicerequest')),
            ],
            options={
                'db_table': 'workforce_job_feedback',
                'ordering': ['-created_at'],
            },
        ),
    ]
