@echo off
REM Codex - Internal Code Search System
REM Windows Deployment Script

echo ===============================================
echo Codex Deployment Script
echo ===============================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://www.python.org/
    pause
    exit /b 1
)

REM Check if PostgreSQL is installed
psql --version >nul 2>&1
if errorlevel 1 (
    echo Warning: PostgreSQL is not in PATH
    echo Make sure PostgreSQL is installed and running
    echo.
)

REM Create virtual environment
echo Creating Python virtual environment...
python -m venv venv
if errorlevel 1 (
    echo Error: Failed to create virtual environment
    pause
    exit /b 1
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo Installing Python dependencies...
pip install --upgrade pip
pip install -r requirements.txt
if errorlevel 1 (
    echo Error: Failed to install dependencies
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist .env (
    echo Error: .env file not found
    echo Please copy .env.example to .env and configure it
    echo.
    echo IMPORTANT: If your database password contains special characters
    echo like @ or #, they will be handled automatically.
    pause
    exit /b 1
)

REM Run database setup
echo.
echo Setting up database...
python backend\app\scripts\setup_database.py
if errorlevel 1 (
    echo Error: Database setup failed
    echo.
    echo Common issues:
    echo 1. PostgreSQL is not running
    echo 2. Database credentials in .env are incorrect
    echo 3. Database user does not have permission to create databases
    pause
    exit /b 1
)

REM Create necessary directories
echo.
echo Creating directories...
if not exist logs mkdir logs
if not exist file_storage mkdir file_storage
if not exist backups mkdir backups

REM Display success message
echo.
echo ===============================================
echo Deployment completed successfully!
echo ===============================================
echo.
echo Default admin credentials:
echo   Username: admin
echo   Password: admin123
echo.
echo To start the application:
echo 1. Activate virtual environment: venv\Scripts\activate
echo 2. Run the application: python backend\app.py
echo.
echo The application will be available at:
echo http://localhost:5000 or http://codex.local
echo.
echo To configure for network access:
echo 1. Update hosts file to map codex.local to server IP
echo 2. Configure firewall to allow port 5000
echo.
pause
