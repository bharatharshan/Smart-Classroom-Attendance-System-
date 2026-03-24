# Network validation & face liveness

## Face liveness (browser)

- Implemented in `client/src/components/LivenessCheck.jsx` using **MediaPipe Face Landmarker** (`@mediapipe/tasks-vision`).
- Steps: **blink** (eye aspect ratio + blendshapes) → **turn head left** → **turn head right** (nose landmark horizontal movement).
- On success, the mark-attendance flow sends `liveness_verified: true` to `POST /api/attendance/mark`.

Disable liveness (e.g. local dev without camera model):

```env
LIVENESS_REQUIRED=false
```

## IP / WiFi subnet (server)

- Client IP is read from `X-Forwarded-For` (first hop) or the direct socket IP.
- **`127.0.0.1` / `::1` / `localhost`** are always treated as valid for local testing.
- Per-room prefixes are configured in **`room_network_prefixes_json`** (see `app/config.py`). Example:

```json
{"cosol3":["192.168.29."],"811":["192.168.30."],"812":["192.168.31."]}
```

- Link a class to a **Classroom** and set **Room slug** in Admin → Classroom Management (e.g. `cosol3`). That slug selects which prefix list applies.
- **IP mismatch never rejects attendance by itself** — it only lowers **location confidence** from `High` to `Medium` when GPS is still OK.

Disable IP checks (confidence will usually be Medium when geo passes):

```env
IP_VALIDATION_ENABLED=false
```

## Location confidence

| GPS inside geofence | IP matches room subnet |
|---------------------|-------------------------|
| Yes                 | Yes                     | **High**   |
| Yes                 | No                      | **Medium** |
| No                  | —                       | (request fails earlier) |

## API response

Successful `POST /attendance/mark` includes:

```json
"validation": {
  "ip_address": "...",
  "ip_verified": true,
  "liveness_verified": true,
  "location_confidence": "High",
  "final_status": "Present"
}
```

## Database

Run after pulling:

```bash
python -m scripts.add_missing_columns
```

Adds `classrooms.room_slug` and attendance columns: `client_ip`, `ip_verified`, `liveness_verified`, `location_confidence`.
