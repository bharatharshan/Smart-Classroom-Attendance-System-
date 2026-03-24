import sys
sys.path.append('D:/Final-Year')

from app.database import SessionLocal, init_db
from app.models.student import Student
from app.utils.security import hash_password

# Initialize database
init_db()

# Create session
db = SessionLocal()

try:
    # Check if user already exists
    existing_user = db.query(Student).filter(Student.email == "faculty@test.com").first()
    if existing_user:
        print("User already exists!")
    else:
        # Create test user
        test_user = Student(
            student_id="ST001",
            name="Test Faculty",
            email="faculty@test.com",
            hashed_password=hash_password("test"),
            department="Computer Science",
            year="MCA 1st Year",
            is_active=True
        )
        
        db.add(test_user)
        db.commit()
        db.refresh(test_user)
        
        print(f"✅ User created successfully!")
        print(f"ID: {test_user.id}")
        print(f"Email: {test_user.email}")
        print(f"Name: {test_user.name}")
        
except Exception as e:
    print(f"Error: {e}")
    db.rollback()
finally:
    db.close()
