#!/usr/bin/env python3
import sqlite3
import json

# Connect to the database
conn = sqlite3.connect('smart_classroom.db')
cursor = conn.cursor()

# Get all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()

print("🗄️ Database Tables:")
for table in tables:
    print(f"  - {table[0]}")

print("\n" + "="*50)

# Check students table
if ('students',) in tables:
    print("\n👥 Students Table:")
    cursor.execute("SELECT id, student_id, name, email, department, year, is_active, created_at FROM students LIMIT 5;")
    students = cursor.fetchall()
    
    if students:
        print("  Columns: id, student_id, name, email, department, year, is_active, created_at")
        for student in students:
            print(f"  ID: {student[0][:8]}..., Student ID: {student[1]}, Name: {student[2]}, Email: {student[3]}, Dept: {student[4]}, Year: {student[5]}, Active: {student[6]}, Created: {student[7]}")
    else:
        print("  No students found")
else:
    print("\n❌ Students table not found")

print("\n" + "="*50)

# Check attendance table
if ('attendance',) in tables:
    print("\n📊 Attendance Table:")
    cursor.execute("SELECT COUNT(*) FROM attendance;")
    attendance_count = cursor.fetchone()[0]
    print(f"  Total attendance records: {attendance_count}")
else:
    print("\n❌ Attendance table not found")

print("\n" + "="*50)

# Check classes table
if ('classes',) in tables:
    print("\n📚 Classes Table:")
    cursor.execute("SELECT COUNT(*) FROM classes;")
    class_count = cursor.fetchone()[0]
    print(f"  Total classes: {class_count}")
else:
    print("\n❌ Classes table not found")

conn.close()
print("\n✅ Database check complete!")
