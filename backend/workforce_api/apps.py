from django.apps import AppConfig


def sync_workforce_schema(sender, **kwargs):
    try:
        from django.db import connection
        if connection.vendor != "postgresql":
            return
        with connection.cursor() as cursor:
            cursor.execute("""
                ALTER TABLE workforce_pre_service_verification
                ADD COLUMN IF NOT EXISTS otp_generated_at TIMESTAMP WITH TIME ZONE,
                ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP WITH TIME ZONE,
                ADD COLUMN IF NOT EXISTS otp_attempts INTEGER DEFAULT 0;
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS workforce_work_extension (
                    id BIGSERIAL PRIMARY KEY,
                    title VARCHAR(200) NOT NULL DEFAULT 'Scope Extension',
                    description TEXT NOT NULL DEFAULT '',
                    reason TEXT NOT NULL,
                    estimated_labor_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
                    estimated_materials_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
                    requested_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
                    approved_amount NUMERIC(10, 2),
                    final_customer_amount NUMERIC(10, 2),
                    requires_specialist BOOLEAN NOT NULL DEFAULT FALSE,
                    is_critical BOOLEAN NOT NULL DEFAULT FALSE,
                    decision_token VARCHAR(64) UNIQUE,
                    decision_expires_at TIMESTAMP WITH TIME ZONE,
                    supporting_notes TEXT NOT NULL DEFAULT '',
                    supporting_photo VARCHAR(500),
                    status VARCHAR(30) NOT NULL DEFAULT 'REQUESTED',
                    admin_review_reason TEXT NOT NULL DEFAULT '',
                    admin_reviewed_at TIMESTAMP WITH TIME ZONE,
                    customer_decided_at TIMESTAMP WITH TIME ZONE,
                    customer_decline_reason TEXT NOT NULL DEFAULT '',
                    completed_at TIMESTAMP WITH TIME ZONE,
                    resolved_at TIMESTAMP WITH TIME ZONE,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    admin_reviewed_by_id BIGINT,
                    company_id BIGINT,
                    job_id BIGINT NOT NULL,
                    required_skill_id BIGINT,
                    technician_id BIGINT NOT NULL,
                    specialist_technician_id BIGINT,
                    specialist_job_id BIGINT
                );
            """)
            cursor.execute("""
                ALTER TABLE workforce_work_extension
                ADD COLUMN IF NOT EXISTS decision_token VARCHAR(64),
                ADD COLUMN IF NOT EXISTS decision_expires_at TIMESTAMP WITH TIME ZONE,
                ADD COLUMN IF NOT EXISTS final_customer_amount NUMERIC(10, 2),
                ADD COLUMN IF NOT EXISTS specialist_technician_id BIGINT,
                ADD COLUMN IF NOT EXISTS specialist_job_id BIGINT;
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS workforce_supplemental_invoice (
                    id BIGSERIAL PRIMARY KEY,
                    invoice_number VARCHAR(50) UNIQUE NOT NULL,
                    job_id BIGINT NOT NULL,
                    extension_id BIGINT UNIQUE NOT NULL,
                    customer_id BIGINT,
                    company_id BIGINT,
                    amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
                    actual_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
                    status VARCHAR(20) NOT NULL DEFAULT 'ISSUED',
                    payment_method VARCHAR(20) NOT NULL DEFAULT 'COD',
                    transaction_id VARCHAR(200),
                    paid_at TIMESTAMP WITH TIME ZONE,
                    metadata JSONB DEFAULT '{}'::jsonb,
                    audit_trail JSONB DEFAULT '[]'::jsonb,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
                );
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS workforce_job_reschedule (
                    id BIGSERIAL PRIMARY KEY,
                    job_id BIGINT NOT NULL,
                    delay_count INTEGER NOT NULL DEFAULT 1,
                    delay_type VARCHAR(30) NOT NULL DEFAULT 'PARTS_DELAY',
                    original_date DATE,
                    rescheduled_date DATE,
                    reason TEXT NOT NULL,
                    customer_notified BOOLEAN NOT NULL DEFAULT TRUE,
                    escalated_to_support BOOLEAN NOT NULL DEFAULT FALSE,
                    escalation_notes TEXT NOT NULL DEFAULT '',
                    customer_response VARCHAR(30) NOT NULL DEFAULT 'PENDING',
                    customer_notes TEXT NOT NULL DEFAULT '',
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
                );
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS workforce_employee_change_request (
                    id BIGSERIAL PRIMARY KEY,
                    employee_id BIGINT NOT NULL,
                    company_id BIGINT,
                    field_name VARCHAR(100) NOT NULL,
                    field_label VARCHAR(150) NOT NULL DEFAULT '',
                    old_value TEXT NOT NULL DEFAULT '',
                    new_value TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                    admin_notes TEXT NOT NULL DEFAULT '',
                    reviewed_by_id BIGINT,
                    reviewed_at TIMESTAMP WITH TIME ZONE,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
                );
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS workforce_user_preference (
                    id BIGSERIAL PRIMARY KEY,
                    user_id BIGINT UNIQUE NOT NULL,
                    company_id BIGINT,
                    theme VARCHAR(20) NOT NULL DEFAULT 'light',
                    accent_color VARCHAR(30) NOT NULL DEFAULT 'blue',
                    layout_density VARCHAR(20) NOT NULL DEFAULT 'comfortable',
                    font_size VARCHAR(20) NOT NULL DEFAULT 'medium',
                    high_contrast BOOLEAN NOT NULL DEFAULT FALSE,
                    reduced_motion BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
                );
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS workforce_notification_preference (
                    id BIGSERIAL PRIMARY KEY,
                    user_id BIGINT UNIQUE NOT NULL,
                    company_id BIGINT,
                    security_alerts BOOLEAN NOT NULL DEFAULT TRUE,
                    login_alerts BOOLEAN NOT NULL DEFAULT TRUE,
                    leave_updates BOOLEAN NOT NULL DEFAULT TRUE,
                    job_assignments BOOLEAN NOT NULL DEFAULT TRUE,
                    shift_reminders BOOLEAN NOT NULL DEFAULT TRUE,
                    payroll_notifications BOOLEAN NOT NULL DEFAULT TRUE,
                    weekly_digest BOOLEAN NOT NULL DEFAULT TRUE,
                    product_updates BOOLEAN NOT NULL DEFAULT FALSE,
                    workspace_announcements BOOLEAN NOT NULL DEFAULT TRUE,
                    channel_email BOOLEAN NOT NULL DEFAULT TRUE,
                    channel_in_app BOOLEAN NOT NULL DEFAULT TRUE,
                    channel_sms BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
                );
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS workforce_job_feedback (
                    id BIGSERIAL PRIMARY KEY,
                    job_id BIGINT UNIQUE NOT NULL,
                    employee_id BIGINT NOT NULL,
                    customer_id BIGINT,
                    rating INTEGER NOT NULL DEFAULT 5,
                    review TEXT NOT NULL DEFAULT '',
                    csat_score INTEGER NOT NULL DEFAULT 5,
                    resolution_ontime BOOLEAN NOT NULL DEFAULT TRUE,
                    customer_name VARCHAR(150) NOT NULL DEFAULT '',
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
                );
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS workforce_event_log (
                    id BIGSERIAL PRIMARY KEY,
                    user_id BIGINT,
                    event_type VARCHAR(100) NOT NULL,
                    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
                    ip_address VARCHAR(50) NOT NULL DEFAULT '',
                    user_agent TEXT NOT NULL DEFAULT '',
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
                );
                ALTER TABLE workforce_event_log ADD COLUMN IF NOT EXISTS ip_address VARCHAR(50) DEFAULT '';
                ALTER TABLE workforce_event_log ADD COLUMN IF NOT EXISTS user_agent TEXT DEFAULT '';
            """)
    except Exception:
        pass


class WorkforceApiConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "workforce_api"
    verbose_name = "Workforce API"

    def ready(self):
        from django.db.models.signals import post_migrate
        post_migrate.connect(sync_workforce_schema, sender=self)

