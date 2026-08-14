from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('workforce_api', '0003_workforce_extension_and_otp'),
    ]

    operations = [
        migrations.AddField(
            model_name='workforceworkextension',
            name='decision_token',
            field=models.CharField(blank=True, db_index=True, max_length=64, null=True, unique=True),
        ),
        migrations.AddField(
            model_name='workforceworkextension',
            name='decision_expires_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='workforceworkextension',
            name='final_customer_amount',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name='workforceworkextension',
            name='specialist_job',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='specialist_parent_extension', to='service_requests.servicerequest'),
        ),
        migrations.AddField(
            model_name='workforceworkextension',
            name='specialist_technician',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='specialist_assigned_extensions', to='employees.employee'),
        ),
        migrations.AlterField(
            model_name='workforceworkextension',
            name='status',
            field=models.CharField(choices=[('REQUESTED', 'Requested'), ('ADMIN_APPROVED', 'Admin Approved'), ('ADMIN_REJECTED', 'Admin Rejected'), ('PENDING_ASSIGNMENT', 'Pending Assignment'), ('CUSTOMER_ACCEPTED', 'Customer Accepted'), ('CUSTOMER_DECLINED', 'Customer Declined'), ('IN_PROGRESS', 'In Progress'), ('COMPLETED', 'Completed'), ('RESOLVED', 'Resolved')], db_index=True, default='REQUESTED', max_length=30),
        ),
        migrations.CreateModel(
            name='WorkforceSupplementalInvoice',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('invoice_number', models.CharField(db_index=True, max_length=50, unique=True)),
                ('amount', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('actual_cost', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('status', models.CharField(choices=[('ISSUED', 'Issued'), ('PAID', 'Paid'), ('CANCELLED', 'Cancelled')], db_index=True, default='ISSUED', max_length=20)),
                ('payment_method', models.CharField(default='COD', max_length=20)),
                ('transaction_id', models.CharField(blank=True, max_length=200, null=True)),
                ('paid_at', models.DateTimeField(blank=True, null=True)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('audit_trail', models.JSONField(blank=True, default=list)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('company', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='supplemental_invoices', to='companies.company')),
                ('customer', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='supplemental_invoices', to=settings.AUTH_USER_MODEL)),
                ('extension', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='supplemental_invoice', to='workforce_api.workforceworkextension')),
                ('job', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='supplemental_invoices', to='service_requests.servicerequest')),
            ],
            options={
                'db_table': 'workforce_supplemental_invoice',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='WorkforceJobReschedule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('delay_count', models.IntegerField(default=1)),
                ('delay_type', models.CharField(choices=[('PARTS_DELAY', 'Parts Delay'), ('SPECIALIST_DELAY', 'Specialist Delay'), ('CUSTOMER_REQUEST', 'Customer Request'), ('WEATHER_ACCESS', 'Weather/Access Issue'), ('OTHER', 'Other')], default='PARTS_DELAY', max_length=30)),
                ('original_date', models.DateField(blank=True, null=True)),
                ('rescheduled_date', models.DateField(blank=True, null=True)),
                ('reason', models.TextField()),
                ('customer_notified', models.BooleanField(default=True)),
                ('escalated_to_support', models.BooleanField(default=False)),
                ('escalation_notes', models.TextField(blank=True, default='')),
                ('customer_response', models.CharField(choices=[('PENDING', 'Pending'), ('ACCEPTED', 'Accepted'), ('OBJECTED', 'Objected'), ('CALLBACK_REQUESTED', 'Callback Requested')], default='PENDING', max_length=30)),
                ('customer_notes', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('job', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reschedules', to='service_requests.servicerequest')),
            ],
            options={
                'db_table': 'workforce_job_reschedule',
                'ordering': ['-created_at'],
            },
        ),
    ]
