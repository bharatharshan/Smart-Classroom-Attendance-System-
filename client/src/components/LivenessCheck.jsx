import React, { useRef, useEffect, useState, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import './LivenessCheck.css';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm';

/** Nose tip (canonical face mesh) */
const NOSE_IDX = 1;
/** Left / right eye centers for simple blink ratio */
const LEFT_EYE_TOP = 159;
const LEFT_EYE_BOTTOM = 145;
const LEFT_EYE_OUTER = 33;
const LEFT_EYE_INNER = 133;
const RIGHT_EYE_TOP = 386;
const RIGHT_EYE_BOTTOM = 374;
const RIGHT_EYE_OUTER = 263;
const RIGHT_EYE_INNER = 362;

function dist2d(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Eye aspect ratio — lower when eyes closed */
function earLeft(lm) {
  const v = (dist2d(lm[LEFT_EYE_TOP], lm[LEFT_EYE_BOTTOM]) + dist2d(lm[LEFT_EYE_TOP + 1], lm[LEFT_EYE_BOTTOM - 1])) / 2;
  const h = dist2d(lm[LEFT_EYE_OUTER], lm[LEFT_EYE_INNER]);
  return h > 1e-6 ? v / h : 0;
}
function earRight(lm) {
  const v = (dist2d(lm[RIGHT_EYE_TOP], lm[RIGHT_EYE_BOTTOM]) + dist2d(lm[RIGHT_EYE_TOP - 1], lm[RIGHT_EYE_BOTTOM + 1])) / 2;
  const h = dist2d(lm[RIGHT_EYE_OUTER], lm[RIGHT_EYE_INNER]);
  return h > 1e-6 ? v / h : 0;
}

function blendBlinkScore(result) {
  const shapes = result?.faceBlendshapes?.[0]?.categories;
  if (!shapes || !shapes.length) return 0;
  let left = 0;
  let right = 0;
  for (const c of shapes) {
    const n = (c.displayName || c.categoryName || '').toLowerCase();
    if (n.includes('eyeblink') && n.includes('left')) left = Math.max(left, c.score || 0);
    if (n.includes('eyeblink') && n.includes('right')) right = Math.max(right, c.score || 0);
  }
  return Math.max(left, right);
}

/**
 * MediaPipe Face Landmarker: blink + head left/right.
 * Liveness OK only when blink detected AND head moves left AND right vs baseline.
 */
export function LivenessCheck({ onComplete, onError, disabled }) {
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onComplete, onError]);

  const videoRef = useRef(null);
  const landmarkerRef = useRef(null);
  const rafRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | blink | head_left | head_right | done | error
  const [hint, setHint] = useState('Starting camera…');
  const phaseRef = useRef('blink');
  const baselineNoseXRef = useRef(null);
  const framesRef = useRef(0);
  const blinkSawClosedRef = useRef(false);
  const prevEarRef = useRef(0.25);
  const lastTsRef = useRef(0);

  const stopLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (disabled) return;
    let cancelled = false;

    const setup = async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
        const landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
        });
        if (cancelled) return;
        landmarkerRef.current = landmarker;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (cancelled) return;
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play();
        setStatus('blink');
        setHint('Please blink your eyes naturally once or twice');
        phaseRef.current = 'blink';

        const tick = () => {
          if (cancelled || !landmarkerRef.current || !videoRef.current) return;
          const video = videoRef.current;
          if (video.readyState < 2) {
            rafRef.current = requestAnimationFrame(tick);
            return;
          }
          const now = performance.now();
          if (now - lastTsRef.current < 33) {
            rafRef.current = requestAnimationFrame(tick);
            return;
          }
          lastTsRef.current = now;

          let result;
          try {
            result = landmarkerRef.current.detectForVideo(video, now);
          } catch {
            rafRef.current = requestAnimationFrame(tick);
            return;
          }

          const lm = result?.faceLandmarks?.[0];
          if (!lm || lm.length < 400) {
            setHint('Position your face in the frame');
            rafRef.current = requestAnimationFrame(tick);
            return;
          }

          const noseX = lm[NOSE_IDX]?.x ?? 0.5;
          const bsBlink = blendBlinkScore(result);
          const earL = earLeft(lm);
          const earR = earRight(lm);
          const ear = (earL + earR) / 2;

          const phase = phaseRef.current;

          if (phase === 'blink') {
            const closed = ear < 0.14 || bsBlink > 0.42;
            const open = ear > 0.2 && bsBlink < 0.25;
            if (closed) blinkSawClosedRef.current = true;
            if (blinkSawClosedRef.current && open) {
              phaseRef.current = 'head_left';
              baselineNoseXRef.current = noseX;
              setStatus('head_left');
              setHint('Turn your head slightly to YOUR left');
            }
            prevEarRef.current = ear;
          } else if (phase === 'head_left') {
            const base = baselineNoseXRef.current ?? noseX;
            if (noseX < base - 0.03) {
              phaseRef.current = 'head_right';
              baselineNoseXRef.current = noseX;
              setStatus('head_right');
              setHint('Turn your head slightly to YOUR right');
            }
          } else if (phase === 'head_right') {
            const base = baselineNoseXRef.current ?? noseX;
            if (noseX > base + 0.04) {
              phaseRef.current = 'done';
              setStatus('done');
              setHint('Liveness verified');
              stopLoop();
              onCompleteRef.current?.();
              return;
            }
          }

          rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        console.error(e);
        setStatus('error');
        setHint(e?.message || 'Could not start liveness camera');
        onErrorRef.current?.(e);
      }
    };

    setup();

    return () => {
      cancelled = true;
      stopLoop();
      landmarkerRef.current = null;
      const v = videoRef.current;
      if (v?.srcObject) {
        v.srcObject.getTracks().forEach((t) => t.stop());
        v.srcObject = null;
      }
    };
  }, [disabled, stopLoop]);

  const steps = [
    {
      key: 'blink',
      label: 'Blink',
      active: status === 'loading' || status === 'blink',
      done: ['head_left', 'head_right', 'done'].includes(status),
    },
    {
      key: 'left',
      label: 'Turn left',
      active: status === 'head_left',
      done: ['head_right', 'done'].includes(status),
    },
    {
      key: 'right',
      label: 'Turn right',
      active: status === 'head_right',
      done: status === 'done',
    },
  ];

  return (
    <div className="liveness-check">
      <div className="liveness-check__header">
        <h3 className="liveness-check__title">Liveness verification</h3>
        <p className="liveness-check__subtitle">Quick checks reduce spoofing. Follow the prompts on camera.</p>
      </div>
      <ol className="liveness-check__steps" aria-label="Liveness steps">
        {steps.map((s) => (
          <li
            key={s.key}
            className={`liveness-check__step${s.done ? ' liveness-check__step--done' : ''}${s.active && !s.done ? ' liveness-check__step--active' : ''}`}
          >
            <span className="liveness-check__step-dot" aria-hidden />
            <span className="liveness-check__step-label">{s.label}</span>
          </li>
        ))}
      </ol>
      <div className="liveness-check__video-wrap">
        <div className="liveness-check__video-frame">
          <video ref={videoRef} autoPlay playsInline muted className="liveness-check__video" />
          {status === 'loading' && (
            <div className="liveness-check__overlay">
              <span className="liveness-check__spinner" aria-hidden />
              <span>Initializing camera &amp; model…</span>
            </div>
          )}
        </div>
        <p className="liveness-check__hint">{hint}</p>
      </div>
      {status === 'error' && (
        <div className="liveness-check__error" role="alert">
          Allow camera access and use a modern browser (Chrome or Edge recommended).
        </div>
      )}
    </div>
  );
}
