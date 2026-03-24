"""Seed classrooms: 101, 102, 811, 812, 813, 814, 815, 816.
   Room 101: lat 12.930001, long 77.604696. Others get nearby values."""
from app.database import get_db
from app.models.classroom import Classroom


ROOMS = [
    {"room_id": "101", "room_name": "101", "latitude": 12.930001, "longitude": 77.604696},
    {"room_id": "102", "room_name": "102", "latitude": 13.044969332162152, "longitude": 77.61295540598807},
    {"room_id": "103", "room_name": "103", "latitude": 13.043432, "longitude": 77.625022},
    {"room_id": "811", "room_name": "811", "latitude": 12.930223, "longitude": 77.604928},
    {"room_id": "812", "room_name": "812", "latitude": 12.930334, "longitude": 77.605044},
    {"room_id": "813", "room_name": "813", "latitude": 12.930445, "longitude": 77.605160},
    {"room_id": "814", "room_name": "814", "latitude": 12.930556, "longitude": 77.605276},
    {"room_id": "815", "room_name": "815", "latitude": 12.930667, "longitude": 77.605392},
    {"room_id": "816", "room_name": "816", "latitude": 12.930778, "longitude": 77.605508},
]
ALLOWED_RADIUS = 100.0


def seed_classrooms():
    db = next(get_db())
    try:
        for r in ROOMS:
            existing = db.query(Classroom).filter(Classroom.room_id == r["room_id"]).first()
            if not existing:
                room = Classroom(
                    room_id=r["room_id"],
                    room_name=r["room_name"],
                    latitude=r["latitude"],
                    longitude=r["longitude"],
                    allowed_radius=ALLOWED_RADIUS,
                )
                db.add(room)
                print(f"Created room {r['room_id']}")
            else:
                print(f"Room {r['room_id']} already exists")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed_classrooms()
