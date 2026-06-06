# MongoDB Installation and Auto-Configuration Script
# This script downloads, installs mongosh, and configures MongoDB for the Smart Waste Management project

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MongoDB Installation & Configuration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "⚠️  Warning: Not running as Administrator. Some operations may require elevation." -ForegroundColor Yellow
    Write-Host ""
}

# Step 1: Download mongosh installer
Write-Host "📥 Step 1: Downloading MongoDB Shell (mongosh)..." -ForegroundColor Green
$downloadUrl = "https://downloads.mongodb.com/compass/mongosh-2.5.9-x64.msi"
$downloadPath = "$env:TEMP\mongosh-2.5.9-x64.msi"

try {
    Write-Host "   Downloading from: $downloadUrl" -ForegroundColor Gray
    Invoke-WebRequest -Uri $downloadUrl -OutFile $downloadPath -UseBasicParsing
    Write-Host "   ✅ Download complete: $downloadPath" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Download failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Install mongosh
Write-Host "🔧 Step 2: Installing MongoDB Shell..." -ForegroundColor Green
try {
    $installArgs = "/i `"$downloadPath`" /quiet /norestart"
    $process = Start-Process -FilePath "msiexec.exe" -ArgumentList $installArgs -Wait -PassThru -NoNewWindow

    if ($process.ExitCode -eq 0) {
        Write-Host "   ✅ MongoDB Shell installed successfully!" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Installation completed with exit code: $($process.ExitCode)" -ForegroundColor Yellow
        Write-Host "   (Exit code 3010 means success but requires reboot)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ Installation failed: $_" -ForegroundColor Red
    exit 1
}

# Clean up installer
if (Test-Path $downloadPath) {
    Remove-Item $downloadPath -Force
    Write-Host "   🗑️  Cleaned up installer file" -ForegroundColor Gray
}

Write-Host ""

# Step 3: Refresh PATH environment variable
Write-Host "🔄 Step 3: Refreshing environment variables..." -ForegroundColor Green
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Wait a moment for PATH to update
Start-Sleep -Seconds 2

# Verify mongosh installation
Write-Host "   Checking mongosh installation..." -ForegroundColor Gray
try {
    $mongoshVersion = & mongosh --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ mongosh is installed and accessible!" -ForegroundColor Green
        Write-Host "   Version: $($mongoshVersion -split "`n" | Select-Object -First 1)" -ForegroundColor Gray
    } else {
        Write-Host "   ⚠️  mongosh may not be in PATH yet. You may need to restart your terminal." -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️  Could not verify mongosh. It may be installed but not in PATH yet." -ForegroundColor Yellow
    Write-Host "   Try restarting your terminal or manually add to PATH:" -ForegroundColor Gray
    Write-Host "   C:\Program Files\mongosh\" -ForegroundColor Gray
}

Write-Host ""

# Step 4: Check MongoDB service status
Write-Host "🔍 Step 4: Checking MongoDB service status..." -ForegroundColor Green
try {
    $mongoService = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
    if ($mongoService) {
        if ($mongoService.Status -eq "Running") {
            Write-Host "   ✅ MongoDB service is running!" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  MongoDB service exists but is not running." -ForegroundColor Yellow
            Write-Host "   Attempting to start MongoDB service..." -ForegroundColor Gray
            try {
                Start-Service -Name "MongoDB" -ErrorAction Stop
                Write-Host "   ✅ MongoDB service started successfully!" -ForegroundColor Green
            } catch {
                Write-Host "   ❌ Failed to start MongoDB service: $_" -ForegroundColor Red
                Write-Host "   You may need to run this script as Administrator." -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "   ⚠️  MongoDB service not found. MongoDB may not be installed." -ForegroundColor Yellow
        Write-Host "   You can install MongoDB Community Server from:" -ForegroundColor Gray
        Write-Host "   https://www.mongodb.com/try/download/community" -ForegroundColor Gray
        Write-Host ""
        Write-Host "   Or use Docker MongoDB:" -ForegroundColor Gray
        Write-Host "   docker compose up -d mongodb" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ⚠️  Could not check MongoDB service: $_" -ForegroundColor Yellow
}

Write-Host ""

# Step 5: Test MongoDB connection
Write-Host "🧪 Step 5: Testing MongoDB connection..." -ForegroundColor Green
$mongoUri = "mongodb://localhost:27017/smartwaste"
Write-Host "   Testing connection to: $mongoUri" -ForegroundColor Gray

try {
    # Try using mongosh if available
    $mongoshTest = & mongosh --quiet --eval "db.adminCommand('ping')" 2>&1
    if ($LASTEXITCODE -eq 0 -or $mongoshTest -match "ok.*1") {
        Write-Host "   ✅ MongoDB connection successful!" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Could not connect to MongoDB. Service may not be running." -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️  Could not test connection with mongosh: $_" -ForegroundColor Yellow
    Write-Host "   (This is OK if MongoDB service is not running yet)" -ForegroundColor Gray
}

Write-Host ""

# Step 6: Configure backend/.env file
Write-Host "⚙️  Step 6: Configuring backend/.env file..." -ForegroundColor Green

$backendEnvPath = "backend\.env"
$envContent = @'
# Smart Waste Management System - Environment Configuration
# Auto-configured by install-mongodb.ps1

# ===========================================
# DATABASE CONFIGURATION
# ===========================================
# Local MongoDB connection (default)
MONGODB_URI=mongodb://localhost:27017/smartwaste

# Alternative: MongoDB Atlas (uncomment to use)
# MONGODB_URI=mongodb+srv://hashan9053_db_user:Iw9jrhQraKqCmIrV@smart-waste-cluster.1unznof.mongodb.net/smartwaste?retryWrites=true&w=majority&appName=smart-waste-cluster

# ===========================================
# SERVER CONFIGURATION
# ===========================================
API_PORT=3000
NODE_ENV=development

# ===========================================
# JWT AUTHENTICATION
# ===========================================
JWT_SECRET=your-super-secret-jwt-key-here-change-this-in-production
JWT_EXPIRES_IN=24h

# ===========================================
# CORS CONFIGURATION
# ===========================================
CORS_ORIGIN=http://localhost:3000,http://localhost:3001,http://localhost:5173

# ===========================================
# REDIS CONFIGURATION (Optional)
# ===========================================
# REDIS_URL=redis://localhost:6379

# ===========================================
# MQTT CONFIGURATION (Optional)
# ===========================================
# MQTT_BROKER_URL=mqtt://localhost:1883
# MQTT_CLIENT_ID=smart-waste-backend

# ===========================================
# ML SERVICE CONFIGURATION
# ===========================================
ML_SERVICE_URL=http://localhost:8001
ML_SERVICE_API_KEY=ml-secret-token

# ===========================================
# MONITORING CONFIGURATION
# ===========================================
LOG_LEVEL=info
ENABLE_METRICS=false
'@

# Check if backend directory exists
if (-not (Test-Path "backend")) {
    Write-Host "   ⚠️  Backend directory not found. Creating it..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path "backend" -Force | Out-Null
}

# Check if .env already exists
if (Test-Path $backendEnvPath) {
    Write-Host "   ⚠️  .env file already exists!" -ForegroundColor Yellow
    $timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backupPath = "$backendEnvPath.backup.$timestamp"
    Copy-Item $backendEnvPath $backupPath
    Write-Host "   📋 Backed up existing .env to: $backupPath" -ForegroundColor Gray
}

# Write new .env file
try {
    $envContent | Out-File -FilePath $backendEnvPath -Encoding UTF8 -Force
    Write-Host "   ✅ Created/updated backend/.env file!" -ForegroundColor Green
    Write-Host "   📍 MongoDB URI: mongodb://localhost:27017/smartwaste" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Failed to create .env file: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 7: Create database if it doesn't exist
Write-Host "🗄️  Step 7: Setting up database..." -ForegroundColor Green
try {
    # Try to connect and create database
    $createDbScript = @'
use smartwaste
db.createCollection('test')
db.test.insertOne({test: 'connection', timestamp: new Date()})
db.test.drop()
print('Database smartwaste is ready!')
'@

    $initDbPath = Join-Path $env:TEMP "init-db.js"
    $createDbScript | Out-File -FilePath $initDbPath -Encoding UTF8

    try {
        $result = & mongosh mongodb://localhost:27017 --quiet --file $initDbPath 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Database 'smartwaste' is ready!" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  Could not initialize database. MongoDB may not be running." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   ⚠️  Could not initialize database: $_" -ForegroundColor Yellow
        Write-Host "   (This is OK if MongoDB service is not running yet)" -ForegroundColor Gray
    }

    Remove-Item $initDbPath -ErrorAction SilentlyContinue
} catch {
    Write-Host "   ⚠️  Database setup skipped: $_" -ForegroundColor Yellow
}

Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Summary:" -ForegroundColor Cyan
Write-Host "  ✅ MongoDB Shell (mongosh) installed" -ForegroundColor White
Write-Host "  ✅ Backend .env file configured for local MongoDB" -ForegroundColor White
Write-Host "  📍 Connection: mongodb://localhost:27017/smartwaste" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. If MongoDB service is not running, start it:" -ForegroundColor White
Write-Host "     Start-Service MongoDB" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Or use Docker MongoDB:" -ForegroundColor White
Write-Host "     docker compose up -d mongodb" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Test the connection:" -ForegroundColor White
Write-Host "     mongosh mongodb://localhost:27017/smartwaste" -ForegroundColor Gray
Write-Host ""
Write-Host "  4. Start your backend:" -ForegroundColor White
Write-Host "     cd backend" -ForegroundColor Gray
Write-Host "     npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "  5. Verify connection in backend logs:" -ForegroundColor White
Write-Host "     Look for: '✅ Connected to MongoDB successfully'" -ForegroundColor Gray
Write-Host ""
Write-Host "💡 Tip: If mongosh command doesn't work, restart your terminal" -ForegroundColor Yellow
Write-Host "   or manually add to PATH: C:\Program Files\mongosh\" -ForegroundColor Yellow
Write-Host ""

