import React, { useRef, useEffect, useState } from 'react';
import './WebcamCapture.css';

/**
 * Webcam capture for face verification.
 * Exposes video ref and capture callback; parent is responsible for
 * getting face embedding (e.g. via face-api.js) from the video/canvas.
 */
export function WebcamCapture({ onCapture, onError, disabled }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error

  useEffect(() => {
    let mounted = true;
    if (disabled) return;
    setStatus('loading');
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        if (!mounted || !videoRef.current) return;
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        setStatus('ready');
      })
      .catch((err) => {
        if (!mounted) return;
        setStatus('error');
        onError?.(err);
      });
    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [disabled, onError]);

  const capture = () => {
    if (!videoRef.current || videoRef.current.readyState < 2) return;
    onCapture?.(videoRef.current);
  };

  return (
    <div className="webcam-capture">
      <div className="webcam-capture__header">
        <h3 className="webcam-capture__title">Face capture</h3>
        <p className="webcam-capture__subtitle">
          Center your face in the frame, ensure good lighting, then confirm to submit attendance.
        </p>
      </div>
      <div className="webcam-capture__frame">
        <video ref={videoRef} autoPlay playsInline muted className="webcam-capture__video" />
        {status === 'loading' && (
          <div className="webcam-capture__overlay">
            <span className="webcam-capture__spinner" aria-hidden />
            <span>Starting camera…</span>
          </div>
        )}
      </div>
      <div className="webcam-capture__actions">
        {status === 'ready' && (
          <>
            <button
              type="button"
              onClick={capture}
              className="btn btn-primary webcam-capture__cta"
              disabled={disabled}
            >
              Capture &amp; verify
            </button>
            <p className="webcam-capture__note">Your image is used only for this attendance session.</p>
          </>
        )}
      </div>
      {status === 'error' && (
        <div className="webcam-capture__error" role="alert">
          Camera access was denied or no camera was found. Check permissions and try again.
        </div>
      )}
    </div>
  );
}
