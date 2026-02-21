import { contextBridge, ipcRenderer } from "electron";
import {
  PORTLESS_IPC_CHANNELS,
  type PortlessProxyCommandResult,
  type PortlessSpawnInput,
  type PortlessSpawnResult,
} from "@agentoct/portless/ipc";

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  openUrl: (url: string) => ipcRenderer.invoke("open-url", url),
  spawnPortlessDomain: (input: PortlessSpawnInput) =>
    ipcRenderer.invoke(
      PORTLESS_IPC_CHANNELS.spawnDomain,
      input,
    ) as Promise<PortlessSpawnResult>,
  killPortlessDomain: (sessionId: number) =>
    ipcRenderer.invoke(
      PORTLESS_IPC_CHANNELS.killDomain,
      sessionId,
    ) as Promise<boolean>,
  stopPortlessProxy: () =>
    ipcRenderer.invoke(
      PORTLESS_IPC_CHANNELS.stopProxy,
    ) as Promise<PortlessProxyCommandResult>,
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
