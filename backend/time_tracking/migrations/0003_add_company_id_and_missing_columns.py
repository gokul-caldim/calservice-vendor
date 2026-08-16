from django.db import migrations


def add_missing_columns(apps, schema_editor):
    connection = schema_editor.connection
    if connection.vendor == "postgresql":
        with connection.cursor() as cursor:
            cursor.execute("""
                ALTER TABLE time_tracking_timelog ADD COLUMN IF NOT EXISTS company_id bigint;
                ALTER TABLE time_tracking_timelog ADD COLUMN IF NOT EXISTS user_id bigint;
                ALTER TABLE time_tracking_timelog ADD COLUMN IF NOT EXISTS location_id bigint;
                ALTER TABLE time_tracking_timelog ADD COLUMN IF NOT EXISTS approved_by_id bigint;
                ALTER TABLE time_tracking_timelog ADD COLUMN IF NOT EXISTS distance_from_site_meters integer;
                ALTER TABLE time_tracking_timelog ADD COLUMN IF NOT EXISTS geofence_passed boolean DEFAULT false;
                ALTER TABLE time_tracking_timelog ADD COLUMN IF NOT EXISTS admin_override_used boolean DEFAULT false;
                ALTER TABLE time_tracking_timelog ADD COLUMN IF NOT EXISTS face_match_status varchar(20) DEFAULT 'pending';
                ALTER TABLE time_tracking_timelog ADD COLUMN IF NOT EXISTS face_match_score double precision;
                ALTER TABLE time_tracking_timelog ADD COLUMN IF NOT EXISTS manual_hours_correction numeric(5,2);

                ALTER TABLE time_tracking_location ADD COLUMN IF NOT EXISTS company_id bigint;
                ALTER TABLE time_tracking_jobsite ADD COLUMN IF NOT EXISTS company_id bigint;
                ALTER TABLE time_tracking_locationzone ADD COLUMN IF NOT EXISTS company_id bigint;
            """)
    elif connection.vendor == "sqlite":
        with connection.cursor() as cursor:
            def ensure_column(table, column, col_type):
                cursor.execute(f"PRAGMA table_info({table});")
                existing = [row[1] for row in cursor.fetchall()]
                if column not in existing:
                    cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type};")

            try:
                ensure_column("time_tracking_timelog", "company_id", "integer")
                ensure_column("time_tracking_timelog", "user_id", "integer")
                ensure_column("time_tracking_timelog", "location_id", "integer")
                ensure_column("time_tracking_timelog", "approved_by_id", "integer")
                ensure_column("time_tracking_timelog", "distance_from_site_meters", "integer")
                ensure_column("time_tracking_timelog", "geofence_passed", "boolean DEFAULT 0")
                ensure_column("time_tracking_timelog", "admin_override_used", "boolean DEFAULT 0")
                ensure_column("time_tracking_timelog", "face_match_status", "varchar(20) DEFAULT 'pending'")
                ensure_column("time_tracking_timelog", "face_match_score", "real")
                ensure_column("time_tracking_timelog", "manual_hours_correction", "decimal")
                ensure_column("time_tracking_location", "company_id", "integer")
                ensure_column("time_tracking_jobsite", "company_id", "integer")
                ensure_column("time_tracking_locationzone", "company_id", "integer")
            except Exception:
                pass


class Migration(migrations.Migration):

    dependencies = [
        ('time_tracking', '0002_rename_time_tracki_employe_059714_idx_time_tracki_employe_d88427_idx_and_more'),
    ]

    operations = [
        migrations.RunPython(add_missing_columns, reverse_code=migrations.RunPython.noop),
    ]

