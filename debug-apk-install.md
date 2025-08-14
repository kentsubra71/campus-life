# APK Installation Debugging Guide

## Enable Developer Options on Pixel 7
1. Settings → About Phone → Build Number (tap 7 times)
2. Settings → System → Developer Options → Enable

## Check Installation Logs
1. Enable USB Debugging
2. Connect to PC via USB
3. Run: `adb logcat | grep -i install`

## Manual Debugging Steps

### Check APK Details
- Download APK info apps: "APK Analyzer" or "Package Manager"
- Verify package name matches: `com.vero.campuslife`
- Check minimum SDK version compatibility

### Installation Error Messages
- "App not installed" = Signature/package conflict
- "Package appears to be corrupt" = Download issue
- "Insufficient storage" = Need more space
- "Install blocked" = Security settings

### Common Fixes
1. **Uninstall existing apps**: Any version of Campus Life
2. **Clear installer cache**: Settings → Apps → Package Installer → Storage → Clear
3. **Reboot device**: Fresh start
4. **Re-download APK**: In case of corruption
5. **Check storage**: Need ~100MB free space

## ADB Commands (if USB debugging enabled)
```bash
# Check if device is connected
adb devices

# Install APK directly via ADB
adb install -r /path/to/campus-life.apk

# Check detailed installation logs
adb logcat | grep PackageManager

# Force uninstall if needed
adb uninstall com.vero.campuslife
```