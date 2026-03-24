import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { studentAuth } from '../api';
import { CLASS_OPTIONS } from '../constants';
import './AuthPages.css';
import './StudentRegister.css';

function checkPasswordRules(password) {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = typeof result === 'string' ? result.split(',').pop() : '';
      resolve(base64 || '');
    };
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

export default function StudentRegister() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [form, setForm] = useState({
    student_id: '',
    name: '',
    email: '',
    password: '',
    department: '',
    year: '',
  });
  const [faceMode, setFaceMode] = useState('upload'); // 'upload' | 'capture'
  const [faceFile, setFaceFile] = useState(null);
  const [webcamError, setWebcamError] = useState(null);
  const [captureReady, setCaptureReady] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordRules = checkPasswordRules(form.password);
  const passwordValid = passwordRules.length && passwordRules.uppercase && passwordRules.lowercase && passwordRules.number;

  // Start/stop webcam when capture mode is selected/deselected
  useEffect(() => {
    if (faceMode !== 'capture') {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setCaptureReady(false);
      setWebcamError(null);
      return;
    }
    setWebcamError(null);
    setFaceFile(null);
    let stream = null;
    const video = videoRef.current;
    if (!video) return;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } })
      .then((s) => {
        stream = s;
        streamRef.current = s;
        video.srcObject = s;
        video.play().then(() => setCaptureReady(true)).catch(() => setCaptureReady(true));
      })
      .catch((err) => {
        setWebcamError(err.message || 'Could not access webcam. Use Upload photo or allow camera permission.');
      });
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [faceMode]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setFaceFile(file || null);
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !video.srcObject || video.readyState < 2) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `face-capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setFaceFile(file);
      },
      'image/jpeg',
      0.9
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!passwordValid) {
      setError('Password must meet all requirements (8+ characters, uppercase, lowercase, number).');
      return;
    }
    if (!faceFile) {
      setError('Please upload or capture your face photo for attendance.');
      return;
    }
    setLoading(true);
    try {
      const profilePhoto = await fileToBase64(faceFile);
      await studentAuth.register({ ...form, profile_photo: profilePhoto });
      const { access_token } = await studentAuth.login(form.email, form.password);
      localStorage.setItem('student_token', access_token);
      const user = await studentAuth.me();
      localStorage.setItem('student_user', JSON.stringify(user));
      navigate('/student/portal');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="student-register-card">
        <div className="student-register-header">
          <span className="student-register-logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
              <line x1="12" y1="11" x2="12" y2="15" />
              <line x1="10" y1="13" x2="14" y2="13" />
            </svg>
          </span>
          <h1>Create Account</h1>
          <p>Join the smart classroom attendance system</p>
        </div>

        <form onSubmit={handleSubmit} className="student-register-form">
          {error && <div className="auth-page__error student-register-error">{error}</div>}

          <div className="student-register-grid">
            {/* Left: User info */}
            <div className="student-register-fields">
              <div className="student-register-row">
                <div className="student-register-field">
                  <label>Student ID (Roll No.)</label>
                  <input
                    name="student_id"
                    value={form.student_id}
                    onChange={handleChange}
                    placeholder="MCA2024001"
                    required
                  />
                </div>
                <div className="student-register-field">
                  <label>Full Name</label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="John Doe"
                    required
                  />
                </div>
              </div>

              <div className="student-register-field">
                <label>Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="pedro@mca.christuniversity.in"
                  required
                />
              </div>

              <div className="student-register-field">
                <label>Password</label>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••••"
                  minLength={8}
                  required
                />
                <ul className="student-register-password-rules">
                  <li className={passwordRules.length ? 'met' : ''}>
                    <span className="check">{passwordRules.length ? '✓' : ''}</span> 8+ characters
                  </li>
                  <li className={passwordRules.uppercase ? 'met' : ''}>
                    <span className="check">{passwordRules.uppercase ? '✓' : ''}</span> One uppercase
                  </li>
                  <li className={passwordRules.lowercase ? 'met' : ''}>
                    <span className="check">{passwordRules.lowercase ? '✓' : ''}</span> One lowercase
                  </li>
                  <li className={passwordRules.number ? 'met' : ''}>
                    <span className="check">{passwordRules.number ? '✓' : ''}</span> One number
                  </li>
                </ul>
              </div>

              <div className="student-register-row">
                <div className="student-register-field">
                  <label>Department</label>
                  <input
                    name="department"
                    value={form.department}
                    onChange={handleChange}
                    placeholder="Computer Science"
                  />
                </div>
                <div className="student-register-field">
                  <label>Class</label>
                  <select name="year" value={form.year} onChange={handleChange} required>
                    <option value="">Select Class</option>
                    {CLASS_OPTIONS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Right: Face for attendance */}
            <div className="student-register-face">
              <h3>Face for attendance</h3>
              <p className="student-register-face-desc">
                Required. When you mark attendance in the Student Portal, your face will be verified against this photo.
              </p>
              <div className="student-register-face-options">
                <label className={`student-register-radio ${faceMode === 'upload' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="faceMode"
                    checked={faceMode === 'upload'}
                    onChange={() => setFaceMode('upload')}
                  />
                  <span>Upload photo</span>
                </label>
                <label className={`student-register-radio ${faceMode === 'capture' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="faceMode"
                    checked={faceMode === 'capture'}
                    onChange={() => setFaceMode('capture')}
                  />
                  <span>Capture</span>
                </label>
              </div>
              {faceMode === 'upload' && (
                <div className="student-register-file-wrap">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="student-register-file-input"
                  />
                  <button
                    type="button"
                    className="student-register-choose-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose File
                  </button>
                  <span className="student-register-file-name">{faceFile?.name || 'No file chosen'}</span>
                </div>
              )}
              {faceMode === 'capture' && (
                <div className="student-register-capture-wrap">
                  {webcamError ? (
                    <p className="student-register-webcam-error">{webcamError}</p>
                  ) : (
                    <>
                      {!faceFile && (
                        <>
                          <video
                            ref={videoRef}
                            className="student-register-video"
                            playsInline
                            muted
                            width={320}
                            height={240}
                          />
                          <button
                            type="button"
                            className="student-register-capture-btn"
                            onClick={handleCapture}
                            disabled={!captureReady}
                          >
                            Capture
                          </button>
                        </>
                      )}
                      {faceFile && (
                        <>
                          <img
                            src={URL.createObjectURL(faceFile)}
                            alt="Captured face"
                            className="student-register-video"
                            style={{ objectFit: 'cover' }}
                          />
                          <p className="student-register-captured-label">
                            Photo captured. You can re-capture if needed.
                          </p>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="student-register-submit"
            disabled={loading || !passwordValid}
          >
            <span className="student-register-submit-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
                <line x1="12" y1="11" x2="12" y2="15" />
                <line x1="10" y1="13" x2="14" y2="13" />
              </svg>
            </span>
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>

        <p className="auth-page__footer">
          Already have an account? <Link to="/student/login">Sign In</Link>
        </p>
        <Link to="/" className="auth-page__back">← Back to Home</Link>
      </div>
    </div>
  );
}
