# ADB Wireless Debugging Setup Guide

## 🔧 Setting Up ADB Wireless Debugging

### Prerequisites
- Android device with USB debugging enabled
- Same WiFi network for both PC and Android device
- ADB installed (comes with Android SDK)

---

## Method 1: ADB over WiFi (Android 11+)

### Step 1: Enable Wireless Debugging on Your Device
1. Go to **Settings** > **Developer Options**
2. Scroll to **Wireless debugging**
3. Toggle it ON
4. Tap on **Wireless debugging**
5. Note the **IP address and Port** shown (e.g., `192.168.1.100:5555`)

### Step 2: Connect via ADB
```powershell
# Connect to your device (replace with your IP:Port)
adb connect 192.168.1.100:5555

# Verify connection
adb devices
```

You should see:
```
List of devices attached
192.168.1.100:5555    device
```

---

## Method 2: ADB over WiFi (Android 10 and below)

### Step 1: Connect via USB First
```powershell
# Check device is connected via USB
adb devices

# Enable TCP/IP on port 5555
adb tcpip 5555
```

### Step 2: Find Your Device IP
On your Android device:
- Go to **Settings** > **About Phone** > **Status** > **IP Address**
- OR **Settings** > **WiFi** > Tap your network > See IP address

### Step 3: Connect Wirelessly
```powershell
# Connect (replace with your device IP)
adb connect 192.168.1.100:5555

# Disconnect USB cable now

# Verify connection
adb devices
```

---

## 🐛 Debugging the Admin Panel Issues

### Check Logcat for Errors
```powershell
# View real-time logs
adb logcat

# Filter for RedsRacing app only
adb logcat | Select-String "redsracing" -CaseSensitive:$false

# Filter for errors only
adb logcat *:E

# Save logs to file
adb logcat > debug-logs.txt
```

### Check WebView Console Logs
```powershell
# View WebView console logs
adb logcat | Select-String "chromium|console" -CaseSensitive:$false
```

### Inspect Specific Issues
```powershell
# JavaScript errors
adb logcat | Select-String "javascript|js error" -CaseSensitive:$false

# Network errors
adb logcat | Select-String "network|http|failed to load" -CaseSensitive:$false

# Permission errors
adb logcat | Select-String "permission|denied" -CaseSensitive:$false
```

---

## 🔍 Chrome Remote Debugging (Best for Admin Panel)

This lets you debug the WebView like a regular webpage!

### Step 1: Enable WebView Debugging in App
The app should already have this enabled in debug builds. Check `MainActivity.kt`:
```kotlin
WebView.setWebContentsDebuggingEnabled(true)
```

### Step 2: Connect via Chrome DevTools
1. Connect device via ADB (wireless or USB)
2. Open Chrome on your PC
3. Navigate to: `chrome://inspect`
4. Under "Remote Target", you should see your device and the WebView
5. Click **Inspect** to open DevTools

Now you can:
- See console logs
- Inspect DOM elements
- Debug JavaScript
- Monitor network requests
- Check for errors

---

## 📊 Quick Diagnostics Commands

### Device Information
```powershell
# Check Android version
adb shell getprop ro.build.version.release

# Check device model
adb shell getprop ro.product.model

# Check if app is installed
adb shell pm list packages | Select-String "redsracing"
```

### App Status
```powershell
# Check if app is running
adb shell ps | Select-String "redsracing"

# Clear app data (fresh start)
adb shell pm clear com.redsracing.app

# Restart app
adb shell am force-stop com.redsracing.app
adb shell am start -n com.redsracing.app/.MainActivity
```

### Network Debugging
```powershell
# Check network connectivity
adb shell ping -c 4 redsracing-a7f8b.web.app

# Check DNS resolution
adb shell nslookup redsracing-a7f8b.web.app
```

---

## 🚀 Quick Debug Session Script

Save this as a PowerShell script for quick debugging:

```powershell
# debug-app.ps1

Write-Host "🔍 Starting RedsRacing Debug Session..." -ForegroundColor Green

# Connect to device
Write-Host "`nConnecting to device..." -ForegroundColor Yellow
adb devices

# Clear app data for fresh start
Write-Host "`nClearing app data..." -ForegroundColor Yellow
adb shell pm clear com.redsracing.app

# Start app
Write-Host "`nStarting app..." -ForegroundColor Yellow
adb shell am start -n com.redsracing.app/.MainActivity

# Start logging
Write-Host "`nStarting logcat (Ctrl+C to stop)..." -ForegroundColor Yellow
Write-Host "Filtered for RedsRacing app errors`n" -ForegroundColor Cyan

adb logcat -c  # Clear old logs
adb logcat | Select-String "redsracing|chromium.*console|javascript.*error" -CaseSensitive:$false
```

---

## 🐛 Common Admin Panel Issues to Check

### 1. WebView Not Loading
```powershell
# Check for network errors
adb logcat | Select-String "ERR_|failed|timeout" -CaseSensitive:$false
```

### 2. JavaScript Errors
```powershell
# Check console errors
adb logcat | Select-String "Uncaught|TypeError|ReferenceError" -CaseSensitive:$false
```

### 3. Authentication Issues
```powershell
# Check Firebase auth
adb logcat | Select-String "firebase|auth|token" -CaseSensitive:$false
```

### 4. Permission Errors (like photo deletion)
```powershell
# Check Firestore errors
adb logcat | Select-String "firestore|permission|insufficient" -CaseSensitive:$false
```

---

## 💡 Troubleshooting Tips

### Can't Connect Wirelessly?
```powershell
# Reset ADB
adb kill-server
adb start-server

# Check ADB version
adb version

# Reconnect via USB first, then wireless
adb usb
adb tcpip 5555
adb connect YOUR_DEVICE_IP:5555
```

### Connection Keeps Dropping?
- Make sure both devices stay on the same WiFi
- Disable WiFi power saving on Android
- Keep the device screen on during debugging

### Can't See WebView in chrome://inspect?
```powershell
# Ensure WebView debugging is enabled
adb shell "echo 'chrome.android.com.android.webview' >> /data/local/tmp/webview_packages"

# Restart Chrome on PC
# Restart app on device
```

---

## 📝 Debug Checklist for Admin Panel Issues

When debugging admin panel issues, check:

- [ ] Device is connected: `adb devices`
- [ ] App is installed: `adb shell pm list packages | Select-String redsracing`
- [ ] WebView loads correctly in Chrome DevTools
- [ ] Console shows JavaScript errors
- [ ] Network tab shows failed requests
- [ ] Firebase auth token is present
- [ ] User role is set correctly
- [ ] Check specific feature that's not working

---

## 🎯 Specific Admin Panel Features to Test

### Photo Deletion
Open Chrome DevTools and check:
- Console for permission errors
- Network tab for DELETE requests to Firestore
- Application tab > Local Storage for auth tokens

### Race Management
Check for:
- API call to Python functions
- Response status codes
- CORS errors

### Role Assignment
Look for:
- Cloud Function calls
- Authentication state
- Token refresh issues

---

## 📞 Getting Detailed Error Info

Once connected, run this to get comprehensive error info:

```powershell
# Create detailed log file
$logFile = "redsracing-debug-$(Get-Date -Format 'yyyy-MM-dd-HHmmss').txt"

Write-Host "Saving logs to: $logFile" -ForegroundColor Green

adb logcat -d > $logFile

Write-Host "Logs saved! Look for keywords like:" -ForegroundColor Yellow
Write-Host "  - ERROR" -ForegroundColor Red
Write-Host "  - FATAL" -ForegroundColor Red
Write-Host "  - javascript" -ForegroundColor Cyan
Write-Host "  - console" -ForegroundColor Cyan
Write-Host "  - permission" -ForegroundColor Magenta
```

---

## 🔗 Useful Resources

- **ADB Documentation**: https://developer.android.com/studio/command-line/adb
- **Chrome DevTools**: https://developer.chrome.com/docs/devtools/
- **WebView Debugging**: https://developer.chrome.com/docs/devtools/remote-debugging/webviews/

---

**Remember**: Keep the device connected and the app running while debugging!
