from typing import Tuple


def calculate_confidence_score(attendance, location_pings: list = None) -> float:
    """
    Calculate attendance confidence score (0-100%) based on multiple factors.
    
    Scoring breakdown:
    1. Geofence compliance (50% weight) - How many pings were inside geofence
    2. Ping frequency (20% weight) - Did student ping regularly
    3. Movement patterns (15% weight) - Was student stationary (good) or moving (suspicious)
    4. Wi-Fi validation (15% weight) - Did Wi-Fi match expected classroom Wi-Fi
    
    Args:
        attendance: Attendance object
        location_pings: Optional list of LocationPing objects for detailed analysis
    
    Returns:
        Confidence score between 0 and 100
    """
    score = 0.0
    
    # 1. Geofence Compliance (50 points max)
    if attendance.total_pings > 0:
        geofence_ratio = attendance.inside_geofence_pings / attendance.total_pings
        score += geofence_ratio * 50
    else:
        # No pings = low confidence (only entry/exit)
        score += 25  # Give some credit for basic entry/exit
    
    # 2. Ping Frequency (20 points max)
    if attendance.duration_minutes and attendance.duration_minutes > 0:
        # Expected: approximately 1 ping per minute
        # For a 90-minute class, expect ~90 pings (with adaptive frequency, could be 60-90)
        expected_pings = attendance.duration_minutes * 0.75  # Account for adaptive frequency
        
        if attendance.total_pings > 0:
            ping_ratio = min(attendance.total_pings / expected_pings, 1.0)
            score += ping_ratio * 20
        else:
            score += 5  # Minimal credit if no pings
    else:
        # Class still in progress or very short duration
        if attendance.total_pings > 5:
            score += 15  # Good ping activity
        elif attendance.total_pings > 0:
            score += 10  # Some ping activity
    
    # 3. Movement Patterns (15 points max)
    if not attendance.movement_detected:
        # Stationary is good (student sitting in class)
        score += 15
    else:
        # Some movement is okay, but less confident
        score += 8
    
    # 4. Wi-Fi Validation (15 points max)
    if location_pings:
        wifi_validated_count = sum(
            1 for ping in location_pings 
            if ping.wifi_ssid is not None and ping.wifi_ssid != ""
        )
        
        if wifi_validated_count > 0 and attendance.total_pings > 0:
            wifi_ratio = wifi_validated_count / attendance.total_pings
            score += wifi_ratio * 15
        else:
            # No Wi-Fi validation, give partial credit
            score += 5
    else:
        # No ping data available, give partial credit
        score += 5
    
    return round(min(score, 100.0), 2)


def get_confidence_level(score: float) -> str:
    """
    Get confidence level description based on score.
    
    Args:
        score: Confidence score (0-100)
    
    Returns:
        Confidence level string
    """
    if score >= 90:
        return "VERY HIGH"
    elif score >= 75:
        return "HIGH"
    elif score >= 60:
        return "MEDIUM"
    elif score >= 40:
        return "LOW"
    else:
        return "VERY LOW"


def should_flag_for_review(attendance) -> Tuple[bool, str]:

    """
    Determine if attendance should be flagged for manual review.
    
    Args:
        attendance: Attendance object
    
    Returns:
        Tuple of (should_flag, reason)
    """
    reasons = []
    
    # Flag if confidence is too low
    if attendance.confidence_score and attendance.confidence_score < 60:
        reasons.append(f"Low confidence score ({attendance.confidence_score}%)")
    
    # Flag if too many outside geofence pings
    if attendance.total_pings > 0:
        outside_ratio = attendance.outside_geofence_pings / attendance.total_pings
        if outside_ratio > 0.3:  # More than 30% outside
            reasons.append(f"{int(outside_ratio * 100)}% pings outside geofence")
    
    # Flag if auto-exited
    if attendance.auto_exited:
        reasons.append("Auto-exited (left geofence)")
    
    # Flag if very few pings for long class
    if attendance.duration_minutes and attendance.duration_minutes > 30:
        if attendance.total_pings < 5:
            reasons.append("Very few location pings")
    
    should_flag = len(reasons) > 0
    reason = "; ".join(reasons) if reasons else "No issues"
    
    return should_flag, reason
