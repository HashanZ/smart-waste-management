Write-Host "Converting Line Endings to LF..." -ForegroundColor Cyan

$extensions = @("*.js", "*.jsx", "*.ts", "*.tsx", "*.json", "*.md", "*.yml", "*.yaml", "*.html", "*.css", "*.scss", "*.py", "*.dart")

$excludeDirs = @("node_modules", ".git", "build", "dist", ".dart_tool", ".pub-cache", "android_disabled")

$totalFiles = 0
$convertedFiles = 0

$files = Get-ChildItem -Recurse -Include $extensions | Where-Object {
    $file = $_
    $shouldInclude = $true
    foreach ($dir in $excludeDirs) {
        if ($file.FullName -like "*\$dir\*") {
            $shouldInclude = $false
            break
        }
    }
    $shouldInclude
}

Write-Host "Found $($files.Count) files to check"

foreach ($file in $files) {
    $totalFiles++
    try {
        $content = Get-Content $file.FullName -Raw -ErrorAction Stop
        if ($content -match "`r`n") {
            $content = $content -replace "`r`n", "`n"
            [System.IO.File]::WriteAllText($file.FullName, $content)
            $convertedFiles++
            Write-Host "Converted: $($file.Name)" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "Error: $($file.Name)" -ForegroundColor Red
    }
}

Write-Host "`nSummary:" -ForegroundColor Cyan
Write-Host "  Total checked: $totalFiles"
Write-Host "  Converted: $convertedFiles" -ForegroundColor Green
Write-Host "`nDone! Close and reopen Cursor.`n" -ForegroundColor Green















































