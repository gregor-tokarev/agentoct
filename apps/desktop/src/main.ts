import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PortlessClient } from "@agentoct/portless";
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

function spawnPortlessDomain(input: {
  domain: string;
  command: string;
  args?: string[];
  cwd?: string;
}) {
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
    "portless:spawn-domain",
    (_event, input: { domain: string; command: string; args?: string[]; cwd?: string }) =>
      spawnPortlessDomain(input),
  );

  ipcMain.handle("portless:kill-domain", (_event, sessionId: number) => {
    const session = portlessSessions.get(sessionId);
    if (!session) {
      return false;
    }

    return session.kill();
  });

  ipcMain.handle("portless:stop-proxy", async () => {
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
