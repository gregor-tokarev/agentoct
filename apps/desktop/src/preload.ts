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
  opencode: {
    ensureInstallation: (installIfMissing = false) =>
      ipcRenderer.invoke("opencode:ensure-installation", installIfMissing),
    getStatus: () => ipcRenderer.invoke("opencode:get-status"),
    startManaged: (options?: unknown) =>
      ipcRenderer.invoke("opencode:start-managed", options),
    connect: (options: unknown) => ipcRenderer.invoke("opencode:connect", options),
    stop: () => ipcRenderer.invoke("opencode:stop"),
    listProviders: () => ipcRenderer.invoke("opencode:list-providers"),
    listModels: () => ipcRenderer.invoke("opencode:list-models"),
    listAgents: () => ipcRenderer.invoke("opencode:list-agents"),
    listSessions: () => ipcRenderer.invoke("opencode:list-sessions"),
    createSession: (input?: unknown) =>
      ipcRenderer.invoke("opencode:create-session", input),
    setModel: (model: unknown, persist?: boolean) =>
      ipcRenderer.invoke("opencode:set-model", model, persist),
    getSelectedModel: () => ipcRenderer.invoke("opencode:get-selected-model"),
    setSyncMode: (mode: unknown) => ipcRenderer.invoke("opencode:set-sync-mode", mode),
    getSyncMode: () => ipcRenderer.invoke("opencode:get-sync-mode"),
    prompt: (input: unknown) => ipcRenderer.invoke("opencode:prompt", input),
    getOverview: () => ipcRenderer.invoke("opencode:get-overview"),
    onEvent: (callback: (event: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, event: unknown) =>
        callback(event);
      ipcRenderer.on("opencode:event", handler);
      return () => ipcRenderer.removeListener("opencode:event", handler);
    },
  },
});
