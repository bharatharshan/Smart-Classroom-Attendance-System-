"""
Background validation for attendance: YOLOv8 object detection + image similarity vs reference room photos.
Designed for office room "cosol3" (reference_images/cosol3/). Fails soft: if YOLO or refs missing, scores degrade gracefully.
"""
from __future__ import annotations

import base64
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# COCO class indices used by YOLOv8 (Ultralytics default)
COCO_CHAIR = 56
COCO_DINING_TABLE = 60
COCO_TV = 62
COCO_LAPTOP = 63
TARGET_CLASSES = {COCO_CHAIR, COCO_DINING_TABLE, COCO_TV, COCO_LAPTOP}

COCO_NAMES = {
    COCO_CHAIR: "chair",
    COCO_DINING_TABLE: "dining table",
    COCO_LAPTOP: "laptop",
    COCO_TV: "tv/monitor",
}

_yolo_model = None  # lazy singleton


def _project_root() -> Path:
    return Path(__file__).resolve().parent.parent.parent


def reference_dir_for_room(room_slug: str) -> Path:
    return _project_root() / "reference_images" / room_slug


def _decode_image_bgr(image_bytes: bytes) -> Optional[np.ndarray]:
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img


def decode_base64_image(b64: str) -> Optional[np.ndarray]:
    """Decode data URL or raw base64 to BGR image."""
    if not b64:
        return None
    s = b64.strip()
    if "," in s and s.startswith("data:"):
        s = s.split(",", 1)[1]
    try:
        raw = base64.b64decode(s, validate=True)
        return _decode_image_bgr(raw)
    except Exception as e:
        logger.warning("Failed to decode base64 image: %s", e)
        return None


def mask_center_face_region(img: np.ndarray, width_frac: float = 0.38, height_frac: float = 0.38) -> np.ndarray:
    """
    Reduce face influence by masking an elliptical region at the image center (typical face area).
    """
    h, w = img.shape[:2]
    out = img.copy()
    cx, cy = w // 2, h // 2
    ax = int(w * width_frac / 2)
    ay = int(h * height_frac / 2)
    cv2.ellipse(out, (cx, cy), (ax, ay), 0, 0, 360, (0, 0, 0), thickness=-1)
    return out


def prepare_for_similarity(img: np.ndarray) -> np.ndarray:
    """Background-focused view: mask center (face) then resize for stable comparison."""
    masked = mask_center_face_region(img)
    # Slightly smaller for speed
    return cv2.resize(masked, (320, 240), interpolation=cv2.INTER_AREA)


def histogram_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Return similarity in [0, 1] using HSV histogram correlation."""
    if a is None or b is None or a.size == 0 or b.size == 0:
        return 0.0
    a = cv2.resize(a, (320, 240))
    b = cv2.resize(b, (320, 240))
    ha = cv2.cvtColor(a, cv2.COLOR_BGR2HSV)
    hb = cv2.cvtColor(b, cv2.COLOR_BGR2HSV)
    h_bins, s_bins, v_bins = 16, 16, 8
    h1 = cv2.calcHist([ha], [0, 1, 2], None, [h_bins, s_bins, v_bins], [0, 180, 0, 256, 0, 256])
    h2 = cv2.calcHist([hb], [0, 1, 2], None, [h_bins, s_bins, v_bins], [0, 180, 0, 256, 0, 256])
    cv2.normalize(h1, h1, 0, 1, cv2.NORM_MINMAX)
    cv2.normalize(h2, h2, 0, 1, cv2.NORM_MINMAX)
    corr = cv2.compareHist(h1, h2, cv2.HISTCMP_CORREL)
    # Map [-1, 1] -> [0, 1]
    return float(max(0.0, min(1.0, (corr + 1.0) / 2.0)))


def orb_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """ORB feature match ratio as similarity in [0, 1]."""
    if a is None or b is None:
        return 0.0
    gray_a = cv2.cvtColor(a, cv2.COLOR_BGR2GRAY)
    gray_b = cv2.cvtColor(b, cv2.COLOR_BGR2GRAY)
    orb = cv2.ORB_create(nfeatures=800)
    kp1, des1 = orb.detectAndCompute(gray_a, None)
    kp2, des2 = orb.detectAndCompute(gray_b, None)
    if des1 is None or des2 is None or len(des1) < 4 or len(des2) < 4:
        return 0.0
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    matches = bf.match(des1, des2)
    if not matches:
        return 0.0
    good = len([m for m in matches if m.distance < 60])
    denom = max(min(len(des1), len(des2)), 1)
    return float(min(1.0, good / max(denom * 0.15, 1.0)))


def pair_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Take max of histogram and ORB similarity."""
    return max(histogram_similarity(a, b), orb_similarity(a, b))


def load_reference_images(room_slug: str) -> List[np.ndarray]:
    """Load all images from reference_images/<room_slug>/."""
    folder = reference_dir_for_room(room_slug)
    if not folder.is_dir():
        logger.info("Reference folder not found: %s", folder)
        return []
    images: List[np.ndarray] = []
    for ext in ("*.jpg", "*.jpeg", "*.png", "*.webp"):
        for p in sorted(folder.glob(ext)):
            im = cv2.imread(str(p), cv2.IMREAD_COLOR)
            if im is not None:
                images.append(im)
    return images


def max_reference_similarity(captured_prep: np.ndarray, references: List[np.ndarray]) -> float:
    if not references:
        return 0.0
    best = 0.0
    for ref in references:
        prep_ref = prepare_for_similarity(ref)
        sim = pair_similarity(captured_prep, prep_ref)
        if sim > best:
            best = sim
    return float(best)


def get_yolo():
    global _yolo_model
    if _yolo_model is not None:
        return _yolo_model
    try:
        from ultralytics import YOLO  # type: ignore

        # nano model — small download, CPU-friendly
        _yolo_model = YOLO("yolov8n.pt")
        return _yolo_model
    except Exception as e:
        logger.warning("YOLOv8 not available: %s", e)
        return None


def run_object_detection(img: np.ndarray) -> Tuple[List[str], int, bool, bool, bool]:
    """
    Returns: (labels of detected target objects, chair_count, has_table, has_laptop_or_monitor)
    """
    labels: List[str] = []
    chair_count = 0
    has_table = False
    has_lm = False

    model = get_yolo()
    if model is None:
        return labels, 0, False, False

    try:
        results = model.predict(img, verbose=False, conf=0.25, iou=0.45)
        if not results:
            return labels, 0, False, False
        r = results[0]
        if r.boxes is None or len(r.boxes) == 0:
            return labels, 0, False, False
        for box in r.boxes:
            cls_id = int(box.cls[0].item()) if box.cls is not None else -1
            if cls_id not in TARGET_CLASSES:
                continue
            name = COCO_NAMES.get(cls_id, str(cls_id))
            labels.append(name)
            if cls_id == COCO_CHAIR:
                chair_count += 1
            elif cls_id == COCO_DINING_TABLE:
                has_table = True
            elif cls_id in (COCO_LAPTOP, COCO_TV):
                has_lm = True
    except Exception as e:
        logger.warning("YOLO inference failed: %s", e)

    return labels, chair_count, has_table, has_lm


def compute_background_component(chair_count: int, has_table: bool, has_laptop_or_monitor: bool) -> float:
    """Raw score from rules (max 0.9)."""
    score = 0.0
    if chair_count >= 3:
        score += 0.4
    if has_table:
        score += 0.3
    if has_laptop_or_monitor:
        score += 0.2
    return float(min(0.9, score))


def normalize_combined(background_raw: float, similarity_bonus: float) -> float:
    """
    similarity_bonus: 0.2 if ref similarity > 0.5 else 0
    Max raw = 0.9 + 0.2 = 1.1 -> normalize to [0,1]
    """
    total = background_raw + similarity_bonus
    return float(min(1.0, total / 1.1))


def decide_final_status(
    combined_normalized: float,
    face_verified: bool,
    location_verified: bool,
    face_recognition_enabled: bool,
) -> str:
    """
    If face recognition is disabled, treat face check as satisfied for background decision.
    """
    effective_face = face_verified or not face_recognition_enabled
    if effective_face and location_verified:
        if combined_normalized >= 0.6:
            return "Present"
        return "Present (Low Confidence)"
    return "Rejected"


def validate_captured_image(
    image_bgr: np.ndarray,
    room_slug: str,
    face_verified: bool,
    location_verified: bool,
    face_recognition_enabled: bool,
) -> Dict[str, Any]:
    """
    Full pipeline. Never raises for model failures — returns low scores instead.

    Returns dict with: detected_objects, similarity_score, background_score, final_status,
    combined_score (normalized 0-1), similarity_bonus_applied (bool)
    """
    detected_labels, chair_count, has_table, has_lm = run_object_detection(image_bgr)
    bg_raw = compute_background_component(chair_count, has_table, has_lm)

    captured_prep = prepare_for_similarity(image_bgr)
    refs = load_reference_images(room_slug)
    max_sim = max_reference_similarity(captured_prep, refs)
    sim_bonus = 0.2 if max_sim > 0.5 else 0.0
    combined = normalize_combined(bg_raw, sim_bonus)
    final_status = decide_final_status(combined, face_verified, location_verified, face_recognition_enabled)

    # Deduplicate labels for display
    seen = set()
    unique_labels: List[str] = []
    for x in detected_labels:
        if x not in seen:
            seen.add(x)
            unique_labels.append(x)

    return {
        "detected_objects": unique_labels,
        "similarity_score": round(max_sim, 4),
        "background_score": round(bg_raw, 4),
        "final_status": final_status,
        "combined_score": round(combined, 4),
        "chair_count": chair_count,
        "similarity_bonus_applied": sim_bonus > 0,
    }


def validate_from_base64(
    b64: Optional[str],
    room_slug: str,
    face_verified: bool,
    location_verified: bool,
    face_recognition_enabled: bool,
) -> Optional[Dict[str, Any]]:
    if not b64:
        return None
    img = decode_base64_image(b64)
    if img is None:
        return {
            "detected_objects": [],
            "similarity_score": 0.0,
            "background_score": 0.0,
            "final_status": "Rejected",
            "combined_score": 0.0,
            "chair_count": 0,
            "similarity_bonus_applied": False,
            "error": "invalid_image",
        }
    return validate_captured_image(img, room_slug, face_verified, location_verified, face_recognition_enabled)
