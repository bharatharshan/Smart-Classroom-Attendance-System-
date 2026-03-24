import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { WebcamCapture } from '../components/WebcamCapture';
import { LivenessCheck } from '../components/LivenessCheck';
import { LocationFetch } from '../components/LocationFetch';
import { AdaptivePingPopup } from '../components/AdaptivePingPopup';
import { attendance as attendanceApi, classes } from '../api';
import './MarkAttendance.css';

/**
 * Time-based attendance: Present (0-5 min), Late (5-10 min), Closed (>10 min).
 * Shows countdown, window status, camera capture; calls POST /attendance/mark.
 */
export function MarkAttendance({ getFaceEmbedding, onSuccess }) {
  const navigate = useNavigate();
  const navLocation = useLocation();
  const stateClassId = navLocation.state?.classId;
  const [batchClasses, setBatchClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(stateClassId || null);
  const [windowState, setWindowState] = useState(null); // { window, seconds_remaining, message }
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationCheck, setLocationCheck] = useState(null); // { ok, radius }
  const [step, setStep] = useState('class'); // class | location | liveness | capture | submitting | done
  const [livenessOk, setLivenessOk] = useState(false);
  const [error, setError] = useState(null);
  const [attendanceResult, setAttendanceResult] = useState(null); // { status: 'PRESENT'|'LATE' }
  const [attendanceId, setAttendanceId] = useState(null);
  const [pingOpen, setPingOpen] = useState(false);
  const pingTimerRef = useRef(null);
  const countdownRef = useRef(null);

  // Load my batch classes (enrolled)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await classes.myBatch();
        const arr = Array.isArray(list) ? list : [];
        const enrolled = arr.filter((c) => c.enrolled);
        if (!cancelled) {
          setBatchClasses(enrolled);
          if (stateClassId && enrolled.some((c) => c.id === stateClassId)) setSelectedClassId(stateClassId);
          else if (enrolled.length === 1) setSelectedClassId(enrolled[0].id);
          else if (enrolled.length > 0 && !selectedClassId) setSelectedClassId(enrolled[0].id);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load classes');
      }
    })();
    return () => { cancelled = true; };
  }, [stateClassId]);

  // Poll window state for selected class
  useEffect(() => {
    if (!selectedClassId) return;
    const fetchWindow = async () => {
      try {
        const w = await attendanceApi.getWindow(selectedClassId);
        setWindowState(w);
        if (w.seconds_remaining != null) setSecondsLeft(w.seconds_remaining);
      } catch (_) {
        setWindowState({ window: 'closed', message: 'Could not load window' });
      }
    };
    fetchWindow();
    const interval = setInterval(fetchWindow, 5000);
    return () => clearInterval(interval);
  }, [selectedClassId]);

  // Countdown tick
  useEffect(() => {
    if (windowState?.window !== 'present' && windowState?.window !== 'late') return;
    if (secondsLeft == null || secondsLeft <= 0) return;
    countdownRef.current = setInterval(() => {
      setSecondsLeft((s) => (s != null && s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [windowState?.window, secondsLeft]);

  const canMark = windowState?.window === 'present' || windowState?.window === 'late';
  const isClosed = windowState?.window === 'closed';
  const notStarted = windowState?.window === 'not_started';

  const handleLocation = useCallback(
    async (coords) => {
      setError(null);
      setLocationCheck(null);
      if (!selectedClassId) {
        setError('Please select a class first.');
        return;
      }
      try {
        // Check geolocation against classroom radius before allowing capture
        const result = await attendanceApi.verifyGeolocation(
          selectedClassId,
          coords.latitude,
          coords.longitude,
        );
        if (!result.inside_geofence) {
          setLocation(null);
          setLocationCheck({
            ok: false,
            radius: result.allowed_radius_meters || result.allowed_radius,
          });
          setError(
            `You are outside the classroom geofence. Move closer to the classroom (within ${
              result.allowed_radius_meters || result.allowed_radius || 'the allowed'
            } m).`,
          );
          setStep('location');
          return;
        }
        setLocation(coords);
        setLocationCheck({
          ok: true,
          radius: result.allowed_radius_meters || result.allowed_radius,
        });
        // Stay on the location step and show a clear confirmation;
        // user will click \"Proceed to capture\" to open the camera.
        setStep('location');
      } catch (e) {
        setLocation(null);
        setLocationCheck({ ok: false, radius: null });
        setError(e.message || 'Failed to verify your location. Please try again.');
        setStep('location');
      }
    },
    [selectedClassId],
  );

  const handleCapture = useCallback(async (videoEl) => {
    if (!location || !selectedClassId) return;
    if (!canMark) {
      setError('Attendance window has closed.');
      return;
    }
    setStep('submitting');
    setError(null);
    try {
      const embedding = getFaceEmbedding ? await getFaceEmbedding(videoEl) : null;
      const body = {
        class_id: selectedClassId,
        latitude: location.latitude,
        longitude: location.longitude,
        liveness_verified: livenessOk,
      };
      if (embedding && Array.isArray(embedding) && embedding.length >= 16) {
        body.face_embedding = embedding;
      }
      // Background validation: send scene image (JPEG data URL) for YOLO + room similarity
      try {
        const canvas = document.createElement('canvas');
        canvas.width = videoEl.videoWidth || 640;
        canvas.height = videoEl.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (ctx && canvas.width > 0 && canvas.height > 0) {
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
          body.captured_image_base64 = canvas.toDataURL('image/jpeg', 0.85);
        }
      } catch (_) {
        /* optional — attendance still works without image */
      }
      const res = await attendanceApi.mark(body);
      setAttendanceId(res.id);
      setAttendanceResult({
        status: res.status,
        background: res.background_validation || null,
        confidence: res.confidence_score,
        validation: res.validation || null,
      });
      setStep('done');
      onSuccess?.(res);
      pingTimerRef.current = setTimeout(() => setPingOpen(true), 5 * 60 * 1000);
    } catch (e) {
      setError(e.message || 'Failed to mark attendance');
      setStep('capture');
    }
  }, [location, selectedClassId, canMark, getFaceEmbedding, onSuccess, livenessOk]);

  const handlePingVerify = useCallback(async (embedding) => {
    if (!attendanceId) return;
    try {
      await attendanceApi.sessionVerify(attendanceId, embedding || []);
    } catch (_) {}
    setPingOpen(false);
    pingTimerRef.current = setTimeout(() => setPingOpen(true), 5 * 60 * 1000);
  }, [attendanceId]);

  useEffect(() => () => {
    if (pingTimerRef.current) clearTimeout(pingTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const selectedClass = batchClasses.find((c) => c.id === selectedClassId);
  const alreadyMarked = selectedClass?.attendance_marked;

  const flowSteps = [
    { key: 'class', label: 'Start' },
    { key: 'location', label: 'Location' },
    { key: 'liveness', label: 'Liveness' },
    { key: 'capture', label: 'Capture' },
  ];
  const flowStepOrder = ['class', 'location', 'liveness', 'capture', 'submitting', 'done'];
  const currentFlowIdx = (() => {
    const i = flowStepOrder.indexOf(step);
    if (i < 0) return 0;
    if (step === 'submitting') return 3;
    if (step === 'done') return 4;
    return Math.min(i, 3);
  })();

  return (
    <div className="mark-attendance">
      <div className="mark-attendance__hero">
        <h2>Mark attendance</h2>
        <p className="mark-attendance__lead">
          Verify your presence with location, live face checks, and a quick capture—aligned with your class window.
        </p>
      </div>
      <button type="button" className="btn btn-outline mark-attendance__back" onClick={() => navigate('/student/portal')}>
        ← Back to Dashboard
      </button>

      {error && <p className="mark-attendance__error">{error}</p>}

      {batchClasses.length === 0 && !error && (
        <p className="mark-attendance__msg">Loading your classes…</p>
      )}
      {batchClasses.length === 0 && error && (
        <p className="mark-attendance__msg">No enrolled classes. Enroll from the dashboard first.</p>
      )}

      {batchClasses.length > 0 && (
        <>
          <div className="mark-attendance__class-select">
            <label>Class</label>
            <select
              value={selectedClassId || ''}
              onChange={(e) => {
                setSelectedClassId(e.target.value || null);
                setStep('class');
                setLivenessOk(false);
                setAttendanceResult(null);
              }}
            >
              {batchClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.subject_name} {c.attendance_marked ? '(marked)' : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedClassId && (
            <>
              <div className={`mark-attendance__window mark-attendance__window--${windowState?.window || 'unknown'}`}>
                <span className="mark-attendance__window-label">
                  {windowState?.window === 'present' && 'Present window (0–5 min)'}
                  {windowState?.window === 'late' && 'Late window (5–10 min)'}
                  {windowState?.window === 'closed' && 'Attendance closed'}
                  {windowState?.window === 'not_started' && 'Class not started'}
                  {!windowState?.window && '…'}
                </span>
                {(windowState?.window === 'present' || windowState?.window === 'late') && secondsLeft != null && (
                  <div className="mark-attendance__countdown">
                    Time left: {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
                  </div>
                )}
                {windowState?.message && (
                  <p className="mark-attendance__window-msg">{windowState.message}</p>
                )}
              </div>

              {alreadyMarked && (
                <p className="mark-attendance__msg mark-attendance__msg--success">Attendance already marked for this class.</p>
              )}

              {!alreadyMarked && (
                <nav className="attendance-flow" aria-label="Attendance verification steps">
                  {flowSteps.map((fs, idx) => {
                    const isDone = currentFlowIdx > idx || step === 'done';
                    const isCurrent =
                      step === fs.key || (fs.key === 'capture' && step === 'submitting');
                    return (
                      <div
                        key={fs.key}
                        className={`attendance-flow__item${isDone ? ' attendance-flow__item--done' : ''}${isCurrent ? ' attendance-flow__item--current' : ''}`}
                      >
                        <span className="attendance-flow__bubble">{isDone ? '✓' : idx + 1}</span>
                        <span className="attendance-flow__label">{fs.label}</span>
                      </div>
                    );
                  })}
                </nav>
              )}

              {!alreadyMarked && step === 'class' && (
                <div className="mark-attendance__step">
                  <div className="mark-attendance__panel">
                    <h3 className="mark-attendance__panel-title">Begin verification</h3>
                    <p className="mark-attendance__panel-desc">
                      You will confirm GPS location, pass a short liveness check (blink and head movement), then capture
                      your face to submit.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!canMark || alreadyMarked}
                    onClick={() => setStep('location')}
                  >
                    {alreadyMarked
                      ? 'Attendance already marked'
                      : notStarted
                        ? 'Class not started yet'
                        : isClosed
                          ? 'Attendance closed'
                          : 'Continue to location'}
                  </button>
                </div>
              )}

              {!alreadyMarked && step === 'location' && (
                <div className="mark-attendance__step">
                  <div className="mark-attendance__panel">
                    <h3 className="mark-attendance__panel-title">Classroom location</h3>
                    <p className="mark-attendance__panel-desc">
                      We use your device location only to confirm you are within the allowed classroom area (geofence).
                    </p>
                    <LocationFetch onLocation={handleLocation} onError={(e) => setError(e?.message)} />
                    {locationCheck?.ok && (
                      <div className="verification-card" style={{ marginTop: '1rem' }}>
                        <span className="verification-card__icon verification-card__icon--net" aria-hidden>
                          GF
                        </span>
                        <div className="verification-card__body">
                          <p className="verification-card__name">Inside geofence</p>
                          <p className="verification-card__meta">
                            Allowed radius
                            {locationCheck.radius != null ? ` ~${locationCheck.radius} m` : ''}. You may continue to
                            liveness.
                          </p>
                          <span className="verification-badge verification-badge--ok">Location check passed</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <button type="button" className="btn btn-outline" onClick={() => setStep('class')}>Back</button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ marginLeft: 8 }}
                    disabled={!locationCheck?.ok}
                    onClick={() => {
                      setLivenessOk(false);
                      setStep('liveness');
                    }}
                  >
                    Continue to liveness
                  </button>
                </div>
              )}

              {!alreadyMarked && step === 'liveness' && (
                <div className="mark-attendance__step">
                  <LivenessCheck
                    disabled={!canMark}
                    onComplete={() => {
                      setLivenessOk(true);
                      setStep('capture');
                    }}
                    onError={(e) => setError(e?.message || 'Liveness failed')}
                  />
                  <button type="button" className="btn btn-outline" style={{ marginTop: 8 }} onClick={() => setStep('location')}>
                    Back
                  </button>
                </div>
              )}

              {!alreadyMarked && step === 'capture' && (
                <div className="mark-attendance__step">
                  <div className="mark-attendance__panel">
                    <h3 className="mark-attendance__panel-title">Identity capture</h3>
                    <p className="mark-attendance__panel-desc">
                      Status after submit: <strong>{windowState?.window === 'late' ? 'Late' : 'Present'}</strong> (based on
                      the attendance window).
                    </p>
                  </div>
                  <WebcamCapture
                    onCapture={handleCapture}
                    onError={(e) => setError(e?.message)}
                    disabled={!canMark}
                  />
                  {!canMark && <p className="mark-attendance__error">Attendance window has closed.</p>}
                  <button type="button" className="btn btn-outline" onClick={() => setStep('liveness')}>Back</button>
                </div>
              )}

              {step === 'submitting' && (
                <div className="mark-attendance__submitting" role="status">
                  <span className="mark-attendance__submitting-spinner" aria-hidden />
                  Verifying session, network context, and saving attendance…
                </div>
              )}

              {step === 'done' && attendanceResult && (
                <div className="mark-attendance__msg mark-attendance__msg--success">
                  <p style={{ fontSize: '1.05rem', marginBottom: '0.75rem' }}>
                    Attendance recorded — <strong>{attendanceResult.status === 'LATE' ? 'Late' : 'Present'}</strong>
                  </p>
                  <div className="verification-summary">
                    <p className="verification-summary__title">Verification summary</p>
                    {attendanceResult.validation && (
                      <>
                        <div className="verification-card">
                          <span className="verification-card__icon verification-card__icon--net" aria-hidden>
                            IP
                          </span>
                          <div className="verification-card__body">
                            <p className="verification-card__name">Network &amp; IP context</p>
                            <p className="verification-card__meta">
                              Client IP <code style={{ fontSize: '0.8rem' }}>{attendanceResult.validation.ip_address || '—'}</code>
                            </p>
                            <span
                              className={`verification-badge ${
                                attendanceResult.validation.ip_verified ? 'verification-badge--ok' : 'verification-badge--warn'
                              }`}
                            >
                              {attendanceResult.validation.ip_verified
                                ? 'Subnet aligned with room Wi‑Fi'
                                : 'Outside expected classroom subnet'}
                            </span>
                          </div>
                        </div>
                        <div className="verification-card">
                          <span className="verification-card__icon verification-card__icon--live" aria-hidden>
                            LV
                          </span>
                          <div className="verification-card__body">
                            <p className="verification-card__name">Liveness</p>
                            <p className="verification-card__meta">
                              Confirms a live person completed blink and head movement checks on device.
                            </p>
                            <span
                              className={`verification-badge ${
                                attendanceResult.validation.liveness_verified
                                  ? 'verification-badge--ok'
                                  : 'verification-badge--muted'
                              }`}
                            >
                              {attendanceResult.validation.liveness_verified
                                ? 'Liveness verified'
                                : 'Not flagged on this record'}
                            </span>
                          </div>
                        </div>
                        <div className="verification-card">
                          <span className="verification-card__icon" aria-hidden>
                            LC
                          </span>
                          <div className="verification-card__body">
                            <p className="verification-card__name">Location confidence</p>
                            <p className="verification-card__meta">
                              Combined trust score from GPS, network, and policy rules.
                            </p>
                            <span className="verification-badge verification-badge--ok">
                              {String(attendanceResult.validation.location_confidence)} — final:{' '}
                              {attendanceResult.validation.final_status}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                    {attendanceResult.background && (
                      <div className="verification-card">
                        <span className="verification-card__icon verification-card__icon--scene" aria-hidden>
                          BG
                        </span>
                        <div className="verification-card__body">
                          <p className="verification-card__name">Scene &amp; background</p>
                          <p className="verification-card__meta">
                            Detected:{' '}
                            {attendanceResult.background.detected_objects?.length
                              ? attendanceResult.background.detected_objects.join(', ')
                              : '—'}
                            . Room similarity:{' '}
                            <strong>{(attendanceResult.background.similarity_score * 100).toFixed(0)}%</strong>
                            {attendanceResult.confidence != null && (
                              <>
                                {' '}
                                · Combined model score:{' '}
                                <strong>{(Number(attendanceResult.confidence) * 100).toFixed(0)}%</strong>
                              </>
                            )}
                          </p>
                          <span
                            className={`verification-badge ${
                              String(attendanceResult.background.final_status || '')
                                .toLowerCase()
                                .includes('pass') || String(attendanceResult.background.final_status || '')
                                .toLowerCase()
                                .includes('ok')
                                ? 'verification-badge--ok'
                                : 'verification-badge--warn'
                            }`}
                          >
                            {attendanceResult.background.final_status}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      <AdaptivePingPopup
        open={pingOpen}
        attendanceId={attendanceId}
        getFaceEmbeddingFromVideo={getFaceEmbedding}
        onVerify={handlePingVerify}
        onClose={() => setPingOpen(false)}
      />
    </div>
  );
}
