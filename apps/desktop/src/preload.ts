import { contextBridge, ipcRenderer } from "electron";
import type {
  OpenCodeAgent,
  OpenCodeConnectOptions,
  OpenCodeEventEnvelope,
  OpenCodeInstallationStatus,
  OpenCodeModelInfo,
  OpenCodeModelRef,
  OpenCodeOverview,
  OpenCodePromptRequest,
  OpenCodePromptResult,
  OpenCodeRuntimeStatus,
  OpenCodeStartOptions,
  OpenCodeSyncMode,
  OpenCodeSession,
  ProviderCatalogResponse,
} from "@agentoct/opencode-acp";
import type { DependencyStatus } from "./deps.js";

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  openUrl: (url: string) => ipcRenderer.invoke("open-url", url),
  onNavigateToUrl: (callback: (url: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, url: string) =>
      callback(url);
    ipcRenderer.on("navigate-to-url", handler);
    return () => ipcRenderer.removeListener("navigate-to-url", handler);
  },
  onDepsStatus: (callback: (statuses: DependencyStatus[]) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      statuses: DependencyStatus[],
    ) => callback(statuses);
    ipcRenderer.on("deps:status", handler);
    return () => ipcRenderer.removeListener("deps:status", handler);
  },
  opencode: {
    ensureInstallation: (
      installIfMissing = false,
    ): Promise<OpenCodeInstallationStatus> =>
      ipcRenderer.invoke("opencode:ensure-installation", installIfMissing),
    getStatus: (): Promise<OpenCodeRuntimeStatus> =>
      ipcRenderer.invoke("opencode:get-status"),
    startManaged: (
      options?: OpenCodeStartOptions,
    ): Promise<OpenCodeRuntimeStatus> =>
      ipcRenderer.invoke("opencode:start-managed", options),
    connect: (
      options: OpenCodeConnectOptions,
    ): Promise<OpenCodeRuntimeStatus> =>
      ipcRenderer.invoke("opencode:connect", options),
    stop: (): Promise<void> => ipcRenderer.invoke("opencode:stop"),
    listProviders: (): Promise<ProviderCatalogResponse> =>
      ipcRenderer.invoke("opencode:list-providers"),
    listModels: (): Promise<OpenCodeModelInfo[]> =>
      ipcRenderer.invoke("opencode:list-models"),
    listAgents: (): Promise<OpenCodeAgent[]> =>
      ipcRenderer.invoke("opencode:list-agents"),
    listSessions: (): Promise<OpenCodeSession[]> =>
      ipcRenderer.invoke("opencode:list-sessions"),
    createSession: (
      input?: { title?: string; parentID?: string },
    ): Promise<OpenCodeSession> =>
      ipcRenderer.invoke("opencode:create-session", input),
    setModel: (
      model: OpenCodeModelRef,
      persist?: boolean,
    ): Promise<OpenCodeModelRef> =>
      ipcRenderer.invoke("opencode:set-model", model, persist),
    getSelectedModel: (): Promise<OpenCodeModelRef | null> =>
      ipcRenderer.invoke("opencode:get-selected-model"),
    setSyncMode: (mode: OpenCodeSyncMode): Promise<OpenCodeSyncMode> =>
      ipcRenderer.invoke("opencode:set-sync-mode", mode),
    getSyncMode: (): Promise<OpenCodeSyncMode> =>
      ipcRenderer.invoke("opencode:get-sync-mode"),
    prompt: (input: OpenCodePromptRequest): Promise<OpenCodePromptResult> =>
      ipcRenderer.invoke("opencode:prompt", input),
    getOverview: (): Promise<OpenCodeOverview> =>
      ipcRenderer.invoke("opencode:get-overview"),
    onEvent: (callback: (event: OpenCodeEventEnvelope) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        event: OpenCodeEventEnvelope,
      ) => callback(event);
      ipcRenderer.on("opencode:event", handler);
      return () => ipcRenderer.removeListener("opencode:event", handler);
    },
  },
});
