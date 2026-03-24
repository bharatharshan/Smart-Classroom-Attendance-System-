from app.database import get_db
from app.models.student import Student
from app.utils.security import hash_password
from sqlalchemy.orm import Session

def create_default_faculty():
    db_gen = get_db()
    db: Session = next(db_gen)
    email = 'faculty@university.edu'
    student_id = 'FACULTY001'
    name = 'Default Faculty'
    password = 'faculty123'
    department = 'Computer Science'
    year = 'Faculty'
    hashed_pw = hash_password(password)
    # Check if already exists
    existing = db.query(Student).filter(Student.email == email).first()
    if not existing:
        faculty = Student(
            student_id=student_id,
            name=name,
            email=email,
            hashed_password=hashed_pw,
            department=department,
            year=year,
            is_active=True
        )
        db.add(faculty)
        db.commit()
        db.refresh(faculty)
        print('Default faculty created:', email, password)
    else:
        print('Default faculty already exists:', email)

if __name__ == "__main__":
    create_default_faculty()
