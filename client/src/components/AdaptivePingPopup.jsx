import React, { useEffect, useRef } from 'react';
import { WebcamCapture } from './WebcamCapture';

/**
 * Popup shown every 5 minutes during an active session.
 * Student must capture face again to confirm still present.
 */
const PING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function AdaptivePingPopup({
  open,
  attendanceId,
  onVerify,
  onClose,
  getFaceEmbeddingFromVideo,
}) {
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!open || !attendanceId) return;
    intervalRef.current = setInterval(() => {
      // Popup is already open; interval just drives when to show next after close
    }, PING_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [open, attendanceId]);

  const handleCapture = async (videoElement) => {
    if (!getFaceEmbeddingFromVideo) {
      onVerify?.(null);
      return;
    }
    try {
      const embedding = await getFaceEmbeddingFromVideo(videoElement);
      onVerify?.(embedding);
    } catch (e) {
      onVerify?.(null);
    }
  };

  if (!open) return null;

  return (
    <div className="adaptive-ping-overlay" style={overlayStyle}>
      <div className="adaptive-ping-modal" style={modalStyle}>
        <h3>Confirm you're still present</h3>
        <p style={{ marginBottom: 16, color: '#64748b' }}>
          Please capture your face again to confirm you are still in class.
        </p>
        <WebcamCapture
          onCapture={handleCapture}
          onError={() => {}}
        />
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
};
const modalStyle = {
  background: '#fff',
  borderRadius: 16,
  padding: 24,
  maxWidth: 420,
  width: '90%',
  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
};
