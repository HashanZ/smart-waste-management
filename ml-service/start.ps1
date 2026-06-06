# Start ML Service
Write-Host "Starting ML Service..." -ForegroundColor Cyan

# Prefer the project .venv Python to avoid corrupted system site-packages
$VenvPython = Join-Path $PSScriptRoot "..\.venv\Scripts\python.exe"
if (Test-Path $VenvPython) {
    $PythonExe = $VenvPython
    Write-Host "Using project .venv Python: $VenvPython" -ForegroundColor Green
} else {
    $PythonExe = "python"
    Write-Host "No .venv found, using system Python" -ForegroundColor Yellow
}

# Verify Python works
try {
    $pythonVersion = & $PythonExe --version 2>&1
    Write-Host "Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "Python not found! Please install Python or create the .venv first." -ForegroundColor Red
    exit 1
}

# Check if dependencies are installed
Write-Host "Checking dependencies..." -ForegroundColor Yellow
$depCheck = & $PythonExe -c "import fastapi, uvicorn" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    & $PythonExe -m pip install -r requirements.txt
} else {
    Write-Host "Dependencies OK" -ForegroundColor Green
}

# Set port to 8888 (avoids Windows port restrictions)
$env:ML_SERVICE_PORT = "8888"
$env:ML_SERVICE_HOST = "127.0.0.1"

Write-Host ""
Write-Host "Starting ML Service on http://127.0.0.1:8888" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

# Start the service
& $PythonExe main.py
