# Simple MongoDB Shell Installation Script
$ErrorActionPreference = "Stop"

Write-Host "Downloading MongoDB Shell..." -ForegroundColor Green
$url = "https://downloads.mongodb.com/compass/mongosh-2.5.9-x64.msi"
$out = "$env:TEMP\mongosh-2.5.9-x64.msi"

Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
Write-Host "Download complete!" -ForegroundColor Green

Write-Host "Installing MongoDB Shell..." -ForegroundColor Green
$installArgs = "/i `"$out`" /quiet /norestart"
Start-Process -FilePath "msiexec.exe" -ArgumentList $installArgs -Wait -NoNewWindow

Write-Host "Installation complete!" -ForegroundColor Green
Write-Host "Cleaning up..." -ForegroundColor Gray
Remove-Item $out -Force -ErrorAction SilentlyContinue

Write-Host "Done! Please restart your terminal for mongosh to be available in PATH." -ForegroundColor Yellow










