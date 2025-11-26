# Screen Sharing & Screen Capture Exclusion

This overlay app attempts to automatically hide itself from screen capture on all platforms. However, support varies by operating system.

## Platform Support

### ✅ Windows 10 (Build 2004+) / Windows 11
**Status:** **Fully Automatic** ✅

The overlay is automatically excluded from screen capture using the Windows `SetWindowDisplayAffinity` API with the `WDA_EXCLUDEFROMCAPTURE` flag.

- **Works with:** Google Meet, Zoom, Microsoft Teams, OBS Studio, Discord, and most screen recording/sharing apps
- **No manual action required** - Just start screen sharing and the overlay won't appear
- **Fallback:** If it still appears, press `Ctrl+Shift+H` to manually hide it

### ⚠️ macOS
**Status:** **Partial Support** ⚠️

The overlay uses macOS's `NSWindowSharingNone` setting, which works with some apps but not others.

- **Works with:** Older versions of Zoom, Skype, and some other legacy screen sharing apps
- **May NOT work with:** Modern Chrome-based apps (Meet, Teams), FaceTime, QuickTime, apps using ScreenCaptureKit
- **Required action:** **Press `Cmd+Shift+H` before screen sharing** to ensure the overlay is hidden

### ❌ Linux
**Status:** **Manual Only** ❌

Linux does not have a system-level API for excluding windows from screen capture.

- **Required action:** **Always press `Ctrl+Shift+H` before screen sharing**
- No automatic protection available
- This is a limitation of the Linux platform, not the app

---

## Keyboard Shortcuts

All users should know these shortcuts:

| Shortcut | Action | When to Use |
|----------|--------|-------------|
| **`Ctrl+Shift+Space`** (or `Cmd` on Mac) | Toggle show/hide overlay | General on/off |
| **`Ctrl+Shift+H`** (or `Cmd` on Mac) | Quick hide for screen sharing | **Before starting screen share** |
| **`Ctrl+Shift+R`** (or `Cmd` on Mac) | Reset position to center | If overlay is lost off-screen |

---

## Recommended Workflow

### For Windows Users:
1. Just start screen sharing - the overlay should automatically be hidden ✅
2. If it still appears (rare), press `Ctrl+Shift+H`

### For macOS Users:
1. **Press `Cmd+Shift+H` to hide the overlay**
2. Start your screen share
3. After screen sharing, press `Cmd+Shift+H` again to show the overlay

### For Linux Users:
1. **Press `Ctrl+Shift+H` to hide the overlay** (required!)
2. Start your screen share
3. After screen sharing, press `Ctrl+Shift+H` again to show the overlay

---

## Technical Details

### Why doesn't this work automatically on all platforms?

**Windows:** Has excellent OS-level support via `SetWindowDisplayAffinity` API introduced in Windows 10 version 2004.

**macOS:** Apple's newer `ScreenCaptureKit` framework (used by modern apps) can capture windows even if they're marked as non-shareable. Older apps respect `NSWindowSharingNone`.

**Linux:** No standardized API exists. Wayland and X11 don't provide window-level capture exclusion APIs.

### Can this be improved?

For Windows, the current implementation is the best possible solution.

For macOS and Linux, the **only reliable method** is manual hiding via hotkey. This is a platform limitation, not an app limitation.

---

## Distribution Notes

When distributing this app to users, make sure to communicate:

1. **Windows users:** Automatic protection (but mention the manual hotkey as backup)
2. **macOS users:** Must use `Cmd+Shift+H` before screen sharing
3. **Linux users:** Must use `Ctrl+Shift+H` before screen sharing

Consider adding this information to:
- First-run tutorial
- Tooltip on the overlay
- Help documentation
- App tray menu (if you add one)






