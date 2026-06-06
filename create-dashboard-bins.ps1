# Create 4 test bins for dashboard
$loginBody = @{
    email = 'admin@example.com'
    password = 'password123'
} | ConvertTo-Json

$login = Invoke-RestMethod -Uri 'http://localhost:3000/api/auth/login' -Method Post -Body $loginBody -ContentType 'application/json'
$token = $login.data.token

$bins = @(
    @{
        binId = 'DASH-001'
        binType = 'general'
        capacity = 100
        currentLevel = 55
        location = @{
            latitude = 6.9271
            longitude = 79.8612
            address = 'Test Location 1'
        }
        status = 'active'
        collectionFrequency = 24
    },
    @{
        binId = 'DASH-002'
        binType = 'recyclable'
        capacity = 100
        currentLevel = 78
        location = @{
            latitude = 6.9341
            longitude = 79.8509
            address = 'Test Location 2'
        }
        status = 'active'
        collectionFrequency = 24
    },
    @{
        binId = 'DASH-003'
        binType = 'organic'
        capacity = 100
        currentLevel = 65
        location = @{
            latitude = 6.9404
            longitude = 79.8533
            address = 'Test Location 3'
        }
        status = 'active'
        collectionFrequency = 24
    },
    @{
        binId = 'DASH-004'
        binType = 'general'
        capacity = 100
        currentLevel = 88
        location = @{
            latitude = 6.9320
            longitude = 79.8438
            address = 'Test Location 4'
        }
        status = 'active'
        collectionFrequency = 24
    }
)

$created = 0
foreach ($bin in $bins) {
    try {
        $result = Invoke-RestMethod -Uri 'http://localhost:3000/api/bins' `
            -Method Post `
            -Body ($bin | ConvertTo-Json -Depth 3) `
            -ContentType 'application/json' `
            -Headers @{ Authorization = "Bearer $token" }
        Write-Host "OK Created: $($bin.binId)" -ForegroundColor Green
        $created++
    } catch {
        Write-Host "Failed: $($bin.binId) - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Summary: Created $created out of $($bins.Count) bins" -ForegroundColor Cyan

