import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const currentPlatform = process.platform;

export interface DependencyDef {
  name: string;
  command: string;
  resolveInstallCmd: () => Promise<string | null>;
}

export interface DependencyStatus {
  name: string;
  installed: boolean;
  installing: boolean;
  error?: string;
}

// --- Shell execution helpers ---

function getShellOptions(): { shell: string; env: Record<string, string | undefined> } {
  if (currentPlatform === "win32") {
    return {
      shell: "cmd.exe",
      env: { ...process.env },
    };
  }

  return {
    shell: currentPlatform === "darwin" ? "/bin/zsh" : "/bin/bash",
    env: {
      ...process.env,
      PATH: [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/usr/bin",
        "/bin",
        "/usr/sbin",
        "/sbin",
        process.env.PATH,
      ].join(":"),
    },
  };
}

function shellExec(cmd: string): Promise<{ stdout: string; stderr: string }> {
  const opts = getShellOptions();
  return execAsync(cmd, { ...opts, timeout: 300_000 });
}

export async function commandExists(command: string): Promise<boolean> {
  try {
    const checkCmd =
      currentPlatform === "win32"
        ? `where ${command}`
        : `command -v ${command}`;
    await shellExec(checkCmd);
    return true;
  } catch {
    return false;
  }
}

// --- Package manager detection ---

const SYSTEM_PKG_MANAGERS = {
  darwin: ["brew"],
  linux: ["apt-get", "dnf", "yum", "pacman"],
  win32: ["winget", "choco", "scoop"],
} as const;

let cachedPkgManager: string | null | undefined;

async function detectSystemPackageManager(): Promise<string | null> {
  if (cachedPkgManager !== undefined) return cachedPkgManager;

  const candidates =
    SYSTEM_PKG_MANAGERS[currentPlatform as keyof typeof SYSTEM_PKG_MANAGERS] ??
    [];

  for (const pm of candidates) {
    if (await commandExists(pm)) {
      cachedPkgManager = pm;
      return pm;
    }
  }

  cachedPkgManager = null;
  return null;
}

// --- Install command resolution ---

const GIT_INSTALL: Record<string, string> = {
  brew: "brew install git",
  "apt-get": "sudo apt-get install -y git",
  dnf: "sudo dnf install -y git",
  yum: "sudo yum install -y git",
  pacman: "sudo pacman -S --noconfirm git",
  winget: "winget install --id Git.Git -e --source winget",
  choco: "choco install git -y",
  scoop: "scoop install git",
};

const GH_INSTALL: Record<string, string> = {
  brew: "brew install gh",
  "apt-get": "sudo apt-get install -y gh",
  dnf: "sudo dnf install -y gh",
  yum: "sudo yum install -y gh",
  pacman: "sudo pacman -S --noconfirm github-cli",
  winget: "winget install --id GitHub.cli -e --source winget",
  choco: "choco install gh -y",
  scoop: "scoop install gh",
};

async function resolveNpmInstall(pkg: string): Promise<string | null> {
  if (await commandExists("npm")) return `npm install -g ${pkg}`;
  return null;
}

async function resolveSystemInstall(
  installMap: Record<string, string>,
): Promise<string | null> {
  const pm = await detectSystemPackageManager();
  if (!pm) return null;
  return installMap[pm] ?? null;
}

function missingToolMessage(depName: string): string {
  if (currentPlatform === "win32") {
    return `Cannot auto-install ${depName}. Please install a package manager (winget or choco) or install ${depName} manually.`;
  }
  if (currentPlatform === "darwin") {
    return `Cannot auto-install ${depName}. Please install Homebrew (https://brew.sh) or install ${depName} manually.`;
  }
  return `Cannot auto-install ${depName}. No supported package manager found (apt-get, dnf, yum, pacman). Please install ${depName} manually.`;
}

function missingNpmMessage(depName: string): string {
  return `Cannot auto-install ${depName}. npm is not available. Please install Node.js (https://nodejs.org) first.`;
}

// --- Dependency definitions ---

export const DEPENDENCIES: DependencyDef[] = [
  {
    name: "agent-browser",
    command: "agent-browser",
    resolveInstallCmd: () => resolveNpmInstall("agent-browser"),
  },
  {
    name: "portless",
    command: "portless",
    resolveInstallCmd: () => resolveNpmInstall("portless"),
  },
  {
    name: "Git",
    command: "git",
    resolveInstallCmd: () => resolveSystemInstall(GIT_INSTALL),
  },
  {
    name: "GitHub CLI",
    command: "gh",
    resolveInstallCmd: () => resolveSystemInstall(GH_INSTALL),
  },
  {
    name: "Convex CLI",
    command: "convex",
    resolveInstallCmd: () => resolveNpmInstall("convex"),
  },
  {
    name: "OpenCode CLI",
    command: "opencode",
    resolveInstallCmd: () => resolveNpmInstall("opencode-ai"),
  },
];

// --- Public API ---

export async function checkDependency(dep: DependencyDef): Promise<boolean> {
  return commandExists(dep.command);
}

export async function installDependency(dep: DependencyDef): Promise<void> {
  const cmd = await dep.resolveInstallCmd();
  if (!cmd) {
    const isNpm = ["agent-browser", "portless", "convex", "opencode"].includes(
      dep.command,
    );
    throw new Error(
      isNpm ? missingNpmMessage(dep.name) : missingToolMessage(dep.name),
    );
  }
  await shellExec(cmd);
}

export async function checkAllDependencies(): Promise<DependencyStatus[]> {
  return Promise.all(
    DEPENDENCIES.map(async (dep) => ({
      name: dep.name,
      installed: await checkDependency(dep),
      installing: false,
    })),
  );
}
