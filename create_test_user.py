import requests

# Create a test user
user_data = {
    "student_id": "ST001",
    "name": "Test Faculty",
    "email": "faculty@test.com",
    "password": "test123",
    "department": "Computer Science",
    "year": "MCA 1st Year"
}

try:
    response = requests.post("http://localhost:8000/auth/register", json=user_data)
    print("Status Code:", response.status_code)
    print("Response:", response.text)
    
    if response.status_code == 201:
        print("✅ User created successfully!")
        
        # Now try to login
        login_data = {
            "email": "faculty@test.com",
            "password": "test123"
        }
        
        login_response = requests.post("http://localhost:8000/auth/login", json=login_data)
        print("\nLogin Status Code:", login_response.status_code)
        print("Login Response:", login_response.text)
        
        if login_response.status_code == 200:
            print("✅ Login successful!")
        else:
            print("❌ Login failed")
    else:
        print("❌ User creation failed")
        
except Exception as e:
    print("Error:", e)
