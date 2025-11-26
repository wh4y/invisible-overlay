const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  screen,
} = require("electron");
const path = require("path");
const fs = require("fs");

let overlayWindow = null;
let dragWindow = null;
let resizeWindow = null;
let isDraggingOverlay = false;
let isResizingOverlay = false;

// Disable certificate verification for Yjs server (development only)
app.commandLine.appendSwitch("ignore-certificate-errors");
app.on("certificate-error", (event, webContents, url, error, certificate, callback) => {
  // Allow certificate errors for yjs-test.onrender.com
  if (url.includes("yjs-test.onrender.com")) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 500,
    height: 220,
    minWidth: 300,
    minHeight: 120,
    frame: false,
    transparent: true,
    resizable: true, // Allow resizing via resize handle
    alwaysOnTop: true,
    focusable: false,
    hasShadow: false,
    skipTaskbar: true,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      webSecurity: false, // Allow connections to servers with SSL cert issues
    },
  });

  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setContentProtection(true); // Enable content protection for screen sharing exclusion
  // Default to pass-through; we'll temporarily disable ignore on interactive regions
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  if (app.dock && app.dock.hide) app.dock.hide();

  // Load React overlay app from static build
  const overlayPath = path.join(__dirname, "overlay-react", "dist", "index.html");
  const overlayDir = path.join(__dirname, "overlay-react", "dist");
  
  console.log("[overlay] Loading React overlay from:", overlayPath);
  console.log("[overlay] Build directory:", overlayDir);
  
  // Verify build exists
  if (!fs.existsSync(overlayPath)) {
    console.error("[overlay] ❌ Build not found! Please run: npm run build:overlay:static");
    console.error("[overlay] Expected path:", overlayPath);
    overlayWindow.loadURL('data:text/html,<html><body style="background:#1a1a1a;color:#fff;padding:40px;font-family:system-ui;"><h1>⚠️ Overlay Build Not Found</h1><p>Please build the overlay first:</p><pre style="background:#2a2a2a;padding:20px;border-radius:8px;">npm run build:overlay:static</pre></body></html>');
  } else {
    console.log("[overlay] ✅ Build found, loading...");
    
    // Verify assets directory exists
    const assetsDir = path.join(overlayDir, "assets");
    if (fs.existsSync(assetsDir)) {
      const assets = fs.readdirSync(assetsDir);
      console.log("[overlay] Found assets:", assets.length, "files");
    }
    
    overlayWindow.loadFile(overlayPath).catch((err) => {
      console.error("[overlay] ❌ Failed to load file:", err);
    });
  }
  
  overlayWindow.setMenuBarVisibility(false);
  
  // Open DevTools for debugging (comment out in production)
  overlayWindow.webContents.openDevTools({ mode: "detach" });
  
  // Listen for load errors
  overlayWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    console.error("[overlay] Failed to load:", { errorCode, errorDescription, validatedURL });
  });
  
  overlayWindow.webContents.on("console-message", (event, level, message) => {
    console.log(`[overlay-console ${level}]:`, message);
  });
  
  console.log("[overlay] Window created and should be visible");
  console.log("[overlay] Position:", overlayWindow.getBounds());

  // Exclude from screen capture on Windows using native API
  overlayWindow.webContents.on("did-finish-load", () => {
    console.log("[overlay] Content loaded successfully");
    
    // Send initial window size to React app after content loads
    setTimeout(() => {
      if (overlayWindow && overlayWindow.webContents) {
        const bounds = overlayWindow.getBounds();
        overlayWindow.webContents.send('window-resize', { 
          width: bounds.width, 
          height: bounds.height 
        });
        console.log("[overlay] Sent initial window size to React:", bounds);
      }
    }, 100);
    
    if (process.platform === "win32") {
      try {
        const hwnd = overlayWindow.getNativeWindowHandle();
        // Set WDA_EXCLUDEFROMCAPTURE flag on Windows 10 build 2004+
        overlayWindow.setContentProtection(true);
      } catch (err) {
        console.warn("Failed to exclude from capture:", err);
      }
    }
  });

  // Listen for window resize and notify React app
  overlayWindow.on('resized', () => {
    if (overlayWindow && overlayWindow.webContents && !overlayWindow.webContents.isLoading()) {
      const bounds = overlayWindow.getBounds();
      overlayWindow.webContents.send('window-resize', { 
        width: bounds.width, 
        height: bounds.height 
      });
      console.log("[overlay] Window resized, sent to React:", bounds);
    }
  });

  overlayWindow.on('moved', () => {
    if (overlayWindow && overlayWindow.webContents && !overlayWindow.webContents.isLoading()) {
      const bounds = overlayWindow.getBounds();
      overlayWindow.webContents.send('window-resize', { 
        width: bounds.width, 
        height: bounds.height 
      });
    }
  });

  // Reposition control windows only when explicitly shown/hidden
  // Don't listen to 'moved' or 'resized' - we handle that manually in IPC handlers
  overlayWindow.on("show", () => {
    dragWindow?.showInactive();
    resizeWindow?.showInactive();
    positionControlWindows();
  });
  overlayWindow.on("hide", () => {
    dragWindow?.hide();
    resizeWindow?.hide();
  });
}

function registerHotkeys() {
  globalShortcut.register("CommandOrControl+Shift+Space", () => {
    if (!overlayWindow) return;
    const isVisible = overlayWindow.isVisible();
    if (isVisible) {
      overlayWindow.hide();
    } else {
      overlayWindow.showInactive();
    }
  });

  // Emergency reset: center the overlay window on screen
  globalShortcut.register("CommandOrControl+Shift+R", () => {
    if (!overlayWindow) return;
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const bounds = overlayWindow.getBounds();
    
    // Center the overlay
    const x = Math.floor((width - bounds.width) / 2);
    const y = Math.floor((height - bounds.height) / 2);
    
    overlayWindow.setBounds({ x, y, width: bounds.width, height: bounds.height });
    overlayWindow.showInactive();
    positionControlWindows();
    console.log("Overlay reset to center:", { x, y, width: bounds.width, height: bounds.height });
  });
}


function createControlWindows() {
  // Drag pill window (top-left)
  dragWindow = new BrowserWindow({
    width: 140,
    height: 36,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    focusable: false,
    hasShadow: false,
    skipTaskbar: true,
    show: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  dragWindow.setAlwaysOnTop(true, "screen-saver");
  dragWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  dragWindow.setContentProtection(true); // Exclude from screen sharing
  dragWindow.loadFile(path.join(__dirname, "pill.html"));
  dragWindow.setMenuBarVisibility(false);
  console.log("[drag-pill] Window created at:", dragWindow.getBounds());

  // Resizer handle (bottom-right) - larger hitarea for better mouse capture
  resizeWindow = new BrowserWindow({
    width: 30,
    height: 30,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    focusable: false,
    hasShadow: false,
    skipTaskbar: true,
    show: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  resizeWindow.setAlwaysOnTop(true, "screen-saver");
  resizeWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  resizeWindow.setContentProtection(true); // Exclude from screen sharing
  resizeWindow.loadFile(path.join(__dirname, "resizer.html"));
  resizeWindow.setMenuBarVisibility(false);
  console.log("[resizer] Window created at:", resizeWindow.getBounds());

  positionControlWindows();
}

function positionControlWindows() {
  if (!overlayWindow || (!dragWindow && !resizeWindow)) return;
  const { x, y, width, height } = overlayWindow.getBounds();
  console.log("[positioning] Overlay bounds:", { x, y, width, height });
  // Place pill near top-left of overlay, with small padding
  if (dragWindow && !isDraggingOverlay) {
    dragWindow.setPosition(x + 8, y + 8, false);
    console.log("[positioning] Drag pill at:", { x: x + 8, y: y + 8 });
  }
  // Place resizer near bottom-right (window is 30x30, handle is at bottom-right of that)
  if (resizeWindow && !isResizingOverlay && !isDraggingOverlay) {
    const [rw, rh] = resizeWindow.getSize();
    // Position so the visible handle (bottom-right 14x14 of the 30x30 window) is at overlay corner
    const resizeX = x + width - rw + 16;
    const resizeY = y + height - rh + 16;
    resizeWindow.setPosition(resizeX, resizeY, false);
    console.log("[positioning] Resizer at:", { x: resizeX, y: resizeY });
  }
}

// IPC for overlay interactions
ipcMain.handle("overlay:set-ignore", (_e, ignore) => {
  if (!overlayWindow) return false;
  overlayWindow.setIgnoreMouseEvents(!!ignore, { forward: true });
  return true;
});

ipcMain.handle("overlay:get-bounds", () => {
  if (!overlayWindow) return null;
  return overlayWindow.getBounds();
});

ipcMain.handle("overlay:set-size", (_e, width, height) => {
  if (!overlayWindow) return false;
  const w = Math.max(300, Math.floor(Number(width) || 0));
  const h = Math.max(120, Math.floor(Number(height) || 0));
  overlayWindow.setSize(w, h, true);
  
  // Notify React app of size change
  overlayWindow.webContents.send('window-resize', { width: w, height: h });
  
  return true;
});

// Listen for window resize and notify React app
overlayWindow?.on('resized', () => {
  if (overlayWindow) {
    const bounds = overlayWindow.getBounds();
    overlayWindow.webContents.send('window-resize', { 
      width: bounds.width, 
      height: bounds.height 
    });
  }
});

app.whenReady().then(() => {
  console.log("=".repeat(60));
  console.log("[app] Starting Support App...");
  console.log("[app] Overlay connects directly to Yjs server");
  console.log("=".repeat(60));
  
  createOverlayWindow();
  createControlWindows();
  registerHotkeys();
  
  console.log("=".repeat(60));
  console.log("[app] All windows created!");
  console.log("[app] Overlay should be visible on your screen");
  console.log("[app] Press Ctrl+Shift+Space to toggle visibility");
  console.log("[app] Press Ctrl+Shift+R to reset position");
  console.log("=".repeat(60));
});

// Drag & resize IPC from control windows
ipcMain.on("overlay:drag-begin", (e, startScreenX, startScreenY) => {
  const bounds = overlayWindow.getBounds();
  isDraggingOverlay = true;
  e.sender._dragMeta = {
    startScreenX,
    startScreenY,
    startX: bounds.x,
    startY: bounds.y,
    startWidth: bounds.width,
    startHeight: bounds.height,
  };
});

ipcMain.on("overlay:drag-move", (e, screenX, screenY) => {
  const meta = e.sender._dragMeta;
  if (!meta) return;
  const dx = screenX - meta.startScreenX;
  const dy = screenY - meta.startScreenY;
  const newX = Math.floor(meta.startX + dx);
  const newY = Math.floor(meta.startY + dy);
  overlayWindow.setBounds(
    {
      x: newX,
      y: newY,
      width: meta.startWidth,
      height: meta.startHeight,
    },
    false
  );
  // Don't reposition controls during drag; they stay frozen
});

ipcMain.on("overlay:drag-end", (e) => {
  e.sender._dragMeta = null;
  isDraggingOverlay = false;
  positionControlWindows();
});

ipcMain.on("overlay:resize-begin", (e, startScreenX, startScreenY) => {
  const bounds = overlayWindow.getBounds();
  console.log("resize-begin: start at", startScreenX, startScreenY, "current size:", bounds.width, "x", bounds.height);
  isResizingOverlay = true;
  e.sender._resizeMeta = {
    startScreenX,
    startScreenY,
    startW: bounds.width,
    startH: bounds.height,
  };
});

ipcMain.on("overlay:resize-move", (e, screenX, screenY) => {
  const meta = e.sender._resizeMeta;
  if (!meta) return;
  const dx = screenX - meta.startScreenX;
  const dy = screenY - meta.startScreenY;
  // Base new size by drag delta
  let newW = Math.max(300, Math.floor(meta.startW + dx));
  let newH = Math.max(120, Math.floor(meta.startH + dy));
  // Clamp to current display work area so overlay doesn't grow off-screen
  const bounds = overlayWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const wa = display.workArea; // { x, y, width, height }
  const maxW = Math.max(300, wa.x + wa.width - bounds.x);
  const maxH = Math.max(120, wa.y + wa.height - bounds.y);
  newW = Math.min(newW, maxW);
  newH = Math.min(newH, maxH);
  
  // Resize the window (resizable is already enabled)
  overlayWindow.setSize(newW, newH, false);
  
  // Notify React app of size change
  if (overlayWindow && overlayWindow.webContents && !overlayWindow.webContents.isLoading()) {
    overlayWindow.webContents.send('window-resize', { 
      width: newW, 
      height: newH 
    });
  }
  
  // Manually move resizer handle to follow the new bottom-right corner
  if (resizeWindow) {
    const [rw, rh] = resizeWindow.getSize();
    const updatedBounds = overlayWindow.getBounds();
    resizeWindow.setPosition(
      updatedBounds.x + updatedBounds.width - rw + 16,
      updatedBounds.y + updatedBounds.height - rh + 16,
      false
    );
  }
});

ipcMain.on("overlay:resize-end", (e) => {
  e.sender._resizeMeta = null;
  isResizingOverlay = false;
  positionControlWindows();
});

app.on("window-all-closed", () => {
  // Keep running to serve control page; quit explicitly on macOS with Cmd+Q
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
