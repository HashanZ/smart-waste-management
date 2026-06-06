# MongoDB Configuration Script
Write-Host "Configuring MongoDB for Smart Waste Management..." -ForegroundColor Cyan
Write-Host ""

# Refresh PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
Start-Sleep -Seconds 2

# Check mongosh
Write-Host "Checking mongosh installation..." -ForegroundColor Green
try {
    $version = & mongosh --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "mongosh is available!" -ForegroundColor Green
    } else {
        Write-Host "mongosh may need terminal restart" -ForegroundColor Yellow
    }
} catch {
    Write-Host "mongosh not in PATH yet (restart terminal)" -ForegroundColor Yellow
}

Write-Host ""

# Check MongoDB service
Write-Host "Checking MongoDB service..." -ForegroundColor Green
try {
    $service = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
    if ($service) {
        if ($service.Status -eq "Running") {
            Write-Host "MongoDB service is running!" -ForegroundColor Green
        } else {
            Write-Host "MongoDB service exists but is stopped" -ForegroundColor Yellow
            Write-Host "Attempting to start..." -ForegroundColor Gray
            try {
                Start-Service -Name "MongoDB" -ErrorAction Stop
                Write-Host "MongoDB service started!" -ForegroundColor Green
            } catch {
                Write-Host "Could not start service (may need admin rights)" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "MongoDB service not found" -ForegroundColor Yellow
        Write-Host "You can use Docker: docker compose up -d mongodb" -ForegroundColor Gray
    }
} catch {
    Write-Host "Could not check MongoDB service" -ForegroundColor Yellow
}

Write-Host ""

# Create/update .env file
Write-Host "Configuring backend/.env file..." -ForegroundColor Green
$envPath = "backend\.env"

if (-not (Test-Path "backend")) {
    New-Item -ItemType Directory -Path "backend" -Force | Out-Null
}

if (Test-Path $envPath) {
    $backup = "$envPath.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    Copy-Item $envPath $backup
    Write-Host "Backed up existing .env to: $backup" -ForegroundColor Gray
}

$envContent = @'
# Smart Waste Management System - Environment Configuration
# Auto-configured for local MongoDB

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

$envContent | Out-File -FilePath $envPath -Encoding UTF8 -Force
Write-Host "Created/updated backend/.env file!" -ForegroundColor Green
Write-Host "MongoDB URI: mongodb://localhost:27017/smartwaste" -ForegroundColor Gray

Write-Host ""
Write-Host "Configuration complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Start MongoDB (if not running): Start-Service MongoDB" -ForegroundColor White
Write-Host "2. Or use Docker: docker compose up -d mongodb" -ForegroundColor White
Write-Host "3. Test connection: mongosh mongodb://localhost:27017/smartwaste" -ForegroundColor White
Write-Host "4. Start backend: cd backend && npm run dev" -ForegroundColor White










