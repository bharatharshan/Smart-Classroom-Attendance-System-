from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.faculty import Faculty
from app.schemas.faculty import FacultyCreate, FacultyLogin, FacultyResponse, FacultyToken
from app.utils.security import hash_password, verify_password, create_access_token
from app.utils.faculty_dependencies import get_current_faculty

router = APIRouter(prefix="/faculty/auth", tags=["Faculty Authentication"])


@router.post("/register", response_model=FacultyToken, status_code=status.HTTP_201_CREATED)
def register_faculty(faculty_data: FacultyCreate, db: Session = Depends(get_db)):
    """
    Register a new faculty member.
    
    - Validates unique email and faculty_id
    - Hashes password before storing
    - Returns JWT token for auto-login after registration
    """
    # Check if email already exists
    existing_email = db.query(Faculty).filter(Faculty.email == faculty_data.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check if faculty_id already exists
    existing_faculty_id = db.query(Faculty).filter(Faculty.faculty_id == faculty_data.faculty_id).first()
    if existing_faculty_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Faculty ID already registered"
        )
    
    # Create new faculty with hashed password
    new_faculty = Faculty(
        faculty_id=faculty_data.faculty_id,
        name=faculty_data.name,
        email=faculty_data.email,
        hashed_password=hash_password(faculty_data.password),
        department=faculty_data.department,
        designation=faculty_data.designation
    )
    
    db.add(new_faculty)
    db.commit()
    db.refresh(new_faculty)
    
    # Generate JWT token so the frontend can auto-login
    access_token = create_access_token(data={"sub": new_faculty.email, "role": "faculty"})
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login", response_model=FacultyToken)
def login_faculty(credentials: FacultyLogin, db: Session = Depends(get_db)):
    """
    Authenticate faculty and return JWT access token.
    
    - Verifies email and password
    - Returns JWT token for subsequent requests
    """
    # Find faculty by email
    faculty = db.query(Faculty).filter(Faculty.email == credentials.email).first()
    
    if not faculty:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify password
    if not verify_password(credentials.password, faculty.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if faculty is active
    if not faculty.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Faculty account is inactive"
        )
    
    # Create access token
    access_token = create_access_token(data={"sub": faculty.email, "role": "faculty"})
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=FacultyResponse)
def get_current_faculty_info(current_faculty: Faculty = Depends(get_current_faculty)):
    """
    Get current authenticated faculty information.
    
    Requires valid JWT token in Authorization header.
    """
    return FacultyResponse.from_orm(current_faculty)
