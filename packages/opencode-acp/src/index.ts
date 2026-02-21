import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import {
  createOpencodeClient,
  createOpencodeServer,
  type Agent,
  type AgentPartInput,
  type AssistantMessage,
  type Command,
  type Config,
  type Event as OpenCodeEvent,
  type FilePartInput,
  type FormatterStatus,
  type LspStatus,
  type McpStatus,
  type OpencodeClient,
  type Part,
  type Path,
  type ServerOptions as OpenCodeServerOptions,
  type Session,
  type SessionStatus,
  type SubtaskPartInput,
  type TextPartInput,
  type VcsInfo,
} from "@opencode-ai/sdk";

const execFileAsync = promisify(execFileCallback);

type ManagedServer = Awaited<ReturnType<typeof createOpencodeServer>>;

type UnwrappedResult<T> = {
  data?: T;
  error?: unknown;
};

interface ProviderCatalogModel {
  id: string;
  name: string;
  release_date: string;
  attachment: boolean;
  reasoning: boolean;
  temperature: boolean;
  tool_call: boolean;
  limit: {
    context: number;
    output: number;
  };
  modalities?: {
    input: Array<"text" | "audio" | "image" | "video" | "pdf">;
    output: Array<"text" | "audio" | "image" | "video" | "pdf">;
  };
  experimental?: boolean;
  status?: "alpha" | "beta" | "deprecated";
}

interface ProviderCatalog {
  id: string;
  name: string;
  models: Record<string, ProviderCatalogModel>;
}

interface ProviderCatalogResponse {
  all: ProviderCatalog[];
  default: Record<string, string>;
  connected: string[];
}

export type OpenCodeSyncMode = "blocking" | "background";

export type OpenCodeTransport = "managed" | "attached";

export interface OpenCodeModelRef {
  providerID: string;
  modelID: string;
}

export interface OpenCodeInstallationStatus {
  installed: boolean;
  binaryPath: string | null;
  version: string | null;
}

export interface OpenCodeRuntimeStatus extends OpenCodeInstallationStatus {
  connected: boolean;
  running: boolean;
  transport: OpenCodeTransport | null;
  baseUrl: string | null;
  cwd: string;
  syncMode: OpenCodeSyncMode;
  selectedModel: OpenCodeModelRef | null;
  connectedAt: number | null;
  lastEventAt: number | null;
}

export interface OpenCodeStartOptions {
  cwd?: string;
  hostname?: string;
  port?: number;
  timeout?: number;
  config?: OpenCodeServerOptions["config"];
  syncMode?: OpenCodeSyncMode;
}

export interface OpenCodeConnectOptions {
  baseUrl: string;
  cwd?: string;
  syncMode?: OpenCodeSyncMode;
}

export interface OpenCodeModelInfo {
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
  modalities?: {
    input: Array<"text" | "audio" | "image" | "video" | "pdf">;
    output: Array<"text" | "audio" | "image" | "video" | "pdf">;
  };
}

export type OpenCodePromptPartInput =
  | TextPartInput
  | FilePartInput
  | AgentPartInput
  | SubtaskPartInput;

export interface OpenCodePromptRequest {
  sessionID: string;
  text?: string;
  parts?: OpenCodePromptPartInput[];
  messageID?: string;
  agent?: string;
  model?: OpenCodeModelRef;
  noReply?: boolean;
  system?: string;
  syncMode?: OpenCodeSyncMode;
}

export type OpenCodePromptResult =
  | {
      mode: "blocking";
      response: {
        info: AssistantMessage;
        parts: Part[];
      };
    }
  | {
      mode: "background";
      accepted: true;
    };

export interface OpenCodeEventEnvelope {
  receivedAt: number;
  payload: OpenCodeEvent;
}

export interface OpenCodeOverview {
  status: OpenCodeRuntimeStatus;
  path: Path;
  vcs: VcsInfo;
  config: Config;
  sessions: Session[];
  sessionStatus: Record<string, SessionStatus>;
  commands: Command[];
  providers: ProviderCatalogResponse;
  models: OpenCodeModelInfo[];
  agents: Agent[];
  mcp: Record<string, McpStatus>;
  lsp: LspStatus[];
  formatter: FormatterStatus[];
}

export type OpenCodeEventListener = (event: OpenCodeEventEnvelope) => void;

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function parseVersion(raw: string): string | null {
  const cleaned = raw.trim();
  if (!cleaned) {
    return null;
  }

  const match = cleaned.match(/\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?/);
  return match?.[0] ?? null;
}

export class OpenCodeAcpApi {
  private client: OpencodeClient | null = null;
  private managedServer: ManagedServer | null = null;
  private transport: OpenCodeTransport | null = null;
  private baseUrl: string | null = null;
  private cwd = process.cwd();
  private syncMode: OpenCodeSyncMode = "blocking";
  private selectedModel: OpenCodeModelRef | null = null;
  private connectedAt: number | null = null;
  private lastEventAt: number | null = null;
  private eventAbortController: AbortController | null = null;
  private eventLoop: Promise<void> | null = null;
  private listeners = new Set<OpenCodeEventListener>();

  private requireClient(): OpencodeClient {
    if (!this.client) {
      throw new Error(
        "OpenCode client is not connected. Call startManagedServer() or connect() first.",
      );
    }

    return this.client;
  }

  private async unwrap<T>(resultPromise: Promise<unknown>, action: string): Promise<T> {
    const result = (await resultPromise) as UnwrappedResult<T>;
    if (result.error !== undefined) {
      throw new Error(`${action} failed: ${formatUnknownError(result.error)}`);
    }
    if (result.data === undefined) {
      throw new Error(`${action} returned no data`);
    }

    return result.data;
  }

  private stopEventStream() {
    if (this.eventAbortController) {
      this.eventAbortController.abort();
    }
    this.eventAbortController = null;
    this.eventLoop = null;
  }

  private startEventStream() {
    if (!this.client || this.eventLoop) {
      return;
    }

    const controller = new AbortController();
    const client = this.client;
    this.eventAbortController = controller;

    this.eventLoop = (async () => {
      try {
        const streamResult = await client.event.subscribe({
          signal: controller.signal,
        });
        for await (const event of streamResult.stream) {
          this.lastEventAt = Date.now();
          const envelope: OpenCodeEventEnvelope = {
            receivedAt: this.lastEventAt,
            payload: event,
          };

          for (const listener of [...this.listeners]) {
            listener(envelope);
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn("OpenCode event stream failed:", error);
        }
      } finally {
        if (this.eventAbortController === controller) {
          this.eventAbortController = null;
        }
        this.eventLoop = null;
      }
    })();
  }

  private async resolveOpenCodeBinaryPath(): Promise<string | null> {
    try {
      if (process.platform === "win32") {
        const { stdout } = await execFileAsync("where", ["opencode"], {
          timeout: 15_000,
        });
        const firstPath = stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find(Boolean);
        return firstPath ?? null;
      }

      const { stdout } = await execFileAsync("sh", ["-lc", "command -v opencode"], {
        timeout: 15_000,
      });
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }

  private async resolveOpenCodeVersion(): Promise<string | null> {
    try {
      const { stdout, stderr } = await execFileAsync("opencode", ["--version"], {
        timeout: 15_000,
      });
      const parsed = parseVersion(`${stdout}\n${stderr}`);
      return parsed;
    } catch {
      return null;
    }
  }

  private async hasExecutable(command: string): Promise<boolean> {
    try {
      await execFileAsync(command, ["--version"], { timeout: 15_000 });
      return true;
    } catch {
      return false;
    }
  }

  private buildPromptParts(request: OpenCodePromptRequest): OpenCodePromptPartInput[] {
    if (request.parts && request.parts.length > 0) {
      return request.parts;
    }

    const trimmed = request.text?.trim();
    if (!trimmed) {
      throw new Error("Prompt requires either `text` or at least one `parts` item.");
    }

    return [{ type: "text", text: trimmed }];
  }

  private async verifyClientConnectivity(client: OpencodeClient): Promise<void> {
    await this.unwrap<Path>(client.path.get({}), "path.get");
  }

  onEvent(listener: OpenCodeEventListener): () => void {
    this.listeners.add(listener);
    if (this.client && !this.eventLoop) {
      this.startEventStream();
    }

    return () => {
      this.listeners.delete(listener);
    };
  }

  async getInstallationStatus(): Promise<OpenCodeInstallationStatus> {
    const binaryPath = await this.resolveOpenCodeBinaryPath();
    if (!binaryPath) {
      return {
        installed: false,
        binaryPath: null,
        version: null,
      };
    }

    const version = await this.resolveOpenCodeVersion();
    return {
      installed: true,
      binaryPath,
      version,
    };
  }

  async ensureInstallation(options?: { installIfMissing?: boolean }): Promise<OpenCodeInstallationStatus> {
    const status = await this.getInstallationStatus();
    if (status.installed || !options?.installIfMissing) {
      return status;
    }

    await this.installOpenCodeCli();
    return this.getInstallationStatus();
  }

  async installOpenCodeCli(): Promise<OpenCodeInstallationStatus> {
    const hasNpm = await this.hasExecutable("npm");
    if (!hasNpm) {
      throw new Error(
        "npm is not installed. Install Node.js first to install OpenCode CLI.",
      );
    }

    await execFileAsync("npm", ["install", "-g", "opencode-ai"], {
      timeout: 10 * 60_000,
      maxBuffer: 1024 * 1024 * 10,
    });

    return this.getInstallationStatus();
  }

  async getStatus(): Promise<OpenCodeRuntimeStatus> {
    const installation = await this.getInstallationStatus();
    return {
      ...installation,
      connected: this.client !== null,
      running: this.managedServer !== null,
      transport: this.transport,
      baseUrl: this.baseUrl,
      cwd: this.cwd,
      syncMode: this.syncMode,
      selectedModel: this.selectedModel,
      connectedAt: this.connectedAt,
      lastEventAt: this.lastEventAt,
    };
  }

  async startManagedServer(options: OpenCodeStartOptions = {}): Promise<OpenCodeRuntimeStatus> {
    const installation = await this.ensureInstallation();
    if (!installation.installed) {
      throw new Error(
        "OpenCode CLI is not installed. Call ensureInstallation({ installIfMissing: true }) first.",
      );
    }

    await this.stop();

    this.cwd = options.cwd ?? this.cwd;
    this.syncMode = options.syncMode ?? this.syncMode;

    const serverOptions: OpenCodeServerOptions = {
      hostname: options.hostname,
      port: options.port,
      timeout: options.timeout,
      config: options.config,
    };

    try {
      const server = await createOpencodeServer(serverOptions);
      const client = createOpencodeClient({
        baseUrl: server.url,
        directory: this.cwd,
      });

      await this.verifyClientConnectivity(client);

      this.managedServer = server;
      this.client = client;
      this.baseUrl = server.url;
      this.transport = "managed";
      this.connectedAt = Date.now();
      this.startEventStream();

      return this.getStatus();
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  async connect(options: OpenCodeConnectOptions): Promise<OpenCodeRuntimeStatus> {
    await this.stop();

    this.cwd = options.cwd ?? this.cwd;
    this.syncMode = options.syncMode ?? this.syncMode;

    const client = createOpencodeClient({
      baseUrl: options.baseUrl,
      directory: this.cwd,
    });

    await this.verifyClientConnectivity(client);

    this.client = client;
    this.baseUrl = options.baseUrl;
    this.transport = "attached";
    this.connectedAt = Date.now();
    this.startEventStream();

    return this.getStatus();
  }

  async stop(): Promise<void> {
    this.stopEventStream();

    if (this.managedServer) {
      this.managedServer.close();
    }

    this.managedServer = null;
    this.client = null;
    this.baseUrl = null;
    this.transport = null;
    this.connectedAt = null;
    this.lastEventAt = null;
  }

  setSyncMode(mode: OpenCodeSyncMode): OpenCodeSyncMode {
    this.syncMode = mode;
    return this.syncMode;
  }

  getSyncMode(): OpenCodeSyncMode {
    return this.syncMode;
  }

  async listProviders(): Promise<ProviderCatalogResponse> {
    const client = this.requireClient();
    return this.unwrap<ProviderCatalogResponse>(
      client.provider.list({}),
      "provider.list",
    );
  }

  async listModels(): Promise<OpenCodeModelInfo[]> {
    const providers = await this.listProviders();
    const connected = new Set(providers.connected);

    return providers.all.flatMap((provider) =>
      Object.values(provider.models).map((model) => ({
        id: `${provider.id}/${model.id}`,
        providerID: provider.id,
        providerName: provider.name,
        modelID: model.id,
        modelName: model.name,
        releaseDate: model.release_date,
        connected: connected.has(provider.id),
        isDefault: providers.default[provider.id] === model.id,
        experimental: model.experimental ?? false,
        status: model.status ?? "active",
        capabilities: {
          attachment: model.attachment,
          reasoning: model.reasoning,
          temperature: model.temperature,
          toolCall: model.tool_call,
        },
        limits: {
          context: model.limit.context,
          output: model.limit.output,
        },
        modalities: model.modalities,
      })),
    );
  }

  async listAgents(): Promise<Agent[]> {
    const client = this.requireClient();
    return this.unwrap<Agent[]>(client.app.agents({}), "app.agents");
  }

  async listSessions(): Promise<Session[]> {
    const client = this.requireClient();
    return this.unwrap<Session[]>(client.session.list({}), "session.list");
  }

  async createSession(input?: {
    title?: string;
    parentID?: string;
  }): Promise<Session> {
    const client = this.requireClient();
    return this.unwrap<Session>(
      client.session.create({
        body: input,
      }),
      "session.create",
    );
  }

  async getSessionStatus(sessionID: string): Promise<SessionStatus | null> {
    const client = this.requireClient();
    const statuses = await this.unwrap<Record<string, SessionStatus>>(
      client.session.status({}),
      "session.status",
    );
    return statuses[sessionID] ?? null;
  }

  async setModel(model: OpenCodeModelRef, options?: { persist?: boolean }): Promise<OpenCodeModelRef> {
    const persist = options?.persist ?? true;
    const client = this.requireClient();

    if (persist) {
      await this.unwrap<Config>(
        client.config.update({
          body: { model: `${model.providerID}/${model.modelID}` },
        }),
        "config.update",
      );
    }

    this.selectedModel = { ...model };
    return this.selectedModel;
  }

  getSelectedModel(): OpenCodeModelRef | null {
    return this.selectedModel;
  }

  async listCommands(): Promise<Command[]> {
    const client = this.requireClient();
    return this.unwrap<Command[]>(client.command.list({}), "command.list");
  }

  async prompt(request: OpenCodePromptRequest): Promise<OpenCodePromptResult> {
    const client = this.requireClient();
    const syncMode = request.syncMode ?? this.syncMode;
    const model = request.model ?? this.selectedModel ?? undefined;
    const parts = this.buildPromptParts(request);

    const body: {
      messageID?: string;
      model?: OpenCodeModelRef;
      agent?: string;
      noReply?: boolean;
      system?: string;
      parts: OpenCodePromptPartInput[];
    } = {
      parts,
      model,
      agent: request.agent,
      system: request.system,
      noReply: request.noReply,
      messageID: request.messageID,
    };

    if (syncMode === "background") {
      await this.unwrap<void>(
        client.session.promptAsync({
          path: { id: request.sessionID },
          body,
        }),
        "session.promptAsync",
      );

      return {
        mode: "background",
        accepted: true,
      };
    }

    const response = await this.unwrap<{
      info: AssistantMessage;
      parts: Part[];
    }>(
      client.session.prompt({
        path: { id: request.sessionID },
        body,
      }),
      "session.prompt",
    );

    return {
      mode: "blocking",
      response,
    };
  }

  async getOverview(): Promise<OpenCodeOverview> {
    const client = this.requireClient();

    const [status, path, vcs, config, sessions, sessionStatus, commands, providers, models, agents, mcp, lsp, formatter] =
      await Promise.all([
        this.getStatus(),
        this.unwrap<Path>(client.path.get({}), "path.get"),
        this.unwrap<VcsInfo>(client.vcs.get({}), "vcs.get"),
        this.unwrap<Config>(client.config.get({}), "config.get"),
        this.unwrap<Session[]>(client.session.list({}), "session.list"),
        this.unwrap<Record<string, SessionStatus>>(
          client.session.status({}),
          "session.status",
        ),
        this.unwrap<Command[]>(client.command.list({}), "command.list"),
        this.listProviders(),
        this.listModels(),
        this.unwrap<Agent[]>(client.app.agents({}), "app.agents"),
        this.unwrap<Record<string, McpStatus>>(client.mcp.status({}), "mcp.status"),
        this.unwrap<LspStatus[]>(client.lsp.status({}), "lsp.status"),
        this.unwrap<FormatterStatus[]>(client.formatter.status({}), "formatter.status"),
      ]);

    return {
      status,
      path,
      vcs,
      config,
      sessions,
      sessionStatus,
      commands,
      providers,
      models,
      agents,
      mcp,
      lsp,
      formatter,
    };
  }
}
