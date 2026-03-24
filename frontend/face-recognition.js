class FaceRecognitionManager {
    constructor() {
        this.video = null;
        this.canvas = null;
        this.stream = null;
        this.isCapturing = false;
        this.faceDetectionInterval = null;
        this.confidenceThreshold = 0.6;
        this.captureCallback = null;
    }

    async initializeWebcam(videoElement, canvasElement) {
        try {
            this.video = videoElement;
            this.canvas = canvasElement;
            
            // Request webcam access
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                },
                audio: false
            });

            // Set video source
            this.video.srcObject = this.stream;
            
            // Wait for video to be ready
            return new Promise((resolve, reject) => {
                this.video.onloadedmetadata = () => {
                    this.video.play();
                    resolve(true);
                };
                this.video.onerror = reject;
            });

        } catch (error) {
            console.error('Error accessing webcam:', error);
            throw new Error('Failed to access webcam: ' + error.message);
        }
    }

    stopWebcam() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        if (this.faceDetectionInterval) {
            clearInterval(this.faceDetectionInterval);
            this.faceDetectionInterval = null;
        }
        
        this.isCapturing = false;
    }

    captureFrame() {
        if (!this.video || !this.canvas) {
            throw new Error('Webcam not initialized');
        }

        const context = this.canvas.getContext('2d');
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        
        // Draw video frame to canvas
        context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        
        // Convert to base64
        return this.canvas.toDataURL('image/jpeg', 0.8);
    }

    async registerFace(studentId, onProgress, onComplete, onError) {
        try {
            this.isCapturing = true;
            
            // Capture multiple images for better accuracy
            const images = [];
            const totalImages = 5;
            
            for (let i = 0; i < totalImages; i++) {
                if (!this.isCapturing) break;
                
                onProgress && onProgress(i + 1, totalImages);
                
                // Wait a bit between captures
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const base64Image = this.captureFrame();
                images.push(base64Image);
            }
            
            if (!this.isCapturing) {
                throw new Error('Registration cancelled');
            }
            
            // Send to backend for registration
            const formData = new FormData();
            formData.append('image', images[0]); // Use first image for registration
            formData.append('student_id', studentId);
            
            const response = await fetch(`${API_BASE_URL}/face/register`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (response.ok) {
                onComplete && onComplete(result);
            } else {
                onError && onError(result.detail || 'Registration failed');
            }
            
        } catch (error) {
            onError && onError(error.message);
        } finally {
            this.isCapturing = false;
        }
    }

    async verifyFace(classId, onDetection, onComplete, onError) {
        try {
            this.isCapturing = true;
            
            // Start continuous face detection
            this.faceDetectionInterval = setInterval(async () => {
                if (!this.isCapturing) {
                    clearInterval(this.faceDetectionInterval);
                    return;
                }
                
                try {
                    const base64Image = this.captureFrame();
                    
                    const formData = new FormData();
                    formData.append('image', base64Image);
                    formData.append('class_id', classId);
                    
                    const response = await fetch(`${API_BASE_URL}/face/verify-attendance`, {
                        method: 'POST',
                        body: formData
                    });
                    
                    const result = await response.json();
                    
                    if (response.ok && result.verified) {
                        // Face recognized successfully
                        clearInterval(this.faceDetectionInterval);
                        this.isCapturing = false;
                        onComplete && onComplete(result);
                    } else {
                        // Update detection status
                        onDetection && onDetection(result);
                    }
                    
                } catch (error) {
                    console.error('Face verification error:', error);
                }
                
            }, 2000); // Check every 2 seconds
            
        } catch (error) {
            onError && onError(error.message);
        }
    }

    cancelCapture() {
        this.isCapturing = false;
        if (this.faceDetectionInterval) {
            clearInterval(this.faceDetectionInterval);
            this.faceDetectionInterval = null;
        }
    }

    drawFaceBox(faceBox) {
        if (!this.canvas || !faceBox) return;
        
        const context = this.canvas.getContext('2d');
        
        // Clear previous drawings
        context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw video frame
        context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        
        // Draw face box
        context.strokeStyle = '#00ff00';
        context.lineWidth = 3;
        context.strokeRect(
            faceBox.left,
            faceBox.top,
            faceBox.right - faceBox.left,
            faceBox.bottom - faceBox.top
        );
        
        // Draw confidence score
        if (faceBox.confidence) {
            context.fillStyle = '#00ff00';
            context.font = '16px Arial';
            context.fillText(
                `Confidence: ${(faceBox.confidence * 100).toFixed(1)}%`,
                faceBox.left,
                faceBox.top - 10
            );
        }
    }

    getVideoElement() {
        return this.video;
    }

    isWebcamActive() {
        return this.stream !== null && this.stream.active;
    }
}

// Global face recognition manager
let faceRecognitionManager = null;

// Initialize face recognition manager
function initializeFaceRecognition() {
    if (!faceRecognitionManager) {
        faceRecognitionManager = new FaceRecognitionManager();
    }
    return faceRecognitionManager;
}

// Utility functions for face recognition UI
function showWebcamModal(title, onConfirm, onCancel) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="btn-close" onclick="closeWebcamModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="webcam-container">
                    <video id="webcamVideo" autoplay playsinline></video>
                    <canvas id="webcamCanvas"></canvas>
                    <div class="webcam-status" id="webcamStatus">
                        <div class="status-indicator"></div>
                        <span>Initializing webcam...</span>
                    </div>
                </div>
                <div class="webcam-controls">
                    <button class="btn-secondary" onclick="closeWebcamModal()">Cancel</button>
                    <button class="btn-primary" id="webcamConfirmBtn" disabled>Confirm</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Initialize webcam
    const video = document.getElementById('webcamVideo');
    const canvas = document.getElementById('webcamCanvas');
    const status = document.getElementById('webcamStatus');
    const confirmBtn = document.getElementById('webcamConfirmBtn');
    
    const faceManager = initializeFaceRecognition();
    
    faceManager.initializeWebcam(video, canvas)
        .then(() => {
            status.innerHTML = '<div class="status-indicator success"></div><span>Webcam ready</span>';
            confirmBtn.disabled = false;
            
            confirmBtn.onclick = () => {
                const imageData = faceManager.captureFrame();
                onConfirm(imageData);
                closeWebcamModal();
            };
        })
        .catch(error => {
            status.innerHTML = '<div class="status-indicator error"></div><span>Webcam error</span>';
            console.error('Webcam initialization failed:', error);
        });
    
    // Setup cancel
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeWebcamModal();
            onCancel && onCancel();
        }
    };
}

function closeWebcamModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        if (faceRecognitionManager) {
            faceRecognitionManager.stopWebcam();
        }
        modal.remove();
    }
}

// Face registration function
async function registerStudentFace(studentId) {
    return new Promise((resolve, reject) => {
        showWebcamModal(
            'Register Face',
            async (imageData) => {
                try {
                    const formData = new FormData();
                    formData.append('image', imageData);
                    formData.append('student_id', studentId);
                    
                    const response = await fetch(`${API_BASE_URL}/face/register`, {
                        method: 'POST',
                        body: formData
                    });
                    
                    const result = await response.json();
                    
                    if (response.ok) {
                        resolve(result);
                    } else {
                        reject(new Error(result.detail || 'Registration failed'));
                    }
                } catch (error) {
                    reject(error);
                }
            },
            () => {
                reject(new Error('Face registration cancelled'));
            }
        );
    });
}

// Face verification for attendance
async function verifyFaceForAttendance(classId) {
    return new Promise((resolve, reject) => {
        showWebcamModal(
            'Mark Attendance - Face Verification',
            async (imageData) => {
                try {
                    const formData = new FormData();
                    formData.append('image', imageData);
                    formData.append('class_id', classId);
                    
                    const response = await fetch(`${API_BASE_URL}/attendance/entry-with-face`, {
                        method: 'POST',
                        body: formData
                    });
                    
                    const result = await response.json();
                    
                    if (response.ok) {
                        resolve(result);
                    } else {
                        reject(new Error(result.detail || 'Face verification failed'));
                    }
                } catch (error) {
                    reject(error);
                }
            },
            () => {
                reject(new Error('Face verification cancelled'));
            }
        );
    });
}
