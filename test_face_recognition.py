#!/usr/bin/env python3
"""
Face Recognition Testing Script
Tests the complete face recognition workflow
"""

import asyncio
import cv2
import numpy as np
import face_recognition
import base64
import json
import logging
from io import BytesIO
from PIL import Image
from app.services.face_recognition_service import face_recognition_service
from app.database import SessionLocal, init_db
from app.models.student import Student

logger = logging.getLogger(__name__)

class FaceRecognitionTester:
    def __init__(self):
        self.cap = None
        self.known_encodings = []
        self.known_ids = []
        
    def capture_test_image(self, save_path="test_capture.jpg"):
        """Capture a test image from webcam"""
        try:
            # Initialize webcam
            self.cap = cv2.VideoCapture(0)
            
            if not self.cap.isOpened():
                raise Exception("Could not open webcam")
            
            print("📸 Press SPACE to capture image, ESC to exit")
            
            while True:
                ret, frame = self.cap.read()
                
                if not ret:
                    print("❌ Failed to capture frame")
                    continue
                
                # Display frame
                cv2.imshow('Face Recognition Test', frame)
                
                key = cv2.waitKey(1) & 0xFF
                
                if key == ord(' '):
                    # Save captured image
                    cv2.imwrite(save_path, frame)
                    print(f"✅ Image saved to {save_path}")
                    break
                elif key == 27:  # ESC
                    print("❌ Capture cancelled")
                    break
            
            # Cleanup
            self.cap.release()
            cv2.destroyAllWindows()
            
            return save_path
            
        except Exception as e:
            print(f"❌ Error capturing image: {e}")
            return None
    
    def load_image_as_base64(self, image_path):
        """Load image and convert to base64"""
        try:
            with open(image_path, "rb") as image_file:
                image_data = image_file.read()
                base64_string = base64.b64encode(image_data).decode('utf-8')
                return base64_string
        except Exception as e:
            print(f"❌ Error loading image: {e}")
            return None
    
    def test_face_detection(self, image_path):
        """Test face detection on an image"""
        try:
            # Load image
            image = face_recognition.load_image_file(image_path)
            
            # Find face locations
            face_locations = face_recognition.face_locations(image)
            
            print(f"🔍 Found {len(face_locations)} face(s) in {image_path}")
            
            # Load image with OpenCV for display
            cv_image = cv2.imread(image_path)
            
            # Draw rectangles around faces
            for (top, right, bottom, left) in face_locations:
                cv2.rectangle(cv_image, (left, top), (right, bottom), (0, 255, 0), 2)
            
            # Save result
            result_path = "test_faces_detected.jpg"
            cv2.imwrite(result_path, cv_image)
            
            print(f"✅ Face detection result saved to {result_path}")
            return face_locations
            
        except Exception as e:
            print(f"❌ Error in face detection: {e}")
            return []
    
    def test_face_encoding(self, image_path):
        """Test face encoding generation"""
        try:
            # Load image
            image = face_recognition.load_image_file(image_path)
            
            # Find face locations
            face_locations = face_recognition.face_locations(image)
            
            if len(face_locations) == 0:
                print("❌ No faces found for encoding")
                return None
            
            # Generate encoding for first face
            face_encodings = face_recognition.face_encodings(image, face_locations)
            
            if len(face_encodings) > 0:
                encoding = face_encodings[0]
                print(f"✅ Face encoding generated successfully")
                print(f"   Encoding shape: {encoding.shape}")
                print(f"   Encoding type: {type(encoding)}")
                return encoding
            else:
                print("❌ Failed to generate face encoding")
                return None
                
        except Exception as e:
            print(f"❌ Error generating face encoding: {e}")
            return None
    
    async def test_face_registration(self, student_id, image_path):
        """Test face registration process"""
        try:
            print(f"👤 Testing face registration for student: {student_id}")
            
            # Load image as base64
            base64_image = self.load_image_as_base64(image_path)
            if not base64_image:
                return False
            
            # Convert to numpy array
            image_array = face_recognition_service.decode_base64_image(base64_image)
            
            # Register face
            result = face_recognition_service.register_face(image_array, student_id)
            
            if result["success"]:
                print("✅ Face registration successful!")
                print(f"   Student ID: {result['student_id']}")
                print(f"   Face location: {result['face_location']}")
                print(f"   Encoding length: {len(result['face_encoding'])}")
                return True
            else:
                print(f"❌ Face registration failed: {result['error']}")
                return False
                
        except Exception as e:
            print(f"❌ Error in face registration test: {e}")
            return False
    
    async def test_face_verification(self, image_path):
        """Test face verification process"""
        try:
            print("🔍 Testing face verification")
            
            # Load known encodings from database
            db = SessionLocal()
            try:
                students = db.query(Student).filter(
                    Student.face_enrolled == True,
                    Student.face_embedding.isnot(None)
                ).all()
                
                if not students:
                    print("❌ No enrolled students found in database")
                    return False
                
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
                    print("❌ No valid face encodings loaded")
                    return False
                
                print(f"✅ Loaded {len(known_encodings)} known face encodings")
                
                # Load test image
                base64_image = self.load_image_as_base64(image_path)
                image_array = face_recognition_service.decode_base64_image(base64_image)
                
                # Verify face
                result = face_recognition_service.verify_face(
                    image_array, known_encodings, known_ids
                )
                
                if result["verified"]:
                    print("✅ Face verification successful!")
                    print(f"   Matched Student ID: {result['student_id']}")
                    print(f"   Confidence: {result['confidence']:.2f}")
                    print(f"   Distance: {result['distance']:.4f}")
                    return True
                else:
                    print("❌ Face verification failed!")
                    print(f"   Error: {result.get('error', 'No match found')}")
                    print(f"   Confidence: {result.get('confidence', 0):.2f}")
                    print(f"   Distance: {result.get('distance', 1.0):.4f}")
                    return False
                    
            finally:
                db.close()
                
        except Exception as e:
            print(f"❌ Error in face verification test: {e}")
            return False
    
    async def test_complete_workflow(self):
        """Test the complete face recognition workflow"""
        print("🚀 Starting Complete Face Recognition Workflow Test")
        print("=" * 60)
        
        try:
            # Step 1: Capture test image
            print("\n📸 Step 1: Capturing test image...")
            image_path = self.capture_test_image()
            
            if not image_path:
                print("❌ Failed to capture test image")
                return False
            
            # Step 2: Test face detection
            print("\n🔍 Step 2: Testing face detection...")
            face_locations = self.test_face_detection(image_path)
            
            if len(face_locations) == 0:
                print("❌ No faces detected in test image")
                return False
            
            # Step 3: Test face encoding
            print("\n🧠 Step 3: Testing face encoding generation...")
            encoding = self.test_face_encoding(image_path)
            
            if encoding is None:
                print("❌ Failed to generate face encoding")
                return False
            
            # Step 4: Test face registration
            print("\n👤 Step 4: Testing face registration...")
            test_student_id = "test-student-001"
            registration_success = await self.test_face_registration(test_student_id, image_path)
            
            if not registration_success:
                print("❌ Face registration test failed")
                return False
            
            # Step 5: Test face verification
            print("\n✅ Step 5: Testing face verification...")
            verification_success = await self.test_face_verification(image_path)
            
            if verification_success:
                print("\n🎉 Complete workflow test PASSED!")
                print("   All face recognition components working correctly")
                return True
            else:
                print("\n❌ Complete workflow test FAILED!")
                print("   Face verification did not work as expected")
                return False
                
        except Exception as e:
            print(f"\n❌ Workflow test error: {e}")
            return False
    
    def test_service_methods(self):
        """Test individual service methods"""
        print("🧪 Testing Face Recognition Service Methods")
        print("=" * 50)
        
        try:
            # Test image validation
            print("\n🖼️ Testing image validation...")
            
            # Create a test image with face (using numpy)
            test_image = np.zeros((200, 200, 3), dtype=np.uint8)
            test_image[:] = (255, 255, 255)  # White background
            
            # Add a simple "face" rectangle
            cv2.rectangle(test_image, (50, 50), (150, 150), (0, 0, 255), -1)
            
            validation_result = face_recognition_service.validate_face_image(test_image)
            
            if validation_result["valid"]:
                print("✅ Image validation working")
                print(f"   Face location: {validation_result['face_location']}")
            else:
                print("❌ Image validation failed")
                print(f"   Error: {validation_result['error']}")
            
            # Test hash generation
            print("\n🔐 Testing hash generation...")
            test_data = {
                "id": "test-001",
                "name": "Test Student",
                "timestamp": "2024-01-01T12:00:00Z"
            }
            
            hash_value = face_recognition_service.generate_attendance_hash(test_data)
            print(f"✅ Hash generated: {hash_value[:32]}...")
            
            print("\n✅ Service methods test completed")
            return True
            
        except Exception as e:
            print(f"❌ Service methods test error: {e}")
            return False

async def main():
    """Run all face recognition tests"""
    print("🎭 Face Recognition Testing Suite")
    print("=" * 60)
    
    # Initialize database
    init_db()
    
    # Create tester instance
    tester = FaceRecognitionTester()
    
    # Run tests
    tests = [
        ("Service Methods", tester.test_service_methods),
        ("Complete Workflow", tester.test_complete_workflow)
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"\n🧪 Running {test_name} Test...")
        print("-" * 40)
        
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} test failed: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = 0
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name:<25} {status}")
        if result:
            passed += 1
    
    print(f"\nTotal: {passed}/{len(results)} tests passed")
    
    if passed == len(results):
        print("🎉 All face recognition tests passed! System is ready.")
    else:
        print("⚠️  Some tests failed. Check the implementation.")
    
    # Cleanup
    if tester.cap:
        tester.cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    asyncio.run(main())
