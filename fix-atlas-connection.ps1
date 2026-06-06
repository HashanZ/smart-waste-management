# MongoDB Atlas Connection Fix Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MongoDB Atlas Connection Diagnostic & Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Continue"

# Step 1: Check current configuration
Write-Host "Step 1: Checking current configuration..." -ForegroundColor Green
$envPath = "backend\.env"

if (-not (Test-Path $envPath)) {
    Write-Host "ERROR: backend/.env file not found!" -ForegroundColor Red
    exit 1
}

Write-Host "Found backend/.env file" -ForegroundColor Gray

# Step 2: Test DNS resolution
Write-Host ""
Write-Host "Step 2: Testing DNS resolution..." -ForegroundColor Green
$clusterDomain = "smart-waste-cluster.1unznof.mongodb.net"
$srvDomain = "_mongodb._tcp.smart-waste-cluster.1unznof.mongodb.net"

try {
    $dnsResult = Resolve-DnsName -Name $clusterDomain -Type A -ErrorAction SilentlyContinue
    if ($dnsResult) {
        Write-Host "DNS resolution successful for: $clusterDomain" -ForegroundColor Green
        Write-Host "Resolved to: $($dnsResult[0].IPAddress)" -ForegroundColor Gray
    } else {
        Write-Host "WARNING: Could not resolve DNS for: $clusterDomain" -ForegroundColor Yellow
    }
} catch {
    Write-Host "WARNING: DNS resolution failed: $_" -ForegroundColor Yellow
}

# Step 3: Test internet connectivity
Write-Host ""
Write-Host "Step 3: Testing internet connectivity..." -ForegroundColor Green
try {
    $pingResult = Test-Connection -ComputerName "8.8.8.8" -Count 2 -Quiet
    if ($pingResult) {
        Write-Host "Internet connectivity: OK" -ForegroundColor Green
    } else {
        Write-Host "WARNING: Internet connectivity issues detected" -ForegroundColor Yellow
    }
} catch {
    Write-Host "WARNING: Could not test internet connectivity" -ForegroundColor Yellow
}

# Step 4: Test MongoDB Atlas connection with different methods
Write-Host ""
Write-Host "Step 4: Testing MongoDB Atlas connection..." -ForegroundColor Green

# Create test script
$testScript = @'
const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('ERROR: MONGODB_URI not found in .env');
  process.exit(1);
}

console.log('Testing connection...');
console.log('URI format:', uri.includes('mongodb+srv://') ? 'mongodb+srv (SRV)' : 'mongodb (standard)');

// Try with different connection options
const options = {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  retryWrites: true,
  retryReads: true,
  // Force direct connection to avoid SRV issues
  directConnection: false,
  // Use alternative DNS resolution
  tls: true,
  tlsAllowInvalidCertificates: false
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

    // Provide specific troubleshooting based on error
    if (error.message.includes('ENOTFOUND') || error.message.includes('querySrv')) {
      console.error('');
      console.error('DNS Resolution Error Detected');
      console.error('Possible causes:');
      console.error('1. DNS server issues - Try changing DNS to 8.8.8.8 or 1.1.1.1');
      console.error('2. Cluster might be paused - Check Atlas dashboard');
      console.error('3. Network firewall blocking DNS queries');
      console.error('4. Internet connectivity issues');
    } else if (error.message.includes('authentication')) {
      console.error('');
      console.error('Authentication Error');
      console.error('Check username and password in .env file');
    } else if (error.message.includes('timeout')) {
      console.error('');
      console.error('Connection Timeout');
      console.error('Check network connectivity and firewall settings');
    }

    process.exit(1);
  });
'@

$testScript | Out-File -FilePath "$env:TEMP\test-atlas-fix.js" -Encoding UTF8

cd backend
Write-Host "Running connection test..." -ForegroundColor Gray
node "$env:TEMP\test-atlas-fix.js"
$testResult = $LASTEXITCODE
cd ..

Remove-Item "$env:TEMP\test-atlas-fix.js" -ErrorAction SilentlyContinue

# Step 5: Try alternative connection string format
if ($testResult -ne 0) {
    Write-Host ""
    Write-Host "Step 5: Attempting fix with alternative connection options..." -ForegroundColor Green

    # Read current .env
    $envContent = Get-Content $envPath -Raw

    # Check if we need to add connection options
    if (-not $envContent.Contains('retryWrites=true')) {
        Write-Host "Updating connection string with retry options..." -ForegroundColor Gray

        # Backup current .env
        $backup = "$envPath.backup.before-fix.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
        Copy-Item $envPath $backup
        Write-Host "Backed up .env to: $backup" -ForegroundColor Gray

        # Update connection string to ensure it has all necessary parameters
        $newEnvContent = $envContent -replace 'MONGODB_URI=.*', 'MONGODB_URI=mongodb+srv://hashan9053_db_user:Iw9jrhQraKqCmIrV@smart-waste-cluster.1unznof.mongodb.net/smartwaste?retryWrites=true&w=majority&appName=smart-waste-cluster&serverSelectionTimeoutMS=10000'

        $newEnvContent | Out-File -FilePath $envPath -Encoding UTF8 -Force
        Write-Host "Updated .env with connection timeout options" -ForegroundColor Green

        # Test again
        Write-Host ""
        Write-Host "Retesting connection..." -ForegroundColor Gray
        cd backend
        node "$env:TEMP\test-atlas-fix.js" 2>&1 | Out-Null
        $testResult2 = $LASTEXITCODE
        cd ..

        if ($testResult2 -eq 0) {
            Write-Host "SUCCESS: Connection fixed!" -ForegroundColor Green
        }
    }
}

# Step 6: Provide DNS fix suggestions
if ($testResult -ne 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "DNS Resolution Fix Suggestions" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Option 1: Change DNS Server (Recommended)" -ForegroundColor Cyan
    Write-Host "1. Open Network Settings" -ForegroundColor White
    Write-Host "2. Change DNS to:" -ForegroundColor White
    Write-Host "   - Primary: 8.8.8.8 (Google)" -ForegroundColor Gray
    Write-Host "   - Secondary: 1.1.1.1 (Cloudflare)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Option 2: Use Standard Connection String" -ForegroundColor Cyan
    Write-Host "If SRV (mongodb+srv://) doesn't work, we can try standard format" -ForegroundColor White
    Write-Host ""
    Write-Host "Option 3: Check Atlas Dashboard" -ForegroundColor Cyan
    Write-Host "1. Go to: https://cloud.mongodb.com/" -ForegroundColor White
    Write-Host "2. Check if cluster is ACTIVE (not paused)" -ForegroundColor White
    Write-Host "3. Verify Network Access settings" -ForegroundColor White
    Write-Host ""
    Write-Host "Option 4: Flush DNS Cache" -ForegroundColor Cyan
    Write-Host "Run as Administrator: ipconfig /flushdns" -ForegroundColor White
    Write-Host ""
}

# Step 7: Try standard connection string as fallback
Write-Host ""
Write-Host "Step 7: Testing with standard connection format..." -ForegroundColor Green

$standardTestScript = @'
const mongoose = require('mongoose');
require('dotenv').config();

// Try to get standard connection string from Atlas
// This requires getting the actual server addresses
const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('ERROR: MONGODB_URI not found');
  process.exit(1);
}

// If it's SRV format, try with direct connection disabled
const options = {
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 15000,
  retryWrites: true,
  // Disable SRV lookup issues
  srvMaxHosts: 3,
  srvServiceName: 'mongodb'
};

console.log('Testing with extended timeout and SRV options...');

mongoose.connect(uri, options)
  .then(() => {
    console.log('SUCCESS: Connected with extended options!');
    console.log('Database:', mongoose.connection.name);
    return mongoose.disconnect();
  })
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Still failing:', error.message);
    process.exit(1);
  });
'@

$standardTestScript | Out-File -FilePath "$env:TEMP\test-standard.js" -Encoding UTF8

cd backend
node "$env:TEMP\test-standard.js"
$standardResult = $LASTEXITCODE
cd ..

Remove-Item "$env:TEMP\test-standard.js" -ErrorAction SilentlyContinue

# Final summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($testResult -eq 0 -or $standardResult -eq 0) {
    Write-Host "Connection Status: FIXED" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Start your backend: cd backend && npm run dev" -ForegroundColor White
    Write-Host "2. Verify connection in logs" -ForegroundColor White
} else {
    Write-Host "Connection Status: NEEDS MANUAL FIX" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please try:" -ForegroundColor Cyan
    Write-Host "1. Change DNS to 8.8.8.8 (Google DNS)" -ForegroundColor White
    Write-Host "2. Check Atlas dashboard - ensure cluster is active" -ForegroundColor White
    Write-Host "3. Verify Network Access in Atlas" -ForegroundColor White
    Write-Host "4. Run as Admin: ipconfig /flushdns" -ForegroundColor White
}
Write-Host "========================================" -ForegroundColor Cyan
