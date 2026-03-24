#!/usr/bin/env python3
"""
Script to update existing student year/class records to use the new class format
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from app.config import settings

def update_student_classes():
    """Update existing student records to use new class format"""
    
    # Create database engine
    engine = create_engine(settings.database_url)
    
    # Mapping of old formats to new class formats
    class_mapping = {
        'MCA 1st Year': '1MCA-A',
        'MCA 2nd Year': '1MCA-B', 
        'MCA 3rd Year': '6MCA-A',
        'MCA 4th Year': '6MCA-B',
        '1st Year': '1MCA-A',
        '2nd Year': '1MCA-B',
        '3rd Year': '6MCA-A',
        '4th Year': '6MCA-B',
        'First Year': '1MCA-A',
        'Second Year': '1MCA-B',
        'Third Year': '6MCA-A',
        'Fourth Year': '6MCA-B',
    }
    
    with engine.connect() as connection:
        # Get all students with year values
        result = connection.execute(text("SELECT id, year FROM students WHERE year IS NOT NULL"))
        students = result.fetchall()
        
        updated_count = 0
        for student_id, current_year in students:
            # Check if current year needs updating
            if current_year in class_mapping:
                new_class = class_mapping[current_year]
                connection.execute(
                    text("UPDATE students SET year = :new_class WHERE id = :student_id"),
                    {"new_class": new_class, "student_id": student_id}
                )
                updated_count += 1
                print(f"Updated student {student_id}: {current_year} -> {new_class}")
        
        # Commit changes
        connection.commit()
        
        print(f"\n✅ Successfully updated {updated_count} student records")
        print("🎓 Classes updated to: 1MCA-A, 1MCA-B, 6MCA-A, 6MCA-B")

if __name__ == "__main__":
    try:
        update_student_classes()
        print("\n🚀 Student class migration completed successfully!")
    except Exception as e:
        print(f"❌ Error during migration: {e}")
        sys.exit(1)
