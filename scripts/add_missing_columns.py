"""
One-off migration: add missing columns to existing tables.
Run once: python -m scripts.add_missing_columns

- classes.room_id (FK to classrooms.id) if missing
- students.notification_enabled (for push notifications)
- students.profile_photo (base64 registration photo)
- attendances.capture_time, face_verified, location_verified (time-based attendance)
- attendances.session_date + UNIQUE(student_id, class_id, session_date) for weekly slots
"""
import sys
import os

# Ensure app is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import text
from app.database import engine


def _migrate_attendance_session_date_postgres(conn):
    """
    attendances.session_date + UNIQUE(student_id, class_id, session_date).
    Replaces old UNIQUE(student_id, class_id) so weekly slots can have one row per day.
    """
    from app.config import settings

    already = conn.execute(
        text("""
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'attendances' AND c.conname = 'unique_student_class_session'
    """)
    ).scalar()
    if already:
        print("PostgreSQL: unique_student_class_session already present — session_date migration skipped")
        return

    tz_name = getattr(settings, "app_timezone", "Asia/Kolkata") or "UTC"
    safe_tz = tz_name.replace("'", "''")

    conn.execute(
        text("""
        ALTER TABLE attendances
        ADD COLUMN IF NOT EXISTS session_date DATE
    """)
    )

    conn.execute(
        text(f"""
        UPDATE attendances
        SET session_date = ((created_at AT TIME ZONE 'UTC') AT TIME ZONE '{safe_tz}')::date
        WHERE session_date IS NULL AND created_at IS NOT NULL
    """)
    )
    conn.execute(
        text("""
        UPDATE attendances
        SET session_date = CURRENT_DATE
        WHERE session_date IS NULL
    """)
    )
    for cname in (
        "unique_student_class_attendance",
        "unique_student_class_session",
        "attendances_student_id_class_id_key",
    ):
        conn.execute(text(f'ALTER TABLE attendances DROP CONSTRAINT IF EXISTS "{cname}"'))
    conn.execute(
        text("""
        ALTER TABLE attendances
        ALTER COLUMN session_date SET NOT NULL
    """)
    )
    conn.execute(
        text("""
        ALTER TABLE attendances
        ADD CONSTRAINT unique_student_class_session UNIQUE (student_id, class_id, session_date)
    """)
    )
    conn.commit()
    print("PostgreSQL: attendances.session_date + unique_student_class_session applied")


def _migrate_attendance_session_date_sqlite(conn):
    """Add session_date and backfill; SQLite cannot drop old UNIQUE via ALTER — dev only."""
    from app.config import settings

    try:
        conn.execute(text("ALTER TABLE attendances ADD COLUMN session_date DATE"))
        conn.commit()
    except Exception as e:
        if "duplicate column" not in str(e).lower():
            raise
    tz_name = getattr(settings, "app_timezone", "Asia/Kolkata") or "UTC"
    z = ZoneInfo(tz_name)
    rows = conn.execute(text("SELECT id, created_at FROM attendances WHERE session_date IS NULL")).fetchall()
    for row in rows:
        rid, created_at = row[0], row[1]
        if created_at:
            if getattr(created_at, "tzinfo", None) is None:
                d = created_at.replace(tzinfo=ZoneInfo("UTC")).astimezone(z).date()
            else:
                d = created_at.astimezone(z).date()
        else:
            d = datetime.now(z).date()
        conn.execute(
            text("UPDATE attendances SET session_date = :d WHERE id = :id"),
            {"d": d, "id": rid},
        )
    conn.commit()
    print("SQLite: attendances.session_date added/backfilled (recreate DB for new UNIQUE if needed)")


def run():
    with engine.connect() as conn:
        if "postgresql" in str(engine.url):
            # classes.room_id
            conn.execute(text("""
                ALTER TABLE classes
                ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES classrooms(id) ON DELETE SET NULL
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_classes_room_id ON classes(room_id)"))
            # students.notification_enabled (fixes /auth/register 500)
            conn.execute(text("""
                ALTER TABLE students
                ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN DEFAULT FALSE
            """))
            # students.profile_photo (base64 registration photo)
            conn.execute(text("""
                ALTER TABLE students
                ADD COLUMN IF NOT EXISTS profile_photo TEXT
            """))
            # attendances: time-based attendance columns (fixes /classes/my-batch 500 when querying Attendance)
            conn.execute(text("""
                ALTER TABLE attendances
                ADD COLUMN IF NOT EXISTS capture_time TIMESTAMP
            """))
            conn.execute(text("""
                ALTER TABLE attendances
                ADD COLUMN IF NOT EXISTS face_verified BOOLEAN DEFAULT FALSE
            """))
            conn.execute(text("""
                ALTER TABLE attendances
                ADD COLUMN IF NOT EXISTS location_verified BOOLEAN DEFAULT FALSE
            """))
            # periods.sort_order
            conn.execute(text("""
                ALTER TABLE periods
                ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0
            """))
            conn.execute(text("""
                ALTER TABLE classrooms
                ADD COLUMN IF NOT EXISTS room_slug VARCHAR(50)
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_classrooms_room_slug ON classrooms(room_slug)"))
            for col, typ in [
                ("client_ip", "VARCHAR(45)"),
                ("ip_verified", "BOOLEAN"),
                ("liveness_verified", "BOOLEAN"),
                ("location_confidence", "VARCHAR(10)"),
            ]:
                conn.execute(text(f"""
                    ALTER TABLE attendances
                    ADD COLUMN IF NOT EXISTS {col} {typ}
                """))
            conn.commit()
            print("PostgreSQL: added classes.room_id, students.notification_enabled, attendances columns, periods.sort_order if missing")

            # attendances.session_date + new unique constraint (weekly recurring classes)
            try:
                _migrate_attendance_session_date_postgres(conn)
            except Exception as e:
                err = str(e).lower()
                if "already exists" in err or "duplicate" in err:
                    print(f"PostgreSQL session_date migration skipped (already applied?): {e}")
                else:
                    raise
        else:
            # SQLite
            try:
                conn.execute(text("ALTER TABLE classes ADD COLUMN room_id BLOB"))
                conn.commit()
            except Exception as e:
                if "duplicate column" not in str(e).lower():
                    raise
            try:
                conn.execute(text("ALTER TABLE students ADD COLUMN notification_enabled BOOLEAN DEFAULT 0"))
                conn.commit()
            except Exception as e:
                if "duplicate column" not in str(e).lower():
                    raise
            for col, sql in [
                ("capture_time", "ALTER TABLE attendances ADD COLUMN capture_time DATETIME"),
                ("face_verified", "ALTER TABLE attendances ADD COLUMN face_verified BOOLEAN DEFAULT 0"),
                ("location_verified", "ALTER TABLE attendances ADD COLUMN location_verified BOOLEAN DEFAULT 0"),
            ]:
                try:
                    conn.execute(text(sql))
                    conn.commit()
                except Exception as e:
                    if "duplicate column" not in str(e).lower():
                        raise
            print("SQLite: added columns if missing")
            try:
                _migrate_attendance_session_date_sqlite(conn)
            except Exception as e:
                print(f"SQLite session_date migration: {e}")
    print("Done.")


if __name__ == "__main__":
    run()
