export interface PortlessSpawnInput {
  domain: string;
  command: string;
  args?: string[];
  cwd?: string;
}

export interface PortlessSpawnResult {
  sessionId: number;
  pid: number | null;
  url: string;
}

export interface PortlessProxyCommandResult {
  stdout: string;
  stderr: string;
}

export const PORTLESS_IPC_CHANNELS = {
  spawnDomain: "portless:spawn-domain",
  killDomain: "portless:kill-domain",
  stopProxy: "portless:stop-proxy",
} as const;
