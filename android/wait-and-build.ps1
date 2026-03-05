$targetFile = "app\google-services.json"
$checkInterval = 2

Write-Host "Waiting for google-services.json..." -ForegroundColor Yellow
Write-Host "Save the file to: $pwd\$targetFile" -ForegroundColor White
Write-Host "Press Ctrl+C to cancel" -ForegroundColor DarkGray

while (-not (Test-Path $targetFile)) {
    Write-Host "." -NoNewline -ForegroundColor Cyan
    Start-Sleep -Seconds $checkInterval
}

Write-Host ""
Write-Host "File detected! Building..." -ForegroundColor Green
.\gradlew.bat assembleRelease bundleRelease

if ($LASTEXITCODE -eq 0) {
    Write-Host "BUILD SUCCESSFUL!" -ForegroundColor Green
    Write-Host "APK: app\build\outputs\apk\release\app-release.apk" -ForegroundColor White
    Write-Host "AAB: app\build\outputs\bundle\release\app-release.aab" -ForegroundColor White
} else {
    Write-Host "BUILD FAILED" -ForegroundColor Red
}
