/// <reference types="vite/client" />

declare global {
  interface Window {
    electronAPI: {
      platform: string;
    };
  }
}

export {};
