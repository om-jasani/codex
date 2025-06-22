@echo off
REM Codex - Production Server Script
REM Uses Gunicorn for better performance

echo ===============================================
echo Starting Codex Production Server
echo ===============================================
echo.

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Check if Gunicorn is installed
python -c "import gunicorn" 2>nul
if errorlevel 1 (
    echo Gunicorn not found. Installing...
    pip install gunicorn
)

REM Start Gunicorn server
echo Starting Gunicorn server...
echo Server will be available at:
echo   - http://localhost:5000
echo   - http://codex.local (if configured)
echo.
echo Press Ctrl+C to stop the server
echo.

gunicorn --config gunicorn_config.py backend.app:create_app()

pause
