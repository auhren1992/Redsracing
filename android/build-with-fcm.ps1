# Build script for Android with FCM check

$googleServicesPath = "app\google-services.json"

Write-Host "Checking for google-services.json..." -ForegroundColor Cyan

if (Test-Path $googleServicesPath) {
    Write-Host "✓ google-services.json found!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Building Android release bundle..." -ForegroundColor Cyan
    .\gradlew.bat assembleRelease bundleRelease
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓ Build successful!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Output files:" -ForegroundColor Yellow
        Write-Host "  APK: app\build\outputs\apk\release\app-release.apk" -ForegroundColor White
        Write-Host "  AAB: app\build\outputs\bundle\release\app-release.aab" -ForegroundColor White
    } else {
        Write-Host ""
        Write-Host "✗ Build failed!" -ForegroundColor Red
    }
} else {
    Write-Host ""
    Write-Host "✗ google-services.json NOT FOUND!" -ForegroundColor Red
    Write-Host ""
    Write-Host "You need to download it from Firebase Console:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Go to: https://console.firebase.google.com/" -ForegroundColor White
    Write-Host "2. Select your Redsracing project" -ForegroundColor White
    Write-Host "3. Click the gear icon > Project Settings" -ForegroundColor White
    Write-Host "4. Scroll to 'Your apps'" -ForegroundColor White
    Write-Host "5. Find your Android app (com.redsracing.app)" -ForegroundColor White
    Write-Host "6. Click 'google-services.json' download button" -ForegroundColor White
    Write-Host "7. Save it to: $pwd\$googleServicesPath" -ForegroundColor White
    Write-Host ""
    Write-Host "After downloading, run this script again." -ForegroundColor Cyan
    exit 1
}
