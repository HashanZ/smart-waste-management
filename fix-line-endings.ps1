#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Convert all code files to LF line endings
.DESCRIPTION
    This script converts CRLF line endings to LF for all code files in the project
.EXAMPLE
    .\fix-line-endings.ps1
#>

Write-Host "🔧 Converting Line Endings to LF..." -ForegroundColor Cyan
Write-Host "=" * 60

# File extensions to convert
$extensions = @(
    "*.js", "*.jsx", "*.ts", "*.tsx",
    "*.json", "*.md", "*.yml", "*.yaml",
    "*.html", "*.css", "*.scss",
    "*.py", "*.dart", "*.sh",
    "*.gradle", "*.xml"
)

# Directories to exclude
$excludeDirs = @(
    "node_modules", ".git", "build", "dist",
    ".dart_tool", ".pub-cache", "android_disabled"
)

# Counter
$totalFiles = 0
$convertedFiles = 0
$skippedFiles = 0

# Get all files
$files = Get-ChildItem -Recurse -Include $extensions |
Where-Object {
    $file = $_
    $shouldInclude = $true

    foreach ($dir in $excludeDirs) {
        if ($file.FullName -like "*\$dir\*" -or $file.FullName -like "*/$dir/*") {
            $shouldInclude = $false
            break
        }
    }

    $shouldInclude
}

Write-Host "`n📊 Found $($files.Count) files to check`n"

foreach ($file in $files) {
    $totalFiles++

    try {
        # Read file content
        $content = Get-Content $file.FullName -Raw -ErrorAction Stop

        # Check if file has CRLF
        if ($content -match "`r`n") {
            # Convert CRLF to LF
            $content = $content -replace "`r`n", "`n"

            # Write back to file
            [System.IO.File]::WriteAllText($file.FullName, $content)

            $convertedFiles++
            Write-Host "✅ Converted: $($file.Name)" -ForegroundColor Green
        }
        else {
            $skippedFiles++
            Write-Host "⏭️  Skipped (already LF): $($file.Name)" -ForegroundColor Gray
        }
    }
    catch {
        Write-Host "❌ Error processing $($file.Name): $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Summary
Write-Host "`n" + ("=" * 60)
Write-Host "`n📊 Summary:" -ForegroundColor Cyan
Write-Host "   Total files checked:   $totalFiles"
Write-Host "   ✅ Converted to LF:    $convertedFiles" -ForegroundColor Green
Write-Host "   ⏭️  Already LF:         $skippedFiles" -ForegroundColor Gray

if ($convertedFiles -gt 0) {
    Write-Host "`n🎉 Successfully converted $convertedFiles files to LF line endings!" -ForegroundColor Green
    Write-Host "`n📍 Next steps:" -ForegroundColor Yellow
    Write-Host "   1. Close and reopen Cursor"
    Write-Host "   2. Files should no longer show as changed"
    Write-Host "   3. You can now commit without line ending issues`n"
}
else {
    Write-Host "`n✅ All files already have LF line endings! Nothing to do.`n" -ForegroundColor Green
}
