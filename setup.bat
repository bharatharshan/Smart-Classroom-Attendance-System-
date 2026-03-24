@echo off
echo ========================================
echo Smart Classroom Attendance System Setup
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.9+ from https://www.python.org/
    pause
    exit /b 1
)

echo [1/5] Python found!
echo.

REM Check if .env file exists
if not exist .env (
    echo [2/5] Creating .env file from template...
    copy .env.example .env
    echo.
    echo IMPORTANT: Please edit .env file and update:
    echo   - DATABASE_PASSWORD with your PostgreSQL password
    echo   - SECRET_KEY with a secure random key
    echo.
    echo Generate a secure SECRET_KEY by running:
    echo   python -c "import secrets; print(secrets.token_hex(32))"
    echo.
    pause
) else (
    echo [2/5] .env file already exists
    echo.
)

REM Create virtual environment if it doesn't exist
if not exist venv (
    echo [3/5] Creating virtual environment...
    python -m venv venv
    echo Virtual environment created!
    echo.
) else (
    echo [3/5] Virtual environment already exists
    echo.
)

REM Activate virtual environment and install dependencies
echo [4/5] Installing dependencies...
call venv\Scripts\activate.bat
pip install -r requirements.txt
echo.

echo [5/5] Setup complete!
echo.
echo ========================================
echo Next Steps:
echo ========================================
echo 1. Make sure PostgreSQL is installed and running
echo 2. Create database: CREATE DATABASE smart_classroom_db;
echo 3. Edit .env file with your database credentials
echo 4. Run the server: uvicorn app.main:app --reload
echo 5. Access Swagger UI: http://localhost:8000/docs
echo ========================================
echo.
pause
