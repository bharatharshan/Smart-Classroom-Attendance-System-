from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.student import Student
from app.schemas.student import StudentCreate, StudentLogin, StudentResponse, Token
from app.utils.security import hash_password, verify_password, create_access_token
from app.utils.dependencies import get_current_student

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
def register_student(student_data: StudentCreate, db: Session = Depends(get_db)):
    """
    Register a new student.
    
    - Validates unique email and student_id
    - Hashes password before storing
    - Returns student data (excludes password)
    """
    # Check if email already exists
    existing_email = db.query(Student).filter(Student.email == student_data.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check if student_id already exists
    existing_student_id = db.query(Student).filter(Student.student_id == student_data.student_id).first()
    if existing_student_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student ID already registered"
        )
    
    # Create new student with hashed password
    new_student = Student(
        student_id=student_data.student_id,
        name=student_data.name,
        email=student_data.email,
        hashed_password=hash_password(student_data.password),
        department=student_data.department,
        year=student_data.year,
        profile_photo=student_data.profile_photo,
    )
    
    db.add(new_student)
    db.commit()
    db.refresh(new_student)
    
    # Convert ORM object to response model
    return StudentResponse.from_orm(new_student)


@router.post("/login", response_model=Token)
def login_student(credentials: StudentLogin, db: Session = Depends(get_db)):
    """
    Authenticate student and return JWT access token.
    
    - Verifies email and password
    - Returns JWT token for subsequent requests
    """
    # Find student by email
    student = db.query(Student).filter(Student.email == credentials.email).first()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify password
    if not verify_password(credentials.password, student.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if student is active
    if not student.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student account is inactive"
        )
    
    # Create access token
    access_token = create_access_token(data={"sub": student.email})
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=StudentResponse)
def get_current_student_info(current_student: Student = Depends(get_current_student)):
    """
    Get current authenticated student information.
    
    Requires valid JWT token in Authorization header.
    """
    return current_student
