from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from app.database import get_db
from app.models.faculty import Faculty
from app.config import settings
from typing import Optional

security = HTTPBearer()


def get_current_faculty(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Faculty:
    """
    Dependency to get current authenticated faculty.
    
    - Validates JWT token
    - Checks if faculty exists and is active
    - Returns faculty object
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        role: str = payload.get("role")
        
        if email is None or role != "faculty":
            raise credentials_exception
            
    except JWTError:
        raise credentials_exception
    
    faculty = db.query(Faculty).filter(Faculty.email == email).first()
    
    if faculty is None:
        raise credentials_exception
    
    if not faculty.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Faculty account is inactive"
        )
    
    return faculty


def get_optional_current_faculty(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[Faculty]:
    """
    Optional dependency to get current authenticated faculty.
    Returns None if not authenticated.
    """
    if not credentials:
        return None
    
    try:
        return get_current_faculty(credentials, db)
    except HTTPException:
        return None
