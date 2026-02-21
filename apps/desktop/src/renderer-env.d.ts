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
      onDepsStatus: (callback: (statuses: DependencyStatus[]) => void) => void;
    };
  }
}

export {};
