# Wireless Android Debugging Guide

## Setup (One-time USB connection required)

1. **Connect your Android device via USB**

2. **Enable USB debugging** on your device:
   - Settings → About Phone → Tap "Build Number" 7 times
   - Settings → Developer Options → Enable "USB Debugging"

3. **Open Command Prompt/PowerShell** and run:
   ```powershell
   adb tcpip 5555
   ```

4. **Find your device's IP address**:
   - Settings → About Phone → Status → IP Address
   - OR run: `adb shell ip addr show wlan0`

5. **Disconnect USB cable**

6. **Connect wirelessly**:
   ```powershell
   adb connect YOUR_DEVICE_IP:5555
   ```
   Example: `adb connect 192.168.1.100:5555`

7. **Verify connection**:
   ```powershell
   adb devices
   ```
   You should see your device IP listed

## Using Chrome DevTools Wirelessly

1. **Keep device connected via ADB WiFi**

2. **Open Chrome** on your computer

3. **Navigate to**: `chrome://inspect`

4. **Launch your app** on the device

5. **Click "inspect"** under your app's WebView

6. **View console logs** - Look for `[RedsRacing]` messages

## Testing the Navigation Upgrade

Once connected, in the Chrome DevTools console, type:
```javascript
upgradeNavMenus()
```

This will show you:
- `[RedsRacing] Upgrading navigation menus...`
- `[RedsRacing] Found X dropdown toggles`
- `[RedsRacing] Upgrading Drivers desktop menu`
- `[RedsRacing] Drivers desktop menu upgraded successfully`

## Troubleshooting

### If connection fails:
```powershell
# Restart ADB
adb kill-server
adb start-server

# Reconnect via USB and try again
adb tcpip 5555
adb connect YOUR_DEVICE_IP:5555
```

### If device goes to sleep:
- Keep screen awake: Developer Options → Stay Awake (when charging)
- Reconnect: `adb connect YOUR_DEVICE_IP:5555`

### To disconnect:
```powershell
adb disconnect
```

### To switch back to USB:
```powershell
adb usb
```

## Android 11+ Wireless Debugging (No USB Required)

For Android 11 and newer:

1. **Settings → Developer Options → Wireless Debugging** → Enable

2. **Tap "Pair device with pairing code"**

3. **On your computer**, run:
   ```powershell
   adb pair YOUR_DEVICE_IP:PAIRING_PORT
   ```
   Enter the pairing code shown on device

4. **Connect**:
   ```powershell
   adb connect YOUR_DEVICE_IP:5555
   ```

## Quick Install APK Wirelessly

Once connected via WiFi:
```powershell
adb install -r app\build\outputs\apk\release\app-release.apk
```

The `-r` flag replaces the existing app.

## View Live Logs

To see all app logs in real-time:
```powershell
adb logcat | Select-String "RedsRacing"
```

Press Ctrl+C to stop.
