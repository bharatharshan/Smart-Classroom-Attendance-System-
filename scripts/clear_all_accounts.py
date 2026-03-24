"""
Clear all student and faculty (teacher) accounts and their dependent data.
Use this to start fresh for testing.

Run from project root:
    python scripts/clear_all_accounts.py

Dependencies are loaded from the app (database, models). Ensure .env is set.
"""
import sys
import os

# Run from project root so app is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.location_ping import LocationPing
from app.models.attendance import Attendance
from app.models.enrollment import ClassEnrollment
from app.models.timetable import Timetable
from app.models.class_model import Class
from app.models.student import Student
from app.models.faculty import Faculty


def main():
    db = SessionLocal()
    try:
        # Delete in order to respect foreign keys (child tables first)
        n_pings = db.query(LocationPing).delete()
        n_attendances = db.query(Attendance).delete()
        n_enrollments = db.query(ClassEnrollment).delete()
        n_timetables = db.query(Timetable).delete()
        n_classes = db.query(Class).delete()
        n_students = db.query(Student).delete()
        n_faculty = db.query(Faculty).delete()

        db.commit()
        print("All accounts and related data have been removed.")
        print(f"  Location pings:  {n_pings}")
        print(f"  Attendances:     {n_attendances}")
        print(f"  Enrollments:     {n_enrollments}")
        print(f"  Timetables:      {n_timetables}")
        print(f"  Classes:         {n_classes}")
        print(f"  Students:        {n_students}")
        print(f"  Faculty:         {n_faculty}")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
