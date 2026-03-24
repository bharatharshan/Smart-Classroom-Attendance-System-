import cv2
import numpy as np
import face_recognition
import base64
import json
import logging
from typing import List, Tuple, Optional, Dict, Any
from io import BytesIO
from PIL import Image
from app.config import settings

logger = logging.getLogger(__name__)

class FaceRecognitionService:
    def __init__(self):
        self.face_tolerance = settings.face_similarity_threshold if hasattr(settings, 'face_similarity_threshold') else 0.6
        self.known_face_encodings = {}
        self.known_face_ids = {}
        
    def decode_base64_image(self, base64_string: str) -> np.ndarray:
        """Convert base64 string to numpy array"""
        try:
            # Remove data URL prefix if present
            if 'base64,' in base64_string:
                base64_string = base64_string.split('base64,')[1]
            
            # Decode base64 to bytes
            image_bytes = base64.b64decode(base64_string)
            
            # Convert to PIL Image
            pil_image = Image.open(BytesIO(image_bytes))
            
            # Convert to numpy array (RGB)
            image_array = np.array(pil_image)
            
            # Convert RGB to BGR for OpenCV
            if len(image_array.shape) == 3:
                image_array = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
            
            return image_array
            
        except Exception as e:
            logger.error(f"Error decoding base64 image: {e}")
            raise ValueError(f"Invalid image data: {e}")
    
    def detect_faces(self, image: np.ndarray) -> List[Tuple[int, int, int, int]]:
        """Detect faces in image and return bounding boxes"""
        try:
            # Convert BGR to RGB for face_recognition
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Detect face locations
            face_locations = face_recognition.face_locations(rgb_image)
            
            return face_locations
            
        except Exception as e:
            logger.error(f"Error detecting faces: {e}")
            return []
    
    def generate_face_encoding(self, image: np.ndarray, face_location: Optional[Tuple[int, int, int, int]] = None) -> Optional[np.ndarray]:
        """Generate face encoding from image"""
        try:
            # Convert BGR to RGB for face_recognition
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Generate face encodings
            if face_location:
                # Generate encoding for specific face
                face_encodings = face_recognition.face_encodings(rgb_image, [face_location])
            else:
                # Generate encodings for all faces
                face_encodings = face_recognition.face_encodings(rgb_image)
            
            if len(face_encodings) > 0:
                return face_encodings[0]
            else:
                return None
                
        except Exception as e:
            logger.error(f"Error generating face encoding: {e}")
            return None
    
    def compare_faces(self, known_encodings: List[np.ndarray], face_encoding: np.ndarray, tolerance: float = None) -> List[bool]:
        """Compare face encoding with known encodings"""
        if tolerance is None:
            tolerance = self.face_tolerance
            
        try:
            # Compare with known faces
            matches = face_recognition.compare_faces(known_encodings, face_encoding, tolerance)
            return matches
        except Exception as e:
            logger.error(f"Error comparing faces: {e}")
            return []
    
    def face_distance(self, known_encodings: List[np.ndarray], face_encoding: np.ndarray) -> List[float]:
        """Calculate face distance between encoding and known encodings"""
        try:
            distances = face_recognition.face_distance(known_encodings, face_encoding)
            return distances.tolist()
        except Exception as e:
            logger.error(f"Error calculating face distance: {e}")
            return []
    
    def find_best_match(self, known_encodings: List[np.ndarray], known_ids: List[str], 
                      face_encoding: np.ndarray, tolerance: float = None) -> Dict[str, Any]:
        """Find best matching face from known encodings"""
        if tolerance is None:
            tolerance = self.face_tolerance
            
        try:
            # Calculate distances
            distances = self.face_distance(known_encodings, face_encoding)
            
            if not distances:
                return {
                    "matched": False,
                    "student_id": None,
                    "confidence": 0.0,
                    "distance": 1.0
                }
            
            # Find best match (minimum distance)
            best_match_index = np.argmin(distances)
            best_distance = distances[best_match_index]
            
            # Check if within tolerance
            if best_distance <= tolerance:
                return {
                    "matched": True,
                    "student_id": known_ids[best_match_index],
                    "confidence": float(1.0 - best_distance),
                    "distance": float(best_distance)
                }
            else:
                return {
                    "matched": False,
                    "student_id": None,
                    "confidence": 0.0,
                    "distance": float(best_distance)
                }
                
        except Exception as e:
            logger.error(f"Error finding best match: {e}")
            return {
                "matched": False,
                "student_id": None,
                "confidence": 0.0,
                "distance": 1.0
            }
    
    def register_face(self, image: np.ndarray, student_id: str) -> Dict[str, Any]:
        """Register face for a student"""
        try:
            # Detect faces
            face_locations = self.detect_faces(image)
            
            if len(face_locations) == 0:
                return {
                    "success": False,
                    "error": "No face detected in image"
                }
            
            if len(face_locations) > 1:
                return {
                    "success": False,
                    "error": "Multiple faces detected. Please provide image with single face."
                }
            
            # Generate encoding for the detected face
            face_encoding = self.generate_face_encoding(image, face_locations[0])
            
            if face_encoding is None:
                return {
                    "success": False,
                    "error": "Failed to generate face encoding"
                }
            
            # Convert encoding to list for JSON serialization
            encoding_list = face_encoding.tolist()
            
            return {
                "success": True,
                "face_encoding": encoding_list,
                "face_location": face_locations[0],
                "student_id": student_id
            }
            
        except Exception as e:
            logger.error(f"Error registering face: {e}")
            return {
                "success": False,
                "error": f"Face registration failed: {str(e)}"
            }
    
    def verify_face(self, image: np.ndarray, known_encodings: List[np.ndarray], 
                   known_ids: List[str]) -> Dict[str, Any]:
        """Verify face against known encodings"""
        try:
            # Detect faces
            face_locations = self.detect_faces(image)
            
            if len(face_locations) == 0:
                return {
                    "verified": False,
                    "error": "No face detected in image"
                }
            
            if len(face_locations) > 1:
                return {
                    "verified": False,
                    "error": "Multiple faces detected. Please provide image with single face."
                }
            
            # Generate encoding for the detected face
            face_encoding = self.generate_face_encoding(image, face_locations[0])
            
            if face_encoding is None:
                return {
                    "verified": False,
                    "error": "Failed to generate face encoding"
                }
            
            # Find best match
            match_result = self.find_best_match(known_encodings, known_ids, face_encoding)
            
            return {
                "verified": match_result["matched"],
                "student_id": match_result["student_id"],
                "confidence": match_result["confidence"],
                "distance": match_result["distance"],
                "face_location": face_locations[0]
            }
            
        except Exception as e:
            logger.error(f"Error verifying face: {e}")
            return {
                "verified": False,
                "error": f"Face verification failed: {str(e)}"
            }
    
    def process_webcam_frame(self, base64_image: str, known_encodings: List[np.ndarray], 
                           known_ids: List[str]) -> Dict[str, Any]:
        """Process webcam frame for real-time face recognition"""
        try:
            # Decode image
            image = self.decode_base64_image(base64_image)
            
            # Verify face
            result = self.verify_face(image, known_encodings, known_ids)
            
            # Add face bounding box for frontend display
            if result["verified"] and "face_location" in result:
                top, right, bottom, left = result["face_location"]
                result["face_box"] = {
                    "top": int(top),
                    "right": int(right),
                    "bottom": int(bottom),
                    "left": int(left)
                }
            
            return result
            
        except Exception as e:
            logger.error(f"Error processing webcam frame: {e}")
            return {
                "verified": False,
                "error": f"Frame processing failed: {str(e)}"
            }
    
    def load_known_encodings(self, students_data: List[Dict[str, Any]]) -> Tuple[List[np.ndarray], List[str]]:
        """Load known face encodings from student data"""
        known_encodings = []
        known_ids = []
        
        for student in students_data:
            if student.get("face_embedding"):
                try:
                    # Parse JSON encoding
                    encoding_list = json.loads(student["face_embedding"])
                    encoding_array = np.array(encoding_list)
                    
                    known_encodings.append(encoding_array)
                    known_ids.append(student["id"])
                    
                except Exception as e:
                    logger.warning(f"Failed to load encoding for student {student.get('id', 'unknown')}: {e}")
        
        return known_encodings, known_ids
    
    def validate_face_image(self, image: np.ndarray) -> Dict[str, Any]:
        """Validate image quality for face recognition"""
        try:
            # Check image dimensions
            height, width = image.shape[:2]
            
            if height < 100 or width < 100:
                return {
                    "valid": False,
                    "error": "Image too small. Minimum 100x100 pixels required."
                }
            
            # Detect faces
            face_locations = self.detect_faces(image)
            
            if len(face_locations) == 0:
                return {
                    "valid": False,
                    "error": "No face detected in image"
                }
            
            if len(face_locations) > 1:
                return {
                    "valid": False,
                    "error": "Multiple faces detected. Please provide image with single face."
                }
            
            # Check face size
            top, right, bottom, left = face_locations[0]
            face_width = right - left
            face_height = bottom - top
            
            if face_width < 50 or face_height < 50:
                return {
                    "valid": False,
                    "error": "Face too small. Please move closer to camera."
                }
            
            return {
                "valid": True,
                "face_location": face_locations[0],
                "face_size": {
                    "width": face_width,
                    "height": face_height
                }
            }
            
        except Exception as e:
            return {
                "valid": False,
                "error": f"Image validation failed: {str(e)}"
            }

# Global face recognition service instance
face_recognition_service = FaceRecognitionService()
