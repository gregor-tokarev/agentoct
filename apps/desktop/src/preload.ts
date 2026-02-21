import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  onDepsStatus: (callback: (statuses: unknown[]) => void) => {
    ipcRenderer.on("deps:status", (_event, statuses) => callback(statuses));
  },
});
