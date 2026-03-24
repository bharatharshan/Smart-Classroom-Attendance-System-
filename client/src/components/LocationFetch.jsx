import React, { useState } from 'react';
import './LocationFetch.css';

/**
 * Fetches current position using browser Geolocation API.
 */
export function LocationFetch({ onLocation, onError }) {
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [coords, setCoords] = useState(null);

  const fetchLocation = () => {
    setStatus('loading');
    if (!navigator.geolocation) {
      setStatus('error');
      onError?.(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ latitude, longitude });
        setStatus('done');
        onLocation?.({ latitude, longitude });
      },
      (err) => {
        setStatus('error');
        onError?.(err);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div className="location-fetch">
      <span className="location-fetch__label">Network &amp; GPS</span>
      <button
        type="button"
        onClick={fetchLocation}
        disabled={status === 'loading'}
        className="btn btn-secondary location-fetch__btn"
      >
        {status === 'loading' ? 'Acquiring location…' : 'Use my current location'}
      </button>
      {status === 'done' && coords && (
        <div className="location-fetch__status location-fetch__status--ok">
          <div className="location-fetch__row">
            <span className="location-fetch__icon" aria-hidden title="OK">
              ✓
            </span>
            <div>
              <p className="location-fetch__status-title">Location acquired</p>
              <p className="location-fetch__coords">
                {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
              </p>
              <p className="location-fetch__hint">Coordinates are sent securely for geofence verification only.</p>
            </div>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div className="location-fetch__status location-fetch__status--err" role="alert">
          <div className="location-fetch__row">
            <span className="location-fetch__icon location-fetch__icon--err" aria-hidden>
              !
            </span>
            <div>
              <p className="location-fetch__status-title">Location unavailable</p>
              <p className="location-fetch__hint">
                Enable location services for this site, or try again near a window if indoors.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
