import math


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two points on Earth using the Haversine formula.
    
    Args:
        lat1: Latitude of point 1 in decimal degrees
        lon1: Longitude of point 1 in decimal degrees
        lat2: Latitude of point 2 in decimal degrees
        lon2: Longitude of point 2 in decimal degrees
    
    Returns:
        Distance between the two points in meters
    
    Example:
        >>> haversine_distance(28.6139, 77.2090, 28.6140, 77.2091)
        14.87  # approximately 15 meters
    """
    # Earth's radius in meters
    R = 6371000
    
    # Convert degrees to radians
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    # Haversine formula
    a = (
        math.sin(delta_lat / 2) ** 2 +
        math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
    )
    c = 2 * math.asin(math.sqrt(a))
    
    # Distance in meters
    distance = R * c
    
    return distance


def is_inside_geofence(
    student_lat: float,
    student_lon: float,
    class_lat: float,
    class_lon: float,
    radius: float
) -> bool:
    """
    Check if a student's location is within the class geofence.
    
    Args:
        student_lat: Student's latitude
        student_lon: Student's longitude
        class_lat: Classroom's latitude
        class_lon: Classroom's longitude
        radius: Geofence radius in meters
    
    Returns:
        True if student is inside the geofence, False otherwise
    
    Example:
        >>> is_inside_geofence(28.6140, 77.2091, 28.6139, 77.2090, 50)
        True  # Student is ~15m away, within 50m radius
        
        >>> is_inside_geofence(28.6200, 77.2200, 28.6139, 77.2090, 50)
        False  # Student is ~1400m away, outside 50m radius
    """
    distance = haversine_distance(student_lat, student_lon, class_lat, class_lon)
    return distance <= radius


def get_distance_info(
    student_lat: float,
    student_lon: float,
    class_lat: float,
    class_lon: float,
    radius: float
) -> dict:
    """
    Get detailed distance information for debugging/logging.
    
    Args:
        student_lat: Student's latitude
        student_lon: Student's longitude
        class_lat: Classroom's latitude
        class_lon: Classroom's longitude
        radius: Geofence radius in meters
    
    Returns:
        Dictionary with distance, radius, and inside status
    """
    distance = haversine_distance(student_lat, student_lon, class_lat, class_lon)
    inside = distance <= radius
    
    return {
        "distance_meters": round(distance, 2),
        "radius_meters": radius,
        "inside_geofence": inside,
        "distance_from_boundary": round(radius - distance, 2)
    }
