/// <reference types="vite/client" />

interface DependencyStatus {
  name: string;
  installed: boolean;
  installing: boolean;
  error?: string;
}

type OpenCodeSyncMode = "blocking" | "background";

interface OpenCodeModelRef {
  providerID: string;
  modelID: string;
}

interface OpenCodeInstallationStatus {
  installed: boolean;
  binaryPath: string | null;
  version: string | null;
}

interface OpenCodeRuntimeStatus extends OpenCodeInstallationStatus {
  connected: boolean;
  running: boolean;
  transport: "managed" | "attached" | null;
  baseUrl: string | null;
  cwd: string;
  syncMode: OpenCodeSyncMode;
  selectedModel: OpenCodeModelRef | null;
  connectedAt: number | null;
  lastEventAt: number | null;
}

interface OpenCodeStartOptions {
  cwd?: string;
  hostname?: string;
  port?: number;
  timeout?: number;
  syncMode?: OpenCodeSyncMode;
}

interface OpenCodeConnectOptions {
  baseUrl: string;
  cwd?: string;
  syncMode?: OpenCodeSyncMode;
}

interface OpenCodeModelInfo {
  id: string;
  providerID: string;
  providerName: string;
  modelID: string;
  modelName: string;
  releaseDate: string;
  connected: boolean;
  isDefault: boolean;
  experimental: boolean;
  status: "active" | "alpha" | "beta" | "deprecated";
  capabilities: {
    attachment: boolean;
    reasoning: boolean;
    temperature: boolean;
    toolCall: boolean;
  };
  limits: {
    context: number;
    output: number;
  };
}

interface OpenCodePromptRequest {
  sessionID: string;
  text?: string;
  messageID?: string;
  agent?: string;
  model?: OpenCodeModelRef;
  noReply?: boolean;
  system?: string;
  syncMode?: OpenCodeSyncMode;
}

interface OpenCodeEventEnvelope {
  receivedAt: number;
  payload: unknown;
}

declare global {
  interface Window {
    electronAPI: {
      platform: string;
      openUrl: (url: string) => Promise<void>;
      onNavigateToUrl: (callback: (url: string) => void) => () => void;
      onDepsStatus: (
        callback: (statuses: DependencyStatus[]) => void,
      ) => () => void;
      opencode: {
        ensureInstallation: (
          installIfMissing?: boolean,
        ) => Promise<OpenCodeInstallationStatus>;
        getStatus: () => Promise<OpenCodeRuntimeStatus>;
        startManaged: (
          options?: OpenCodeStartOptions,
        ) => Promise<OpenCodeRuntimeStatus>;
        connect: (
          options: OpenCodeConnectOptions,
        ) => Promise<OpenCodeRuntimeStatus>;
        stop: () => Promise<void>;
        listProviders: () => Promise<unknown>;
        listModels: () => Promise<OpenCodeModelInfo[]>;
        listAgents: () => Promise<unknown[]>;
        listSessions: () => Promise<unknown[]>;
        createSession: (input?: {
          title?: string;
          parentID?: string;
        }) => Promise<unknown>;
        setModel: (
          model: OpenCodeModelRef,
          persist?: boolean,
        ) => Promise<OpenCodeModelRef>;
        getSelectedModel: () => Promise<OpenCodeModelRef | null>;
        setSyncMode: (mode: OpenCodeSyncMode) => Promise<OpenCodeSyncMode>;
        getSyncMode: () => Promise<OpenCodeSyncMode>;
        prompt: (input: OpenCodePromptRequest) => Promise<unknown>;
        getOverview: () => Promise<unknown>;
        onEvent: (
          callback: (event: OpenCodeEventEnvelope) => void,
        ) => () => void;
      };
    };
  }

  interface ElectronWebviewElement extends HTMLElement {
    src: string;
    loadURL(url: string): Promise<void>;
    goBack(): void;
    goForward(): void;
    reload(): void;
    stop(): void;
    canGoBack(): boolean;
    canGoForward(): boolean;
  }
}

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      webview: JSX.HTMLAttributes<ElectronWebviewElement> & {
        src?: string;
        preload?: string;
        partition?: string;
        allowpopups?: boolean;
      };
    }
  }
}

export {};
