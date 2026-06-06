# MongoDB Atlas Configuration Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MongoDB Atlas Configuration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Your MongoDB Atlas connection details
$atlasUri = "mongodb+srv://hashan9053_db_user:Iw9jrhQraKqCmIrV@smart-waste-cluster.1unznof.mongodb.net/smartwaste?retryWrites=true&w=majority&appName=smart-waste-cluster"

Write-Host "Configuring backend to use MongoDB Atlas..." -ForegroundColor Green
Write-Host ""

# Create/update .env file
$envPath = "backend\.env"

if (-not (Test-Path "backend")) {
    New-Item -ItemType Directory -Path "backend" -Force | Out-Null
    Write-Host "Created backend directory" -ForegroundColor Gray
}

if (Test-Path $envPath) {
    $timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backup = "$envPath.backup.$timestamp"
    Copy-Item $envPath $backup
    Write-Host "Backed up existing .env to: $backup" -ForegroundColor Gray
}

$envContent = @'
# Smart Waste Management System - Environment Configuration
# Configured for MongoDB Atlas

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
Write-Host "✅ Created/updated backend/.env file!" -ForegroundColor Green
Write-Host "📍 MongoDB Atlas URI configured" -ForegroundColor Gray
Write-Host ""

# Test connection
Write-Host "Testing MongoDB Atlas connection..." -ForegroundColor Green
Write-Host ""

try {
    $testScript = @'
const mongoose = require('mongoose');
const uri = process.env.MONGODB_URI || 'mongodb+srv://hashan9053_db_user:Iw9jrhQraKqCmIrV@smart-waste-cluster.1unznof.mongodb.net/smartwaste?retryWrites=true&w=majority&appName=smart-waste-cluster';

mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
})
.then(() => {
    console.log('✅ MongoDB Atlas connection successful!');
    console.log('📊 Database:', mongoose.connection.name);
    console.log('🌐 Host:', mongoose.connection.host);
    process.exit(0);
})
.catch((err) => {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
});
'@

    $testScriptPath = "$env:TEMP\test-atlas-connection.js"
    $testScript | Out-File -FilePath $testScriptPath -Encoding UTF8

    Write-Host "Running connection test..." -ForegroundColor Gray
    $result = & node $testScriptPath 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host $result -ForegroundColor Green
    } else {
        Write-Host $result -ForegroundColor Red
        Write-Host ""
        Write-Host "⚠️  Connection test failed. Please check:" -ForegroundColor Yellow
        Write-Host "  1. Your IP address is whitelisted in MongoDB Atlas" -ForegroundColor White
        Write-Host "  2. Your cluster is running (not paused)" -ForegroundColor White
        Write-Host "  3. Your username and password are correct" -ForegroundColor White
    }

    Remove-Item $testScriptPath -ErrorAction SilentlyContinue
} catch {
    Write-Host "⚠️  Could not test connection: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Configuration Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Summary:" -ForegroundColor Cyan
Write-Host "  ✅ Backend .env configured for MongoDB Atlas" -ForegroundColor White
Write-Host "  📍 Cluster: smart-waste-cluster" -ForegroundColor White
Write-Host "  📊 Database: smartwaste" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Verify your IP is whitelisted in MongoDB Atlas:" -ForegroundColor White
Write-Host "     https://cloud.mongodb.com/ → Network Access" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Start your backend:" -ForegroundColor White
Write-Host "     cd backend" -ForegroundColor Gray
Write-Host "     npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Verify connection in logs:" -ForegroundColor White
Write-Host "     Look for: '✅ Connected to MongoDB successfully'" -ForegroundColor Gray
Write-Host ""
Write-Host "  4. Access MongoDB Atlas Dashboard:" -ForegroundColor White
Write-Host "     https://cloud.mongodb.com/" -ForegroundColor Gray
Write-Host ""

