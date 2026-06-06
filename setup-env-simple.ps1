Write-Host "Creating backend/.env file..."

$content = "PORT=3000`nNODE_ENV=development`nMONGODB_URI=mongodb://localhost:27017/smartwaste`nJWT_SECRET=your-super-secret-jwt-key-change-this-in-production-123456789`nJWT_EXPIRE=7d`nCORS_ORIGIN=http://localhost:3001`nML_SERVICE_URL=http://localhost:8000`nMQTT_BROKER_URL=mqtt://localhost:1883`nMQTT_USERNAME=`nMQTT_PASSWORD="

$content | Out-File -FilePath "backend/.env" -Encoding UTF8

Write-Host "Done! Created backend/.env file"
Write-Host "Next: Restart backend and create bins"















































