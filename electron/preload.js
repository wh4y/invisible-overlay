const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlayAPI", {
  setIgnoreMouseEvents: async (ignore) => {
    try {
      return await ipcRenderer.invoke("overlay:set-ignore", !!ignore);
    } catch {
      return false;
    }
  },
  getBounds: async () => {
    try {
      return await ipcRenderer.invoke("overlay:get-bounds");
    } catch {
      return null;
    }
  },
  setSize: async (width, height) => {
    try {
      return await ipcRenderer.invoke("overlay:set-size", width, height);
    } catch {
      return false;
    }
  },
  onWindowResize: (callback) => {
    ipcRenderer.on("window-resize", (_event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners("window-resize");
  },
  onRoomChange: (callback) => {
    ipcRenderer.on("room:change", (_event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners("room:change");
  },
});

