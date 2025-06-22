# Codex - Run Script
# PowerShell script to start the Codex application

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "Starting Codex - Internal Code Search System" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Check if virtual environment exists
if (-Not (Test-Path "venv")) {
    Write-Host "Error: Virtual environment not found." -ForegroundColor Red
    Write-Host "Please run deploy.bat first to set up the application." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Green
& "venv\Scripts\Activate.ps1"

# Check if PostgreSQL service is running
$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
if ($pgService -and $pgService.Status -ne "Running") {
    Write-Host "Warning: PostgreSQL service is not running." -ForegroundColor Yellow
    Write-Host "Starting PostgreSQL service..." -ForegroundColor Yellow
    Start-Service $pgService.Name
}

# Start the Flask application
Write-Host ""
Write-Host "Starting Codex application..." -ForegroundColor Green
Write-Host "The application will be available at:" -ForegroundColor Yellow
Write-Host "  - http://localhost:5000" -ForegroundColor Cyan
Write-Host "  - http://codex.local (if configured)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Run the application
python backend\app.py
