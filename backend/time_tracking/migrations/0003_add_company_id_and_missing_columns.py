from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('time_tracking', '0002_rename_time_tracki_employe_059714_idx_time_tracki_employe_d88427_idx_and_more'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
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
            """,
            reverse_sql="",
        ),
    ]
