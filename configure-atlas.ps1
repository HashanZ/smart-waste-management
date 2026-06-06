# MongoDB Atlas Configuration Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MongoDB Atlas Configuration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Atlas connection string
$atlasUri = "mongodb+srv://hashan9053_db_user:Iw9jrhQraKqCmIrV@smart-waste-cluster.1unznof.mongodb.net/smartwaste?retryWrites=true&w=majority&appName=smart-waste-cluster"

Write-Host "Configuring backend for MongoDB Atlas..." -ForegroundColor Green
Write-Host ""

# Create/update .env file
$envPath = "backend\.env"

if (-not (Test-Path "backend")) {
    New-Item -ItemType Directory -Path "backend" -Force | Out-Null
    Write-Host "Created backend directory" -ForegroundColor Gray
}

if (Test-Path $envPath) {
    $backup = "$envPath.backup.atlas.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    Copy-Item $envPath $backup
    Write-Host "Backed up existing .env to: $backup" -ForegroundColor Gray
}

$envContent = @'
# Smart Waste Management System - Environment Configuration
# Configured for MongoDB Atlas (Cloud)

# ===========================================
# DATABASE CONFIGURATION
# ===========================================
# MongoDB Atlas Connection String
MONGODB_URI=mongodb+srv://hashan9053_db_user:Iw9jrhQraKqCmIrV@smart-waste-cluster.1unznof.mongodb.net/smartwaste?retryWrites=true&w=majority&appName=smart-waste-cluster

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
Write-Host "MongoDB Atlas URI configured" -ForegroundColor Gray
Write-Host "Cluster: smart-waste-cluster.1unznof.mongodb.net" -ForegroundColor Gray
Write-Host "Database: smartwaste" -ForegroundColor Gray
Write-Host ""

# Test connection using existing test file
Write-Host "Testing MongoDB Atlas connection..." -ForegroundColor Green
Write-Host ""

if (Test-Path "backend\test-db-connection.js") {
    cd backend
    node test-db-connection.js
    $testResult = $LASTEXITCODE
    cd ..

    if ($testResult -eq 0) {
        Write-Host ""
        Write-Host "MongoDB Atlas connection verified!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "Connection test failed. Please check:" -ForegroundColor Yellow
        Write-Host "1. Your IP address is whitelisted in Atlas Network Access" -ForegroundColor White
        Write-Host "2. Your cluster is not paused" -ForegroundColor White
        Write-Host "3. Your credentials are correct" -ForegroundColor White
    }
} else {
    Write-Host "Creating test script..." -ForegroundColor Gray
    $testScript = @'
const mongoose = require('mongoose');
const uri = 'mongodb+srv://hashan9053_db_user:Iw9jrhQraKqCmIrV@smart-waste-cluster.1unznof.mongodb.net/smartwaste?retryWrites=true&w=majority&appName=smart-waste-cluster';

async function test() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB Atlas successfully!');
    console.log('Database:', mongoose.connection.name);
    console.log('Host:', mongoose.connection.host);
    await mongoose.disconnect();
    console.log('Disconnected');
    process.exit(0);
  } catch (error) {
    console.error('Connection failed:', error.message);
    process.exit(1);
  }
}
test();
'@

    $testScript | Out-File -FilePath "backend\test-atlas-connection.js" -Encoding UTF8

    cd backend
    node test-atlas-connection.js
    $testResult = $LASTEXITCODE
    cd ..

    if ($testResult -eq 0) {
        Write-Host ""
        Write-Host "MongoDB Atlas connection verified!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "Connection test failed. Please check:" -ForegroundColor Yellow
        Write-Host "1. Your IP address is whitelisted in Atlas Network Access" -ForegroundColor White
        Write-Host "2. Your cluster is not paused" -ForegroundColor White
        Write-Host "3. Your credentials are correct" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Configuration Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Verify Atlas Network Access:" -ForegroundColor White
Write-Host "   - Go to: https://cloud.mongodb.com/" -ForegroundColor Gray
Write-Host "   - Network Access -> Add IP Address" -ForegroundColor Gray
Write-Host "   - Add your current IP or 0.0.0.0/0 (for development)" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Verify Cluster Status:" -ForegroundColor White
Write-Host "   - Make sure cluster is not paused" -ForegroundColor Gray
Write-Host "   - Cluster should show 'Active' status" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Start your backend:" -ForegroundColor White
Write-Host "   cd backend" -ForegroundColor Gray
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Check connection in logs:" -ForegroundColor White
Write-Host "   Look for: 'Connected to MongoDB successfully'" -ForegroundColor Gray
Write-Host ""
