# Workforce App PowerShell Zip Script
$projectRoot = $PSScriptRoot
$parentDir = Split-Path -Path $projectRoot -Parent
$outputZip = Join-Path -Path $parentDir -ChildPath "workforce-app.zip"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "       Workforce App Zip Export Tool (PowerShell)" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Source: $projectRoot"
Write-Host "Destination: $outputZip"
Write-Host "Excluding node_modules, venv, __pycache__, .git, dist..." -ForegroundColor Yellow

tar -a -c -f "$outputZip" --exclude="node_modules" --exclude="venv" --exclude=".venv" --exclude="__pycache__" --exclude=".git" --exclude="dist" -C "$parentDir" "workforce-app"

if (Test-Path $outputZip) {
    $sizeMb = [math]::Round((Get-Item $outputZip).Length / 1MB, 2)
    Write-Host "`nSUCCESS! Zip archive created successfully." -ForegroundColor Green
    Write-Host "File location: $outputZip ($sizeMb MB)" -ForegroundColor Green
} else {
    Write-Host "`nFailed to create zip archive." -ForegroundColor Red
}
Write-Host "==================================================" -ForegroundColor Cyan
