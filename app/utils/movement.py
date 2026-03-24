from app.utils.geofence import haversine_distance


def detect_movement(
    prev_lat: float,
    prev_lon: float,
    curr_lat: float,
    curr_lon: float,
    time_diff_seconds: float
) -> dict:
    """
    Detect if student is moving or stationary based on location change.
    
    Args:
        prev_lat: Previous latitude
        prev_lon: Previous longitude
        curr_lat: Current latitude
        curr_lon: Current longitude
        time_diff_seconds: Time elapsed between pings in seconds
    
    Returns:
        Dictionary with movement status, distance moved, and speed
    """
    # Calculate distance moved
    distance = haversine_distance(prev_lat, prev_lon, curr_lat, curr_lon)
    
    # Calculate speed (meters per second)
    speed = distance / time_diff_seconds if time_diff_seconds > 0 else 0
    
    # Movement threshold: 0.5 m/s (~1.8 km/h, slow walking speed)
    # Below this is considered stationary (accounting for GPS drift)
    MOVEMENT_THRESHOLD = 0.5
    
    status = "STATIONARY" if speed < MOVEMENT_THRESHOLD else "MOVING"
    
    return {
        "status": status,
        "distance_moved": round(distance, 2),
        "speed": round(speed, 2)
    }


def calculate_next_ping_interval(movement_status: str, inside_geofence: bool) -> int:
    """
    Calculate adaptive ping interval in seconds based on movement and location.
    
    Rules:
    - STATIONARY + INSIDE → 60 seconds (low frequency, save battery)
    - STATIONARY + OUTSIDE → 30 seconds (medium frequency, monitor)
    - MOVING + INSIDE → 30 seconds (medium frequency, normal movement)
    - MOVING + OUTSIDE → 15 seconds (high frequency, potential exit)
    
    Args:
        movement_status: "STATIONARY" or "MOVING"
        inside_geofence: True if inside geofence, False otherwise
    
    Returns:
        Recommended ping interval in seconds
    """
    if movement_status == "STATIONARY" and inside_geofence:
        return 60  # Low frequency
    elif movement_status == "MOVING" and not inside_geofence:
        return 15  # High frequency (alert!)
    else:
        return 30  # Medium frequency


def analyze_movement_pattern(location_pings: list) -> dict:
    """
    Analyze movement pattern from a list of location pings.
    
    Args:
        location_pings: List of LocationPing objects
    
    Returns:
        Dictionary with movement analysis
    """
    if len(location_pings) < 2:
        return {
            "total_distance": 0,
            "average_speed": 0,
            "max_speed": 0,
            "mostly_stationary": True
        }
    
    total_distance = 0
    speeds = []
    
    for i in range(1, len(location_pings)):
        prev_ping = location_pings[i - 1]
        curr_ping = location_pings[i]
        
        distance = haversine_distance(
            prev_ping.latitude,
            prev_ping.longitude,
            curr_ping.latitude,
            curr_ping.longitude
        )
        
        time_diff = (curr_ping.timestamp - prev_ping.timestamp).total_seconds()
        speed = distance / time_diff if time_diff > 0 else 0
        
        total_distance += distance
        speeds.append(speed)
    
    avg_speed = sum(speeds) / len(speeds) if speeds else 0
    max_speed = max(speeds) if speeds else 0
    
    # Consider mostly stationary if average speed < 0.3 m/s
    mostly_stationary = avg_speed < 0.3
    
    return {
        "total_distance": round(total_distance, 2),
        "average_speed": round(avg_speed, 2),
        "max_speed": round(max_speed, 2),
        "mostly_stationary": mostly_stationary
    }
