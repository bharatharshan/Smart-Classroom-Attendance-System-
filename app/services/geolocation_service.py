"""Geo-based verification using Haversine distance."""
from app.utils.geofence import haversine_distance, get_distance_info, is_inside_geofence


def verify_geolocation(
    student_lat: float,
    student_lon: float,
    room_lat: float,
    room_lon: float,
    allowed_radius_meters: float = 20.0,
) -> dict:
    """
    Verify student is within allowed radius of classroom using Haversine formula.
    Returns dict with verified (bool), distance_meters, inside_geofence, message.
    """
    distance = haversine_distance(student_lat, student_lon, room_lat, room_lon)
    inside = distance <= allowed_radius_meters
    return {
        "verified": inside,
        "distance_meters": round(distance, 2),
        "inside_geofence": inside,
        "allowed_radius_meters": allowed_radius_meters,
        "message": (
            f"Within {allowed_radius_meters}m" if inside
            else f"Outside geofence: {distance:.1f}m away (max {allowed_radius_meters}m)"
        ),
    }


def get_class_geofence_from_room(room_lat: float, room_lon: float, allowed_radius: float) -> dict:
    """Return geofence params for a room (for use in attendance verification)."""
    return {
        "latitude": room_lat,
        "longitude": room_lon,
        "radius": allowed_radius,
    }
