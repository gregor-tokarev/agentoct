import { app, BrowserWindow, ipcMain } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PortlessClient } from "@agentoct/portless";
import {
  PORTLESS_IPC_CHANNELS,
  type PortlessSpawnInput,
  type PortlessSpawnResult,
} from "@agentoct/portless/ipc";
import {
  DEPENDENCIES,
  checkDependency,
  installDependency,
  type DependencyStatus,
} from "./deps.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let dependencyStatuses: DependencyStatus[] | null = null;
let hasStartedDependencyCheck = false;
let nextPortlessSessionId = 1;

const portless = new PortlessClient();
const portlessSessions = new Map<
  number,
  ReturnType<PortlessClient["spawnDomain"]>
>();
const workspaceRoot = path.resolve(process.cwd());
const allowedPortlessCommands = new Set([
  "bun",
  "bunx",
  "node",
  "npm",
  "npx",
  "pnpm",
  "pnpx",
  "yarn",
]);

function createWindow() {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      webviewTag: true,
    },
  });
  mainWindow = window;

  window.webContents.on("did-finish-load", () => {
    if (dependencyStatuses) {
      sendDepsStatus(dependencyStatuses);
      return;
    }

    startDependencyCheckOnce();
  });

  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  window.loadFile(path.join(__dirname, "renderer/index.html"));
}

function sendDepsStatus(statuses: DependencyStatus[]) {
  if (
    !mainWindow ||
    mainWindow.isDestroyed() ||
    mainWindow.webContents.isDestroyed()
  ) {
    return;
  }

  mainWindow.webContents.send("deps:status", statuses);
}

function sendNavigateToUrl(url: string) {
  if (
    !mainWindow ||
    mainWindow.isDestroyed() ||
    mainWindow.webContents.isDestroyed()
  ) {
    return;
  }

  mainWindow.webContents.send("navigate-to-url", url);
}

function updateDependencyStatuses(statuses: DependencyStatus[]) {
  dependencyStatuses = statuses.map((status) => ({ ...status }));
  sendDepsStatus(dependencyStatuses);
}

async function checkAndInstallDeps() {
  const statuses: DependencyStatus[] = await Promise.all(
    DEPENDENCIES.map(async (dep) => ({
      name: dep.name,
      installed: await checkDependency(dep),
      installing: false,
    })),
  );

  updateDependencyStatuses(statuses);

  for (let i = 0; i < DEPENDENCIES.length; i++) {
    const status = statuses[i]!;
    const dep = DEPENDENCIES[i]!;

    if (!status.installed) {
      status.installing = true;
      updateDependencyStatuses(statuses);

      try {
        await installDependency(dep);
        status.installed = true;
        status.installing = false;
      } catch (err) {
        status.installing = false;
        status.error = err instanceof Error ? err.message : String(err);
      }

      updateDependencyStatuses(statuses);
    }
  }
}

function startDependencyCheckOnce() {
  if (hasStartedDependencyCheck) {
    return;
  }

  hasStartedDependencyCheck = true;
  void checkAndInstallDeps().catch((err) => {
    console.error("Dependency check failed:", err);
  });
}

function normalizePortlessDomain(rawDomain: unknown): string {
  if (typeof rawDomain !== "string") {
    throw new Error('Expected "domain" to be a string');
  }

  const domain = rawDomain.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(domain)) {
    throw new Error(
      'Expected "domain" to be a valid localhost subdomain label',
    );
  }

  return domain;
}

function normalizePortlessCommand(rawCommand: unknown): string {
  if (typeof rawCommand !== "string") {
    throw new Error('Expected "command" to be a string');
  }

  const command = rawCommand.trim();
  if (!allowedPortlessCommands.has(command)) {
    throw new Error(`Unsupported command "${command}" for portless spawn`);
  }

  return command;
}

function normalizePortlessArgs(rawArgs: unknown): string[] | undefined {
  if (rawArgs === undefined) {
    return undefined;
  }

  if (
    !Array.isArray(rawArgs) ||
    !rawArgs.every((arg) => typeof arg === "string")
  ) {
    throw new Error('Expected "args" to be an array of strings');
  }

  return rawArgs;
}

function normalizePortlessCwd(rawCwd: unknown): string {
  if (rawCwd === undefined || rawCwd === "") {
    return workspaceRoot;
  }

  if (typeof rawCwd !== "string") {
    throw new Error('Expected "cwd" to be a string');
  }

  const resolvedCwd = path.resolve(workspaceRoot, rawCwd);
  const relativePath = path.relative(workspaceRoot, resolvedCwd);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error('Expected "cwd" to resolve inside the workspace root');
  }

  if (
    !fs.existsSync(resolvedCwd) ||
    !fs.statSync(resolvedCwd).isDirectory()
  ) {
    throw new Error('Expected "cwd" to point to an existing directory');
  }

  return resolvedCwd;
}

function normalizePortlessSpawnInput(rawInput: unknown): PortlessSpawnInput {
  if (!rawInput || typeof rawInput !== "object") {
    throw new Error("Expected portless spawn payload object");
  }

  const input = rawInput as {
    domain?: unknown;
    command?: unknown;
    args?: unknown;
    cwd?: unknown;
  };

  return {
    domain: normalizePortlessDomain(input.domain),
    command: normalizePortlessCommand(input.command),
    args: normalizePortlessArgs(input.args),
    cwd: normalizePortlessCwd(input.cwd),
  };
}

function parseSessionId(rawSessionId: unknown): number | null {
  if (typeof rawSessionId !== "number" || !Number.isInteger(rawSessionId)) {
    return null;
  }

  if (rawSessionId < 1) {
    return null;
  }

  return rawSessionId;
}

function spawnPortlessDomain(rawInput: unknown): PortlessSpawnResult {
  const input = normalizePortlessSpawnInput(rawInput);
  const session = portless.spawnDomain(input);
  const sessionId = nextPortlessSessionId++;

  portlessSessions.set(sessionId, session);

  const cleanup = () => {
    portlessSessions.delete(sessionId);
  };

  session.process.once("exit", cleanup);
  session.process.once("error", cleanup);

  return {
    sessionId,
    pid: session.process.pid ?? null,
    url: session.url,
  };
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle("open-url", (_event, url: string) => {
    sendNavigateToUrl(url);
  });

  ipcMain.handle(
    PORTLESS_IPC_CHANNELS.spawnDomain,
    (_event, input: unknown) => spawnPortlessDomain(input),
  );

  ipcMain.handle(
    PORTLESS_IPC_CHANNELS.killDomain,
    (_event, rawSessionId: unknown) => {
      const sessionId = parseSessionId(rawSessionId);
      if (!sessionId) {
        return false;
      }

      const session = portlessSessions.get(sessionId);
      if (!session) {
        return false;
      }

      return session.kill();
    },
  );

  ipcMain.handle(PORTLESS_IPC_CHANNELS.stopProxy, async () => {
    const result = await portless.killProxy();
    return result;
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  for (const session of portlessSessions.values()) {
    session.kill();
  }
  portlessSessions.clear();

  if (process.platform !== "darwin") {
    app.quit();
  }
});
