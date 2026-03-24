# Smart Classroom Attendance System — expose ASGI app for `uvicorn app:app`.
# Lazy load avoids import-order issues when the package is imported as a namespace only.


def __getattr__(name: str):
    if name == "app":
        from app.main import app as _app

        return _app
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = ["app"]
