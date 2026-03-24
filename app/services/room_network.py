"""
Per-room IP prefix validation (e.g. cosol3 → 192.168.29.*).
Configurable via settings.room_network_prefixes_json for future rooms (811, 812, ...).
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List

from app.config import settings

logger = logging.getLogger(__name__)


def _load_prefix_map() -> Dict[str, List[str]]:
    raw = getattr(settings, "room_network_prefixes_json", "") or "{}"
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            return {str(k): [str(p) for p in v] if isinstance(v, list) else [str(v)] for k, v in data.items()}
    except json.JSONDecodeError as e:
        logger.warning("Invalid room_network_prefixes_json: %s", e)
    return {}


def ip_matches_room(ip: str, room_slug: str) -> bool:
    """
    True if ip starts with any configured prefix for room_slug.
    Loopback addresses are always valid for local dev/testing.
    """
    from app.utils.client_ip import is_loopback

    ip = (ip or "").strip()
    if is_loopback(ip):
        return True

    prefixes = _load_prefix_map().get(room_slug) or []
    if not prefixes:
        # No prefixes configured for this room → do not claim verified (soft fail)
        return False

    for prefix in prefixes:
        p = prefix.strip()
        if not p:
            continue
        if ip.startswith(p):
            return True
    return False


def default_room_slug() -> str:
    return getattr(settings, "background_room_slug", "cosol3") or "cosol3"
