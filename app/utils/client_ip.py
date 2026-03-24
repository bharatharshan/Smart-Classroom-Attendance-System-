"""Extract client IP from request, honoring X-Forwarded-For (first hop) when behind a proxy."""
from fastapi import Request


def _normalize_ip(ip: str) -> str:
    ip = (ip or "").strip()
    if ip.startswith("::ffff:"):
        return ip[7:]
    return ip


def get_client_ip(request: Request) -> str:
    """
    Prefer X-Forwarded-For (comma-separated chain) — use leftmost client IP.
    Then X-Real-IP (common behind nginx). Falls back to request.client.host.

    Note: If you open the app at http://127.0.0.1 or the dev proxy talks to the API
    over loopback, the address will be 127.0.0.1. Use your LAN URL (e.g.
    http://192.168.x.x:5173) so the browser connection has a real LAN IP; with Vite's
    proxy we forward that as X-Forwarded-For.
    """
    xff = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
    if xff:
        first = xff.split(",")[0].strip()
        if first:
            return _normalize_ip(first)
    xri = request.headers.get("x-real-ip") or request.headers.get("X-Real-IP")
    if xri:
        return _normalize_ip(xri.strip())
    if request.client and request.client.host:
        return _normalize_ip(request.client.host)
    return "0.0.0.0"


def is_loopback(ip: str) -> bool:
    ip = (ip or "").strip()
    return ip in ("127.0.0.1", "::1", "localhost") or ip.startswith("127.")
