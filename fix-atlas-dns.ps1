# MongoDB Atlas DNS Fix Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Fixing MongoDB Atlas Connection" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Flush DNS cache
Write-Host "Step 1: Flushing DNS cache..." -ForegroundColor Green
try {
    Start-Process -FilePath "ipconfig" -ArgumentList "/flushdns" -Wait -NoNewWindow -Verb RunAs -ErrorAction SilentlyContinue
    Write-Host "DNS cache flushed (may require admin rights)" -ForegroundColor Gray
} catch {
    Write-Host "Could not flush DNS (run as admin: ipconfig /flushdns)" -ForegroundColor Yellow
}

# Step 2: Update .env with better connection options
Write-Host ""
Write-Host "Step 2: Updating connection string with timeout options..." -ForegroundColor Green

$envPath = "backend\.env"

if (-not (Test-Path $envPath)) {
    Write-Host "ERROR: backend/.env not found!" -ForegroundColor Red
    exit 1
}

# Backup
$backup = "$envPath.backup.dns-fix.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
Copy-Item $envPath $backup
Write-Host "Backed up .env to: $backup" -ForegroundColor Gray

# Read current content
$envContent = Get-Content $envPath -Raw

# Update MONGODB_URI with better options
$newUri = "mongodb+srv://hashan9053_db_user:Iw9jrhQraKqCmIrV@smart-waste-cluster.1unznof.mongodb.net/smartwaste?retryWrites=true&w=majority&appName=smart-waste-cluster&serverSelectionTimeoutMS=30000&socketTimeoutMS=45000&connectTimeoutMS=30000"

# Replace the MONGODB_URI line
$envContent = $envContent -replace 'MONGODB_URI=.*', "MONGODB_URI=$newUri"

$envContent | Out-File -FilePath $envPath -Encoding UTF8 -Force
Write-Host "Updated .env with extended timeout options" -ForegroundColor Green

# Step 3: Update database.ts with better connection options
Write-Host ""
Write-Host "Step 3: Updating database connection configuration..." -ForegroundColor Green

$dbConfigPath = "backend\src\config\database.ts"

if (Test-Path $dbConfigPath) {
    $dbContent = Get-Content $dbConfigPath -Raw

    # Check if we need to add better connection options
    if (-not $dbContent.Contains('serverSelectionTimeoutMS')) {
        $backupDb = "$dbConfigPath.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
        Copy-Item $dbConfigPath $backupDb
        Write-Host "Backed up database.ts" -ForegroundColor Gray

        # Update mongoose.connect with better options
        $newDbConfig = $dbContent -replace "await mongoose.connect\(mongoUri, \{", @"
await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      retryWrites: true,
      retryReads: true,
"@

        $newDbConfig | Out-File -FilePath $dbConfigPath -Encoding UTF8 -Force
        Write-Host "Updated database.ts with extended timeout options" -ForegroundColor Green
    } else {
        Write-Host "database.ts already has timeout options" -ForegroundColor Gray
    }
} else {
    Write-Host "database.ts not found, skipping" -ForegroundColor Yellow
}

# Step 4: Test connection from backend directory
Write-Host ""
Write-Host "Step 4: Testing connection..." -ForegroundColor Green

$testScript = @'
const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('ERROR: MONGODB_URI not found');
  process.exit(1);
}

console.log('Connecting to MongoDB Atlas...');
console.log('Using extended timeout options...');

const options = {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000,
  retryWrites: true,
  retryReads: true
};

mongoose.connect(uri, options)
  .then(() => {
    console.log('SUCCESS: Connected to MongoDB Atlas!');
    console.log('Database:', mongoose.connection.name);
    console.log('Host:', mongoose.connection.host);
    return mongoose.disconnect();
  })
  .then(() => {
    console.log('Disconnected');
    process.exit(0);
  })
  .catch((error) => {
    console.error('ERROR:', error.message);

    if (error.message.includes('ENOTFOUND') || error.message.includes('querySrv')) {
      console.error('');
      console.error('DNS Resolution Error');
      console.error('Try these solutions:');
      console.error('1. Change DNS to 8.8.8.8 (Google) or 1.1.1.1 (Cloudflare)');
      console.error('2. Check if cluster is paused in Atlas dashboard');
      console.error('3. Verify Network Access in Atlas');
      console.error('4. Run: ipconfig /flushdns (as admin)');
    }

    process.exit(1);
  });
'@

$testScript | Out-File -FilePath "backend\test-connection-fix.js" -Encoding UTF8

cd backend
Write-Host "Running connection test from backend directory..." -ForegroundColor Gray
node test-connection-fix.js
$testResult = $LASTEXITCODE
cd ..

Remove-Item "backend\test-connection-fix.js" -ErrorAction SilentlyContinue

# Step 5: Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($testResult -eq 0) {
    Write-Host "SUCCESS: Connection Fixed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Changes made:" -ForegroundColor Cyan
    Write-Host "1. Updated .env with extended timeout options" -ForegroundColor White
    Write-Host "2. Updated database.ts with better connection options" -ForegroundColor White
    Write-Host "3. Connection test successful" -ForegroundColor White
    Write-Host ""
    Write-Host "Next: Start your backend with: cd backend && npm run dev" -ForegroundColor Cyan
} else {
    Write-Host "Connection still failing. Additional steps needed:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Change DNS Server:" -ForegroundColor Cyan
    Write-Host "   - Open Network Settings" -ForegroundColor White
    Write-Host "   - Set DNS to 8.8.8.8 (Google) or 1.1.1.1 (Cloudflare)" -ForegroundColor White
    Write-Host ""
    Write-Host "2. Check MongoDB Atlas:" -ForegroundColor Cyan
    Write-Host "   - Go to: https://cloud.mongodb.com/" -ForegroundColor White
    Write-Host "   - Verify cluster is ACTIVE (not paused)" -ForegroundColor White
    Write-Host "   - Check Network Access settings" -ForegroundColor White
    Write-Host ""
    Write-Host "3. Flush DNS (as Administrator):" -ForegroundColor Cyan
    Write-Host "   ipconfig /flushdns" -ForegroundColor White
    Write-Host ""
    Write-Host "4. Restart your computer" -ForegroundColor Cyan
}
Write-Host "========================================" -ForegroundColor Cyan










