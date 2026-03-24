from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import json
import logging

from app.database import get_db
from app.models.student import Student
from app.services.face_recognition_service import face_recognition_service
from app.schemas.student import StudentResponse
from app.utils.dependencies import get_current_student

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/face", tags=["Face Recognition"])

@router.post("/register", response_model=Dict[str, Any])
async def register_face(
    image: str = Form(...),  # Base64 encoded image
    student_id: str = Form(...),
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student)
):
    """
    Register student's face for biometric authentication.
    
    - Accepts base64 encoded image
    - Detects face and generates encoding
    - Stores encoding in database
    - Returns registration status
    """
    try:
        # Verify student exists and matches current user
        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student not found"
            )
        
        if student.id != current_student.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Can only register your own face"
            )
        
        # Decode and process image
        image_array = face_recognition_service.decode_base64_image(image)
        
        # Validate image quality
        validation_result = face_recognition_service.validate_face_image(image_array)
        if not validation_result["valid"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=validation_result["error"]
            )
        
        # Register face
        registration_result = face_recognition_service.register_face(image_array, student_id)
        
        if not registration_result["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=registration_result["error"]
            )
        
        # Update student record with face encoding
        student.face_embedding = json.dumps(registration_result["face_encoding"])
        student.face_enrolled = True
        student.face_embedding_model = "face_recognition_v1"
        db.commit()
        
        logger.info(f"Face registered successfully for student {student_id}")
        
        return {
            "success": True,
            "message": "Face registered successfully",
            "student_id": student_id,
            "face_location": registration_result["face_location"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Face registration error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Face registration failed"
        )

@router.post("/verify", response_model=Dict[str, Any])
async def verify_face(
    image: str = Form(...),  # Base64 encoded image
    db: Session = Depends(get_db)
):
    """
    Verify face against registered students.
    
    - Accepts base64 encoded image
    - Compares with all registered face encodings
    - Returns matching student if found
    """
    try:
        # Get all students with face encodings
        students = db.query(Student).filter(
            Student.face_enrolled == True,
            Student.face_embedding.isnot(None)
        ).all()
        
        if not students:
            return {
                "verified": False,
                "error": "No registered faces found in system"
            }
        
        # Prepare student data for face recognition
        students_data = []
        for student in students:
            students_data.append({
                "id": student.id,
                "face_embedding": student.face_embedding
            })
        
        # Load known encodings
        known_encodings, known_ids = face_recognition_service.load_known_encodings(students_data)
        
        if not known_encodings:
            return {
                "verified": False,
                "error": "No valid face encodings found"
            }
        
        # Decode and process image
        image_array = face_recognition_service.decode_base64_image(image)
        
        # Verify face
        verification_result = face_recognition_service.verify_face(
            image_array, known_encodings, known_ids
        )
        
        if verification_result["verified"]:
            # Get student details
            matched_student = db.query(Student).filter(
                Student.id == verification_result["student_id"]
            ).first()
            
            if matched_student:
                verification_result["student"] = {
                    "id": matched_student.id,
                    "student_id": matched_student.student_id,
                    "name": matched_student.name,
                    "email": matched_student.email
                }
        
        return verification_result
        
    except Exception as e:
        logger.error(f"Face verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Face verification failed"
        )

@router.post("/verify-attendance", response_model=Dict[str, Any])
async def verify_face_for_attendance(
    image: str = Form(...),  # Base64 encoded image
    class_id: str = Form(...),
    db: Session = Depends(get_db)
):
    """
    Verify face for attendance marking.
    
    - Similar to /verify but includes class context
    - Returns student info if face matches
    """
    try:
        # Get all students with face encodings
        students = db.query(Student).filter(
            Student.face_enrolled == True,
            Student.face_embedding.isnot(None)
        ).all()
        
        if not students:
            return {
                "verified": False,
                "error": "No registered faces found in system"
            }
        
        # Prepare student data
        students_data = []
        for student in students:
            students_data.append({
                "id": student.id,
                "face_embedding": student.face_embedding
            })
        
        # Load known encodings
        known_encodings, known_ids = face_recognition_service.load_known_encodings(students_data)
        
        if not known_encodings:
            return {
                "verified": False,
                "error": "No valid face encodings found"
            }
        
        # Decode and process image
        image_array = face_recognition_service.decode_base64_image(image)
        
        # Verify face
        verification_result = face_recognition_service.verify_face(
            image_array, known_encodings, known_ids
        )
        
        if verification_result["verified"]:
            # Get student details
            matched_student = db.query(Student).filter(
                Student.id == verification_result["student_id"]
            ).first()
            
            if matched_student:
                verification_result["student"] = {
                    "id": matched_student.id,
                    "student_id": matched_student.student_id,
                    "name": matched_student.name,
                    "email": matched_student.email
                }
                verification_result["class_id"] = class_id
                verification_result["ready_for_attendance"] = True
        
        return verification_result
        
    except Exception as e:
        logger.error(f"Face attendance verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Face verification failed"
        )

@router.delete("/remove/{student_id}", response_model=Dict[str, Any])
async def remove_face_registration(
    student_id: str,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student)
):
    """
    Remove face registration for a student.
    
    - Clears face encoding from database
    - Sets face_enrolled to False
    """
    try:
        # Verify student exists and matches current user
        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student not found"
            )
        
        if student.id != current_student.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Can only remove your own face registration"
            )
        
        # Remove face registration
        student.face_embedding = None
        student.face_enrolled = False
        student.face_embedding_model = None
        db.commit()
        
        logger.info(f"Face registration removed for student {student_id}")
        
        return {
            "success": True,
            "message": "Face registration removed successfully",
            "student_id": student_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Face removal error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove face registration"
        )

@router.get("/status/{student_id}", response_model=Dict[str, Any])
async def get_face_registration_status(
    student_id: str,
    db: Session = Depends(get_db)
):
    """
    Get face registration status for a student.
    """
    try:
        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student not found"
            )
        
        return {
            "student_id": student_id,
            "face_enrolled": student.face_enrolled,
            "face_embedding_model": student.face_embedding_model,
            "has_face_data": bool(student.face_embedding)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Face status check error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get face registration status"
        )

@router.get("/registered-students", response_model=List[Dict[str, Any]])
async def get_registered_students(
    db: Session = Depends(get_db)
):
    """
    Get list of all students with registered faces.
    """
    try:
        students = db.query(Student).filter(
            Student.face_enrolled == True,
            Student.face_embedding.isnot(None)
        ).all()
        
        result = []
        for student in students:
            result.append({
                "id": student.id,
                "student_id": student.student_id,
                "name": student.name,
                "email": student.email,
                "face_embedding_model": student.face_embedding_model,
                "enrolled_at": student.updated_at.isoformat() if student.updated_at else None
            })
        
        return result
        
    except Exception as e:
        logger.error(f"Error getting registered students: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get registered students"
        )
