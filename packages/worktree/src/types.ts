export interface CloneOptions {
  /** Remote URL (HTTPS or SSH). */
  url: string;
  /** Local path where the repo will be created. */
  dest: string;
  /** Clone as bare repo (recommended for worktree-only usage). Default: true */
  bare?: boolean;
  /** Branch to checkout after clone. If omitted, uses the remote default. */
  branch?: string;
}

export interface CloneResult {
  /** Absolute path to the cloned repo. */
  path: string;
}

export interface CreateWorktreeOptions {
  /** Path to the base repository. */
  repoPath: string;
  /** Path where the worktree will be created. */
  worktreePath: string;
  /** Branch name to create/checkout in the worktree. */
  branch: string;
  /**
   * Start point (commit, branch, tag) for a new branch.
   * If provided, creates a new branch from this start point.
   * If omitted, checks out an existing branch.
   */
  startPoint?: string;
}

export interface WorktreeInfo {
  /** Absolute path to the worktree directory. */
  path: string;
  /** HEAD commit SHA. */
  head: string;
  /** Branch name, or null if detached HEAD. */
  branch: string | null;
}

export interface ExecOptions {
  /** Working directory to run the command in. */
  cwd: string;
  /** Environment variables to merge with process.env. */
  env?: Record<string, string>;
  /** Timeout in milliseconds. Default: 60_000 (1 minute). */
  timeout?: number;
  /** Signal to abort the operation. */
  signal?: AbortSignal;
}

export interface ExecResult {
  /** Exit code of the process. */
  exitCode: number;
  /** Combined stdout as string. */
  stdout: string;
  /** Combined stderr as string. */
  stderr: string;
}
