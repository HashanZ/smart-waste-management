# Create .env file for backend

Write-Host "🔧 Creating backend/.env file..." -ForegroundColor Cyan

$envContent = @"
# Server Configuration
PORT=3000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/smartwaste

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-123456789
JWT_EXPIRE=7d

# CORS Configuration
CORS_ORIGIN=http://localhost:3001

# ML Service Configuration
ML_SERVICE_URL=http://localhost:8000

# MQTT Configuration
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=
MQTT_PASSWORD=
"@

$envPath = Join-Path $PSScriptRoot "backend\.env"

if (Test-Path $envPath) {
    Write-Host "⚠️  .env file already exists at: $envPath" -ForegroundColor Yellow
    $response = Read-Host "Do you want to overwrite it? (y/n)"
    if ($response -ne "y") {
        Write-Host "❌ Cancelled. Keeping existing .env file." -ForegroundColor Red
        exit
    }
}

try {
    $envContent | Out-File -FilePath $envPath -Encoding UTF8 -NoNewline
    Write-Host "✅ Successfully created: $envPath" -ForegroundColor Green

    Write-Host "`n📋 File contents:" -ForegroundColor Cyan
    Write-Host "─" * 60
    Write-Host $envContent
    Write-Host "─" * 60

    Write-Host "`n📍 Next steps:" -ForegroundColor Yellow
    Write-Host "   1. Restart backend: cd backend && npm run dev"
    Write-Host "   2. Create bins: node fix-bins-issue.js"
    Write-Host "   3. Test bins: node test-bins-api.js"
    Write-Host "   4. Open frontend: http://localhost:3001/bins"
    Write-Host ""

}
catch {
    Write-Host "❌ Error creating .env file: $_" -ForegroundColor Red
    Write-Host "`n💡 Try creating it manually:" -ForegroundColor Yellow
    Write-Host "   1. Navigate to: backend folder"
    Write-Host "   2. Create a file named: .env"
    Write-Host "   3. Copy content from CREATE_ENV_FILE.md"
}















































