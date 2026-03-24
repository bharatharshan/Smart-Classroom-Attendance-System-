# Background validation (cosol3)

This feature runs **after** geolocation (and optional face) checks. It **does not** reject attendance on its own—only adds a confidence score and labels like **Present (Low Confidence)** for the background signal.

## Setup

1. **Install dependencies** (if not already):

   ```bash
   pip install "ultralytics>=8.0.0,<9"
   ```

   Also listed in `requirements.txt` and `requirements-core.txt`.

2. **Reference images** — copy photos of the **cosol3** room into:

   ```
   reference_images/cosol3/
   ```

   Use `.jpg`, `.jpeg`, `.png`, or `.webp`. You can add them whenever you are ready; an empty folder means similarity stays at 0 (YOLO object scoring still runs).

3. **Optional environment** (defaults are fine):

   - `BACKGROUND_VALIDATION_ENABLED=true` (default)
   - `BACKGROUND_ROOM_SLUG=cosol3` (folder name under `reference_images/`)

## Behaviour

- **YOLOv8** detects chairs, dining tables, laptop, TV/monitor and applies the scoring rules.
- **Similarity** compares the captured frame (with central face region masked) to your reference images using histogram + ORB; best match is used.
- First run may download `yolov8n.pt` to the Ultralytics cache.

## API

`POST /api/attendance/mark` accepts optional `captured_image_base64` (data URL or raw base64). The React **Mark attendance** page sends a JPEG from the webcam automatically.

Response may include `background_validation` and `confidence_score` (0–1 combined normalized score).
