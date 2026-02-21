/// <reference types="vite/client" />

interface DependencyStatus {
  name: string;
  installed: boolean;
  installing: boolean;
  error?: string;
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
