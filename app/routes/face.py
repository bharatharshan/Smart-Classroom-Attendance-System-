from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.student import Student
from app.schemas.student import FaceEmbeddingPayload, StudentResponse
from app.utils.dependencies import get_current_student
from app.utils.face_recognition import serialize_embedding, verify_face


router = APIRouter(prefix="/face", tags=["Facial Recognition"])


@router.post("/enroll", response_model=StudentResponse, status_code=status.HTTP_200_OK)
def enroll_face(
    payload: FaceEmbeddingPayload,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    """
    Phase 5: Enroll/update 3D facial template for the current student.

    The client is expected to compute a 3D-capable face embedding (e.g., from
    3D landmarks / depth-aware model) and send it as a float vector.
    """
    current_student.face_embedding = serialize_embedding(payload.embedding)
    current_student.face_embedding_model = payload.model
    current_student.face_enrolled = True

    db.add(current_student)
    db.commit()
    db.refresh(current_student)

    return current_student


@router.post("/verify", response_model=dict)
def verify_face_match(
    payload: FaceEmbeddingPayload,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    """
    Verify a live 3D face embedding against the enrolled template for the current student.
    """
    if not current_student.face_enrolled or not current_student.face_embedding:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No enrolled face template found for this student. Please enroll first.",
        )

    matched, similarity = verify_face(
        enrolled_embedding_json=current_student.face_embedding,
        probe_embedding=payload.embedding,
    )

    return {
        "matched": matched,
        "similarity": similarity,
        "model": payload.model,
        "face_enrolled": current_student.face_enrolled,
    }

