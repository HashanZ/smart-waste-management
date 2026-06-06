# Smart Waste Management System Setup Script (PowerShell)
# This script sets up the development environment on Windows

param(
    [switch]$SkipDocker,
    [switch]$SkipMobile
)

Write-Host "🚀 Setting up Smart Waste Management System..." -ForegroundColor Green

# Function to print colored output
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check if required tools are installed
function Test-Requirements {
    Write-Info "Checking requirements..."
    
    # Check Node.js
    try {
        $nodeVersion = node --version
        Write-Info "Node.js version: $nodeVersion"
    }
    catch {
        Write-Error "Node.js is not installed. Please install Node.js 18 or higher."
        exit 1
    }
    
    # Check npm
    try {
        $npmVersion = npm --version
        Write-Info "npm version: $npmVersion"
    }
    catch {
        Write-Error "npm is not installed. Please install npm."
        exit 1
    }
    
    # Check Python
    try {
        $pythonVersion = python --version
        Write-Info "Python version: $pythonVersion"
    }
    catch {
        Write-Error "Python 3 is not installed. Please install Python 3.11 or higher."
        exit 1
    }
    
    # Check Docker (optional)
    if (-not $SkipDocker) {
        try {
            $dockerVersion = docker --version
            Write-Info "Docker version: $dockerVersion"
        }
        catch {
            Write-Warning "Docker is not installed. Docker is required for running the full stack."
        }
        
        try {
            $dockerComposeVersion = docker-compose --version
            Write-Info "Docker Compose version: $dockerComposeVersion"
        }
        catch {
            Write-Warning "Docker Compose is not installed. Docker Compose is required for running the full stack."
        }
    }
    
    Write-Info "Requirements check completed."
}

# Install root dependencies
function Install-RootDependencies {
    Write-Info "Installing root dependencies..."
    npm install
    Write-Info "Root dependencies installed."
}

# Initialize backend
function Initialize-Backend {
    Write-Info "Setting up backend..."
    Set-Location backend
    
    # Install dependencies
    npm install
    
    # Create .env file if it doesn't exist
    if (-not (Test-Path .env)) {
        Write-Info "Creating .env file from example..."
        Copy-Item env.example .env
        Write-Warning "Please update the .env file with your actual configuration values."
    }
    
    # Build the project
    npm run build
    
    Set-Location ..
    Write-Info "Backend setup completed."
}

# Initialize web dashboard
function Initialize-WebDashboard {
    Write-Info "Setting up web dashboard..."
    Set-Location web-dashboard
    
    # Install dependencies
    npm install
    
    # Create .env file if it doesn't exist
    if (-not (Test-Path .env)) {
        Write-Info "Creating .env file..."
        @"
REACT_APP_API_URL=http://localhost:3000
REACT_APP_WS_URL=http://localhost:3000
GENERATE_SOURCEMAP=false
"@ | Out-File -FilePath .env -Encoding UTF8
    }
    
    Set-Location ..
    Write-Info "Web dashboard setup completed."
}

# Initialize ML service
function Initialize-MLService {
    Write-Info "Setting up ML service..."
    Set-Location ml-service
    
    # Create virtual environment
    python -m venv venv
    
    # Activate virtual environment (Windows)
    & ".\venv\Scripts\Activate.ps1"
    
    # Install dependencies
    pip install -r requirements.txt
    
    Set-Location ..
    Write-Info "ML service setup completed."
}

# Initialize mobile app
function Initialize-MobileApp {
    if ($SkipMobile) {
        Write-Info "Skipping mobile app setup..."
        return
    }
    
    Write-Info "Setting up mobile app..."
    Set-Location mobile-app
    
    # Check if Flutter is installed
    try {
        $flutterVersion = flutter --version
        Write-Info "Flutter version: $flutterVersion"
        
        # Get Flutter dependencies
        flutter pub get
    }
    catch {
        Write-Warning "Flutter is not installed. Please install Flutter to work with the mobile app."
    }
    
    Set-Location ..
    Write-Info "Mobile app setup completed."
}

# Initialize E2E tests
function Initialize-E2ETests {
    Write-Info "Setting up E2E tests..."
    Set-Location tests/e2e
    
    # Install dependencies
    npm install
    
    # Install Playwright browsers
    npx playwright install
    
    Set-Location ../..
    Write-Info "E2E tests setup completed."
}

# Create necessary directories
function New-Directories {
    Write-Info "Creating necessary directories..."
    
    # Create logs directory
    New-Item -ItemType Directory -Force -Path "logs" | Out-Null
    
    # Create uploads directory
    New-Item -ItemType Directory -Force -Path "uploads" | Out-Null
    
    # Create data directories for ML service
    New-Item -ItemType Directory -Force -Path "ml-service\data" | Out-Null
    New-Item -ItemType Directory -Force -Path "ml-service\models" | Out-Null
    
    Write-Info "Directories created."
}

# Main setup function
function Main {
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "Smart Waste Management System Setup" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    
    Test-Requirements
    Install-RootDependencies
    Initialize-Backend
    Initialize-WebDashboard
    Initialize-MLService
    Initialize-MobileApp
    Initialize-E2ETests
    New-Directories
    
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Info "Setup completed successfully! 🎉"
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Update the .env files with your actual configuration"
    Write-Host "2. Start the development servers:"
    Write-Host "   - npm run dev (starts all services)"
    Write-Host "   - npm run dev:backend (backend only)"
    Write-Host "   - npm run dev:web (web dashboard only)"
    Write-Host "   - npm run dev:ml (ML service only)"
    Write-Host ""
    Write-Host "3. Or use Docker:"
    Write-Host "   - docker-compose up -d"
    Write-Host ""
    Write-Host "For more information, check the documentation in the docs/ folder."
}

# Run main function
Main











