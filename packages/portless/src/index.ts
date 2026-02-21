import { execFile, spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { DEFAULT_PORTLESS_PROXY_PORT } from "./constants.js";

const execFileAsync = promisify(execFile);

export interface PortlessClientOptions {
  binaryPath?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface SpawnDomainOptions {
  domain: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdio?: "inherit" | "pipe" | "ignore";
}

export interface ProxyStartOptions {
  port?: number;
  https?: boolean;
  certPath?: string;
  keyPath?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface ProxyStopOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface ProxyCommandResult {
  stdout: string;
  stderr: string;
}

export interface SpawnedPortlessDomain {
  domain: string;
  url: string;
  process: ChildProcess;
  kill: (signal?: NodeJS.Signals | number) => boolean;
}

function parseOptionalPort(raw: string | undefined): number | undefined {
  if (!raw) {
    return undefined;
  }

  const value = Number(raw);
  if (Number.isInteger(value) && value >= 1 && value <= 65_535) {
    return value;
  }

  return undefined;
}

function parseBooleanFlag(raw: string | undefined): boolean {
  if (!raw) {
    return false;
  }

  return raw === "1" || raw.toLowerCase() === "true";
}

function assertText(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Expected "${fieldName}" to be a non-empty string`);
  }
  return trimmed;
}

function assertProxyPort(port: number): void {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Expected "port" to be an integer between 1 and 65535`);
  }
}

export function domainUrl(
  domain: string,
  options?: { port?: number; https?: boolean },
): string {
  const normalizedDomain = assertText(domain, "domain");
  const port = options?.port ?? DEFAULT_PORTLESS_PROXY_PORT;
  const useHttps = options?.https ?? false;
  return `${useHttps ? "https" : "http"}://${normalizedDomain}.localhost:${port}`;
}

export class PortlessClient {
  private readonly binaryPath: string;
  private readonly defaultCwd?: string;
  private readonly defaultEnv?: NodeJS.ProcessEnv;

  constructor(options?: PortlessClientOptions) {
    this.binaryPath = options?.binaryPath ?? "portless";
    this.defaultCwd = options?.cwd;
    this.defaultEnv = options?.env;
  }

  spawnDomain(options: SpawnDomainOptions): SpawnedPortlessDomain {
    const domain = assertText(options.domain, "domain");
    const command = assertText(options.command, "command");
    const args = options.args ?? [];
    const mergedEnv = { ...process.env, ...this.defaultEnv, ...options.env };

    const child = spawn(this.binaryPath, [domain, command, ...args], {
      cwd: options.cwd ?? this.defaultCwd,
      env: mergedEnv,
      stdio: options.stdio ?? "inherit",
    });

    const proxyPort =
      parseOptionalPort(mergedEnv.PORTLESS_PORT) ??
      DEFAULT_PORTLESS_PROXY_PORT;
    const proxyHttps = parseBooleanFlag(mergedEnv.PORTLESS_HTTPS);

    return {
      domain,
      url: domainUrl(domain, { port: proxyPort, https: proxyHttps }),
      process: child,
      kill: (signal) => child.kill(signal),
    };
  }

  async startProxy(options?: ProxyStartOptions): Promise<ProxyCommandResult> {
    const args = ["proxy", "start"];
    const port = options?.port;

    if (port !== undefined) {
      assertProxyPort(port);
      args.push("--port", String(port));
    }

    if (options?.https) {
      args.push("--https");
    }

    if (options?.certPath) {
      args.push("--cert", assertText(options.certPath, "certPath"));
    }

    if (options?.keyPath) {
      args.push("--key", assertText(options.keyPath, "keyPath"));
    }

    return this.runPortless(args, options?.cwd, options?.env);
  }

  async stopProxy(options?: ProxyStopOptions): Promise<ProxyCommandResult> {
    return this.runPortless(["proxy", "stop"], options?.cwd, options?.env);
  }

  async killProxy(options?: ProxyStopOptions): Promise<ProxyCommandResult> {
    return this.stopProxy(options);
  }

  private async runPortless(
    args: string[],
    cwd?: string,
    env?: NodeJS.ProcessEnv,
  ): Promise<ProxyCommandResult> {
    const result = await execFileAsync(this.binaryPath, args, {
      cwd: cwd ?? this.defaultCwd,
      env: { ...process.env, ...this.defaultEnv, ...env },
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }
}

export const portlessClient = new PortlessClient();

export { DEFAULT_PORTLESS_PROXY_PORT } from "./constants.js";
export type {
  PortlessProxyCommandResult,
  PortlessSpawnInput,
  PortlessSpawnResult,
} from "./ipc.js";
