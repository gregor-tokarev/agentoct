import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  openUrl: (url: string) => ipcRenderer.invoke("open-url", url),
  spawnPortlessDomain: (input: {
    domain: string;
    command: string;
    args?: string[];
    cwd?: string;
  }) => ipcRenderer.invoke("portless:spawn-domain", input),
  killPortlessDomain: (sessionId: number) =>
    ipcRenderer.invoke("portless:kill-domain", sessionId),
  stopPortlessProxy: () => ipcRenderer.invoke("portless:stop-proxy"),
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
