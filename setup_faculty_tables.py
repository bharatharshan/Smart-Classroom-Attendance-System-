#!/usr/bin/env python3
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import engine
from sqlalchemy import text

print("🔧 Adding Faculty Tables to PostgreSQL")
print("="*50)

try:
    with engine.connect() as connection:
        # Check if faculty table exists
        if 'postgresql' in str(engine.url):
            result = connection.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'faculty'
                );
            """))
        else:
            result = connection.execute(text("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='faculty';
            """))
        
        row = result.fetchone()
        table_exists = row[0] if row else False
        
        if not table_exists:
            print("⚠️  Faculty table not found. Creating tables...")
            
            # Import models to create tables
            from app.models.faculty import Faculty
            from app.models.timetable import Timetable
            
            # Create tables
            from app.database import Base
            Base.metadata.create_all(bind=engine)
            
            print("✅ Faculty and Timetable tables created successfully")
        else:
            print("✅ Faculty table already exists")
        
        # Verify tables
        if 'postgresql' in str(engine.url):
            result = connection.execute(text("""
                SELECT tablename FROM pg_tables 
                WHERE schemaname = 'public' 
                AND tablename IN ('faculty', 'timetables')
                ORDER BY tablename;
            """))
        else:
            result = connection.execute(text("""
                SELECT name FROM sqlite_master 
                WHERE type='table' 
                AND name IN ('faculty', 'timetables')
                ORDER BY name;
            """))
        
        tables = result.fetchall()
        print(f"\n✅ Verified faculty-related tables:")
        for table in tables:
            print(f"   - {table[0]}")
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n✅ Faculty tables setup complete!")
