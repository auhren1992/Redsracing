# RedsRacing Admin Panel Debug Script
# Quick setup for ADB wireless debugging

Write-Host "`n🏁 RedsRacing Debug Tool`n" -ForegroundColor Cyan

# Check if ADB is available
try {
    $adbVersion = adb version 2>&1
    Write-Host "✅ ADB found" -ForegroundColor Green
} catch {
    Write-Host "❌ ADB not found. Please install Android SDK Platform Tools" -ForegroundColor Red
    Write-Host "Download: https://developer.android.com/studio/releases/platform-tools`n" -ForegroundColor Yellow
    exit 1
}

# Menu
Write-Host "Select an option:" -ForegroundColor Yellow
Write-Host "1. Connect via USB (first time setup)"
Write-Host "2. Connect via WiFi (enter IP)"
Write-Host "3. View live logs (filtered)"
Write-Host "4. View all logs"
Write-Host "5. Clear app data & restart"
Write-Host "6. Save detailed logs to file"
Write-Host "7. Check Chrome DevTools info"
Write-Host "8. Quick diagnostics"
Write-Host "0. Exit`n"

$choice = Read-Host "Enter choice"

switch ($choice) {
    "1" {
        Write-Host "`n📱 Connecting via USB...`n" -ForegroundColor Cyan
        Write-Host "Make sure USB debugging is enabled on your device" -ForegroundColor Yellow
        Write-Host "Checking for devices...`n" -ForegroundColor Gray
        
        adb devices
        
        Write-Host "`nEnabling wireless debugging on port 5555..." -ForegroundColor Gray
        adb tcpip 5555
        
        Write-Host "`n✅ Device ready for wireless connection!" -ForegroundColor Green
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "1. Note your device's IP address (Settings > WiFi > Your Network)"
        Write-Host "2. Disconnect USB cable"
        Write-Host "3. Run this script again and choose option 2"
        Write-Host "4. Enter your device IP address`n"
    }
    
    "2" {
        Write-Host "`n📡 Connecting via WiFi...`n" -ForegroundColor Cyan
        $deviceIP = Read-Host "Enter device IP address (e.g., 192.168.1.100)"
        
        Write-Host "Connecting to ${deviceIP}:5555..." -ForegroundColor Gray
        adb connect "${deviceIP}:5555"
        
        Write-Host "`nVerifying connection..." -ForegroundColor Gray
        adb devices
        
        Write-Host "`n✅ If you see 'device' above, you're connected!" -ForegroundColor Green
        Write-Host "You can now disconnect the USB cable`n" -ForegroundColor Yellow
    }
    
    "3" {
        Write-Host "`n📊 Starting filtered log viewer..." -ForegroundColor Cyan
        Write-Host "Showing: Errors, RedsRacing app, WebView console, JavaScript errors" -ForegroundColor Gray
        Write-Host "Press Ctrl+C to stop`n" -ForegroundColor Yellow
        
        adb logcat -c  # Clear old logs
        adb logcat | Select-String "redsracing|chromium.*console|javascript|ERROR|permission|firestore" -CaseSensitive:$false
    }
    
    "4" {
        Write-Host "`n📊 Starting full log viewer..." -ForegroundColor Cyan
        Write-Host "Press Ctrl+C to stop`n" -ForegroundColor Yellow
        
        adb logcat
    }
    
    "5" {
        Write-Host "`n🔄 Clearing app data and restarting...`n" -ForegroundColor Cyan
        
        Write-Host "Stopping app..." -ForegroundColor Gray
        adb shell am force-stop com.redsracing.app
        
        Write-Host "Clearing app data..." -ForegroundColor Gray
        adb shell pm clear com.redsracing.app
        
        Write-Host "Starting app..." -ForegroundColor Gray
        adb shell am start -n com.redsracing.app/.MainActivity
        
        Write-Host "`n✅ App restarted with fresh data!`n" -ForegroundColor Green
        
        $startLogs = Read-Host "Start viewing logs now? (y/n)"
        if ($startLogs -eq "y") {
            Write-Host "`nStarting filtered logs (Ctrl+C to stop)...`n" -ForegroundColor Cyan
            adb logcat -c
            adb logcat | Select-String "redsracing|chromium.*console|javascript|ERROR" -CaseSensitive:$false
        }
    }
    
    "6" {
        Write-Host "`n💾 Saving logs to file...`n" -ForegroundColor Cyan
        
        $timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
        $logFile = "redsracing-debug-$timestamp.txt"
        
        Write-Host "Capturing logs..." -ForegroundColor Gray
        adb logcat -d > $logFile
        
        $fileSize = (Get-Item $logFile).Length / 1KB
        
        Write-Host "`n✅ Logs saved to: $logFile ($([math]::Round($fileSize, 2)) KB)`n" -ForegroundColor Green
        Write-Host "Look for these keywords:" -ForegroundColor Yellow
        Write-Host "  - ERROR, FATAL (critical issues)" -ForegroundColor Red
        Write-Host "  - javascript, console (WebView errors)" -ForegroundColor Cyan
        Write-Host "  - permission, denied (auth issues)" -ForegroundColor Magenta
        Write-Host "  - firestore, firebase (database issues)" -ForegroundColor Blue
        Write-Host ""
        
        $openFile = Read-Host "Open file now? (y/n)"
        if ($openFile -eq "y") {
            notepad $logFile
        }
    }
    
    "7" {
        Write-Host "`n🔍 Chrome DevTools Setup`n" -ForegroundColor Cyan
        Write-Host "To debug the WebView like a web page:`n" -ForegroundColor Gray
        
        Write-Host "1. Make sure your device is connected (check below)" -ForegroundColor Yellow
        adb devices
        
        Write-Host "`n2. Open Chrome on this PC" -ForegroundColor Yellow
        Write-Host "3. Navigate to: chrome://inspect" -ForegroundColor Yellow
        Write-Host "4. Under 'Remote Target', find your device" -ForegroundColor Yellow
        Write-Host "5. Look for 'com.redsracing.app' WebView" -ForegroundColor Yellow
        Write-Host "6. Click 'Inspect' to open DevTools`n" -ForegroundColor Yellow
        
        Write-Host "This gives you:" -ForegroundColor Cyan
        Write-Host "  ✓ Console logs (JavaScript errors)"
        Write-Host "  ✓ Network monitoring (API calls)"
        Write-Host "  ✓ DOM inspection"
        Write-Host "  ✓ Live debugging`n"
        
        $openChrome = Read-Host "Open chrome://inspect now? (y/n)"
        if ($openChrome -eq "y") {
            Start-Process "chrome://inspect"
        }
    }
    
    "8" {
        Write-Host "`n🔧 Running Quick Diagnostics...`n" -ForegroundColor Cyan
        
        Write-Host "Device Connection:" -ForegroundColor Yellow
        adb devices
        
        Write-Host "`nAndroid Version:" -ForegroundColor Yellow
        adb shell getprop ro.build.version.release
        
        Write-Host "`nDevice Model:" -ForegroundColor Yellow
        adb shell getprop ro.product.model
        
        Write-Host "`nApp Installation:" -ForegroundColor Yellow
        $appInstalled = adb shell pm list packages | Select-String "redsracing"
        if ($appInstalled) {
            Write-Host "✅ RedsRacing app is installed" -ForegroundColor Green
        } else {
            Write-Host "❌ RedsRacing app NOT found" -ForegroundColor Red
        }
        
        Write-Host "`nApp Running Status:" -ForegroundColor Yellow
        $appRunning = adb shell ps | Select-String "redsracing"
        if ($appRunning) {
            Write-Host "✅ App is currently running" -ForegroundColor Green
        } else {
            Write-Host "⚠️  App is not running" -ForegroundColor Yellow
        }
        
        Write-Host "`nNetwork Connectivity:" -ForegroundColor Yellow
        $pingResult = adb shell ping -c 2 redsracing-a7f8b.web.app 2>&1
        if ($pingResult -match "2 received") {
            Write-Host "✅ Can reach redsracing-a7f8b.web.app" -ForegroundColor Green
        } else {
            Write-Host "❌ Cannot reach server" -ForegroundColor Red
        }
        
        Write-Host ""
    }
    
    "0" {
        Write-Host "`nBye! 👋`n" -ForegroundColor Cyan
        exit 0
    }
    
    default {
        Write-Host "`n❌ Invalid choice`n" -ForegroundColor Red
    }
}

Write-Host "`nPress any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
