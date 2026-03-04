# Deploy K1 Speed Auto-Update System for Jonny Kirsch
# This script deploys the cloud functions and hosting configuration

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "K1 Speed Auto-Update Deployment" -ForegroundColor Cyan
Write-Host "Jonny Kirsch - Junior League" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Ensure we're in the right directory
$projectRoot = "C:\Users\Parts\Documents\Desktop\Redsracing"
Set-Location $projectRoot

Write-Host "Step 1: Deploying Cloud Functions..." -ForegroundColor Yellow
firebase deploy --only functions:fetchK1AddisonJonnyJunior,functions:k1AutoRefreshAddisonJonny

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Cloud Functions deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 2: Deploying Hosting (URL rewrites)..." -ForegroundColor Yellow
firebase deploy --only hosting

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Hosting deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Test the endpoint: https://redsracing-a7f8b.web.app/k1/addison/junior/jonny"
Write-Host "2. Check Jonny's page: https://redsracing-a7f8b.web.app/jonny.html"
Write-Host "3. Monitor updates in Firebase Console > Firestore > k1_stats/jonny_addison_junior_2025"
Write-Host ""
Write-Host "Auto-update schedule: Every 12 hours" -ForegroundColor Yellow
Write-Host ""
