# Smart Attendance – React client (Geo & Adaptive Ping)

React frontend for the geo-based attendance system with adaptive pinging.

## Features

- **Student: Mark attendance** – Get location (Geolocation API), capture webcam for face verification, submit to backend. After marking, a popup appears every 5 minutes to re-capture face for session verification.
- **Faculty: Timetable** – Edit timetable with room selection per slot. Selecting a room fetches and displays latitude, longitude, and allowed radius as read-only; timetable stores `room_id` and backend syncs class geofence from the room.

## Setup

```bash
cd client
npm install
npm run dev
```

Open http://localhost:5173.

**Start the Smart Attendance backend** (project root). This repo uses **port 8001** by default so it does not clash with another API on **8000** (a common cause of **404 / “Not Found”** on faculty login):

```bash
python -m uvicorn app.main:app --reload --port 8001
```

The dev server proxies `/api/*` → `http://127.0.0.1:<VITE_API_PORT>/*` (see `client/.env.development`; the `/api` prefix is stripped before FastAPI).

**404 / “Not Found” on login:** Often **port 8000 is a different app** (wrong OpenAPI title in `/docs`). Use **8001** for this project or set `VITE_API_PORT` in `client/.env.local` to match your `uvicorn` port.

If you point at FastAPI with `VITE_API_BASE`, use `http://localhost:8001` — **not** `.../api`.

## Auth

- **Student**: Set `student_token` and `demo_student_id`, `demo_class_id` in localStorage (or implement login and pass from your auth flow).
- **Faculty**: Set `faculty_token` in localStorage to use the Timetable page (e.g. after logging in via your faculty login).

## API usage

- **Mark attendance**: `POST /attendance/entry` with `student_id`, `class_id`, `latitude`, `longitude`, `face_embedding`.
- **Verify geolocation**: `GET /attendance/verify-geolocation?class_id=...&latitude=...&longitude=...`.
- **Adaptive ping**: `POST /attendance/session/verify` with `attendance_id`, `face_embedding`.
- **Classrooms**: `GET /classrooms`, `GET /classrooms/{id}/coordinates`.
- **Timetable**: `GET /faculty/timetable/active`, `PUT /faculty/timetable/update/{id}` with `timetable_data` including `room_id` per slot.
