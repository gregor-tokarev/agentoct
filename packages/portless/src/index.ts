import {
  execFile as execFileCallback,
  spawn,
  type ChildProcess,
} from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFileCallback);

const DEFAULT_TIMEOUT = 60_000;
const DEFAULT_PROXY_PORT = 1_355;
const MAX_BUFFER = 10 * 1024 * 1024;
const DOMAIN_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export type PortlessCommandErrorCode =
  | "COMMAND_NOT_FOUND"
  | "INVALID_COMMAND"
  | "INVALID_DOMAIN"
  | "INVALID_PORT"
  | "SPAWN_FAILED";

export class PortlessCommandError extends Error {
  override readonly name = "PortlessCommandError";
  readonly code: PortlessCommandErrorCode;
  override readonly cause?: string;

  constructor(code: PortlessCommandErrorCode, message: string, cause?: string) {
    super(message);
    this.code = code;
    this.cause = cause;
  }
}

export interface PortlessExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface PortlessCommandOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
  timeout?: number;
  binaryPath?: string;
}

export interface PortlessProxyOptions {
  proxyPort?: number;
  https?: boolean;
  certPath?: string;
  keyPath?: string;
  noTls?: boolean;
}

export interface StartProxyOptions
  extends PortlessCommandOptions,
    PortlessProxyOptions {
  foreground?: boolean;
}

export interface SpawnDomainOptions
  extends PortlessCommandOptions,
    PortlessProxyOptions {
  domain: string;
  command: string;
  args?: string[];
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}

export interface SpawnDomainFromPortOptions
  extends PortlessCommandOptions,
    PortlessProxyOptions {
  domain: string;
  targetPort: number;
  targetHost?: string;
  nodePath?: string;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}

export interface SpawnedPortlessDomain {
  domain: string;
  hostname: string;
  url: string;
  process: ChildProcess;
  waitForExit: () => Promise<PortlessExecResult>;
  stop: (signal?: NodeJS.Signals | number) => Promise<PortlessExecResult>;
}

interface ExecFileError {
  code: number | string | null;
  stdout?: string;
  stderr?: string;
}

function isExecFileError(error: unknown): error is ExecFileError {
  return error instanceof Error && "stdout" in error && "stderr" in error;
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function toExitCode(code: number | string | null): number {
  if (typeof code === "number") {
    return code;
  }

  return 1;
}

function normalizeDomain(rawDomain: string): string {
  const domain = rawDomain.trim().toLowerCase();
  if (domain.endsWith(".localhost")) {
    return domain.slice(0, -".localhost".length);
  }

  return domain;
}

function assertValidDomain(domain: string): void {
  if (!domain) {
    throw new PortlessCommandError(
      "INVALID_DOMAIN",
      "Domain is required, for example: myapp or api.myapp",
    );
  }

  const labels = domain.split(".");
  for (const label of labels) {
    if (!label || !DOMAIN_LABEL_PATTERN.test(label)) {
      throw new PortlessCommandError(
        "INVALID_DOMAIN",
        `Invalid domain "${domain}". Use letters, numbers, dashes, and optional dots.`,
      );
    }
  }
}

function assertValidPort(port: number): void {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new PortlessCommandError(
      "INVALID_PORT",
      `Invalid proxy port "${port}". Expected an integer between 1 and 65535.`,
    );
  }
}

function assertValidHost(host: string): void {
  if (!host.trim()) {
    throw new PortlessCommandError(
      "INVALID_COMMAND",
      "Target host is required when spawning a domain from an existing port.",
    );
  }
}

function appendProxyFlags(args: string[], options: PortlessProxyOptions): void {
  if (options.proxyPort !== undefined) {
    assertValidPort(options.proxyPort);
    args.push("--port", String(options.proxyPort));
  }

  if (options.https) {
    args.push("--https");
  }

  if (options.certPath) {
    args.push("--cert", options.certPath);
  }

  if (options.keyPath) {
    args.push("--key", options.keyPath);
  }

  if (options.noTls) {
    args.push("--no-tls");
  }
}

function resolveUrlScheme(options: PortlessProxyOptions): "http" | "https" {
  if (options.noTls) {
    return "http";
  }

  if (options.https || options.certPath || options.keyPath) {
    return "https";
  }

  return "http";
}

function getCommand(binaryPath?: string): string {
  return binaryPath ?? "portless";
}

function mergeEnv(env?: Record<string, string | undefined>) {
  if (!env) {
    return process.env;
  }

  return { ...process.env, ...env };
}

async function runPortless(
  args: string[],
  options: PortlessCommandOptions = {},
): Promise<PortlessExecResult> {
  const command = getCommand(options.binaryPath);

  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: options.cwd,
      env: mergeEnv(options.env),
      timeout: options.timeout ?? DEFAULT_TIMEOUT,
      maxBuffer: MAX_BUFFER,
    });

    return {
      exitCode: 0,
      stdout,
      stderr,
    };
  } catch (error: unknown) {
    if (isExecFileError(error)) {
      return {
        exitCode: toExitCode(error.code),
        stdout: error.stdout ?? "",
        stderr: error.stderr ?? "",
      };
    }

    if (isErrnoException(error) && error.code === "ENOENT") {
      throw new PortlessCommandError(
        "COMMAND_NOT_FOUND",
        `Unable to find "${command}" in PATH.`,
        error.message,
      );
    }

    throw error;
  }
}

export function buildDomainUrl(
  domainInput: string,
  options: PortlessProxyOptions = {},
): string {
  const domain = normalizeDomain(domainInput);
  assertValidDomain(domain);
  const scheme = resolveUrlScheme(options);
  const port = options.proxyPort ?? DEFAULT_PROXY_PORT;
  return `${scheme}://${domain}.localhost:${port}`;
}

export async function isPortlessInstalled(
  options: PortlessCommandOptions = {},
): Promise<boolean> {
  try {
    const result = await runPortless(["--version"], options);
    return result.exitCode === 0;
  } catch (error) {
    if (
      error instanceof PortlessCommandError &&
      error.code === "COMMAND_NOT_FOUND"
    ) {
      return false;
    }

    throw error;
  }
}

export async function startProxy(
  options: StartProxyOptions = {},
): Promise<PortlessExecResult> {
  const args = ["proxy", "start"];
  appendProxyFlags(args, options);

  if (options.foreground) {
    args.push("--foreground");
  }

  return runPortless(args, options);
}

export async function stopProxy(
  options: PortlessCommandOptions = {},
): Promise<PortlessExecResult> {
  return runPortless(["proxy", "stop"], options);
}

export async function killProxy(
  options: PortlessCommandOptions = {},
): Promise<PortlessExecResult> {
  return stopProxy(options);
}

export async function listRoutes(
  options: PortlessCommandOptions = {},
): Promise<PortlessExecResult> {
  return runPortless(["list"], options);
}

export function spawnDomain(options: SpawnDomainOptions): SpawnedPortlessDomain {
  const domain = normalizeDomain(options.domain);
  assertValidDomain(domain);

  const command = options.command.trim();
  if (!command) {
    throw new PortlessCommandError(
      "INVALID_COMMAND",
      "Command is required to spawn a new domain.",
    );
  }

  const args: string[] = [];
  appendProxyFlags(args, options);
  args.push(domain, command, ...(options.args ?? []));

  const child = spawn(getCommand(options.binaryPath), args, {
    cwd: options.cwd,
    env: mergeEnv(options.env),
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";

  child.stdout?.on("data", (chunk: Buffer | string) => {
    const text = typeof chunk === "string" ? chunk : chunk.toString();
    stdout += text;
    options.onStdout?.(text);
  });

  child.stderr?.on("data", (chunk: Buffer | string) => {
    const text = typeof chunk === "string" ? chunk : chunk.toString();
    stderr += text;
    options.onStderr?.(text);
  });

  const completion = new Promise<PortlessExecResult>((resolve, reject) => {
    child.once("error", (error: Error) => {
      if (isErrnoException(error) && error.code === "ENOENT") {
        reject(
          new PortlessCommandError(
            "COMMAND_NOT_FOUND",
            `Unable to find "${getCommand(options.binaryPath)}" in PATH.`,
            error.message,
          ),
        );
        return;
      }

      reject(
        new PortlessCommandError(
          "SPAWN_FAILED",
          "Failed to spawn a portless domain process.",
          error.message,
        ),
      );
    });

    child.once("close", (code) => {
      resolve({
        exitCode: toExitCode(code),
        stdout,
        stderr,
      });
    });
  });

  return {
    domain,
    hostname: `${domain}.localhost`,
    url: buildDomainUrl(domain, options),
    process: child,
    waitForExit: () => completion,
    stop: async (signal: NodeJS.Signals | number = "SIGTERM") => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill(signal);
      }

      return completion;
    },
  };
}

function createForwarderScript(): string {
  return [
    'const net=require("node:net");',
    "const targetHost=process.argv[1];",
    "const targetPort=Number(process.argv[2]);",
    "const listenPort=Number(process.env.PORT);",
    "if(!Number.isInteger(targetPort)||targetPort<1||targetPort>65535){",
    '  console.error("Invalid target port:", process.argv[2]);',
    "  process.exit(2);",
    "}",
    "if(!targetHost){",
    '  console.error("Missing target host");',
    "  process.exit(2);",
    "}",
    "if(!Number.isInteger(listenPort)||listenPort<1||listenPort>65535){",
    '  console.error("Invalid listen port from PORT env:", process.env.PORT);',
    "  process.exit(2);",
    "}",
    "const server=net.createServer((client)=>{",
    "  const upstream=net.connect({host:targetHost,port:targetPort});",
    "  client.pipe(upstream);",
    "  upstream.pipe(client);",
    "  const close=()=>{",
    "    if(!client.destroyed) client.destroy();",
    "    if(!upstream.destroyed) upstream.destroy();",
    "  };",
    "  client.on('error', close);",
    "  upstream.on('error', close);",
    "});",
    "server.on('error',(error)=>{",
    "  console.error(error instanceof Error ? error.message : String(error));",
    "  process.exit(1);",
    "});",
    "server.listen(listenPort,'127.0.0.1',()=>{",
    "  console.log('Forwarding '+listenPort+' -> '+targetHost+':'+targetPort);",
    "});",
    "const shutdown=()=>server.close(()=>process.exit(0));",
    "process.on('SIGTERM',shutdown);",
    "process.on('SIGINT',shutdown);",
  ].join("\n");
}

export function spawnDomainFromPort(
  options: SpawnDomainFromPortOptions,
): SpawnedPortlessDomain {
  assertValidPort(options.targetPort);
  const targetHost = options.targetHost ?? "127.0.0.1";
  assertValidHost(targetHost);

  return spawnDomain({
    domain: options.domain,
    command: options.nodePath ?? "node",
    args: [
      "-e",
      createForwarderScript(),
      targetHost,
      String(options.targetPort),
    ],
    proxyPort: options.proxyPort,
    https: options.https,
    certPath: options.certPath,
    keyPath: options.keyPath,
    noTls: options.noTls,
    cwd: options.cwd,
    env: options.env,
    timeout: options.timeout,
    binaryPath: options.binaryPath,
    onStdout: options.onStdout,
    onStderr: options.onStderr,
  });
}

export function attachDomainToPort(
  options: SpawnDomainFromPortOptions,
): SpawnedPortlessDomain {
  return spawnDomainFromPort(options);
}

export class PortlessClient {
  constructor(private readonly defaults: PortlessCommandOptions = {}) {}

  isInstalled(): Promise<boolean> {
    return isPortlessInstalled(this.defaults);
  }

  startProxy(options: StartProxyOptions = {}): Promise<PortlessExecResult> {
    return startProxy({ ...this.defaults, ...options });
  }

  stopProxy(options: PortlessCommandOptions = {}): Promise<PortlessExecResult> {
    return stopProxy({ ...this.defaults, ...options });
  }

  killProxy(options: PortlessCommandOptions = {}): Promise<PortlessExecResult> {
    return killProxy({ ...this.defaults, ...options });
  }

  listRoutes(options: PortlessCommandOptions = {}): Promise<PortlessExecResult> {
    return listRoutes({ ...this.defaults, ...options });
  }

  spawnDomain(options: SpawnDomainOptions): SpawnedPortlessDomain {
    return spawnDomain({ ...this.defaults, ...options });
  }

  spawnDomainFromPort(
    options: SpawnDomainFromPortOptions,
  ): SpawnedPortlessDomain {
    return spawnDomainFromPort({ ...this.defaults, ...options });
  }

  attachDomainToPort(
    options: SpawnDomainFromPortOptions,
  ): SpawnedPortlessDomain {
    return attachDomainToPort({ ...this.defaults, ...options });
  }
}

export function createPortlessClient(
  options: PortlessCommandOptions = {},
): PortlessClient {
  return new PortlessClient(options);
}
