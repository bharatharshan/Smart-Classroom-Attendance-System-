import requests

# Test login
login_data = {
    "email": "faculty@test.com",
    "password": "test"
}

try:
    response = requests.post("http://localhost:8000/faculty/auth/login", json=login_data)
    print("Login Status Code:", response.status_code)
    print("Login Response:", response.text)
    
    if response.status_code == 200:
        token_data = response.json()
        print("✅ Login successful!")
        print("Token:", token_data["access_token"][:50] + "...")
        
        # Test protected endpoint
        headers = {"Authorization": f"Bearer {token_data['access_token']}"}
        me_response = requests.get("http://localhost:8000/faculty/auth/me", headers=headers)
        print("\nMe Status Code:", me_response.status_code)
        print("Me Response:", me_response.text)
        
    else:
        print("❌ Login failed")
        
except Exception as e:
    print("Error:", e)
