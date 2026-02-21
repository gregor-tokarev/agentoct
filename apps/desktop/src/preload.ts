import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  openUrl: (url: string) => ipcRenderer.invoke("open-url", url),
  onNavigateToUrl: (callback: (url: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, url: string) =>
      callback(url);
    ipcRenderer.on("navigate-to-url", handler);
    return () => ipcRenderer.removeListener("navigate-to-url", handler);
  },
  onDepsStatus: (callback: (statuses: unknown[]) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      statuses: unknown[],
    ) => callback(statuses);
    ipcRenderer.on("deps:status", handler);
    return () => ipcRenderer.removeListener("deps:status", handler);
  },
});
