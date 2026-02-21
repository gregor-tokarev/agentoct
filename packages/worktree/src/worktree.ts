import { resolve } from "node:path";
import { git } from "./exec.js";
import { WorktreeError } from "./errors.js";
import type { CreateWorktreeOptions, WorktreeInfo } from "./types.js";

/**
 * Create a new worktree from a base repository.
 */
export async function createWorktree(
  options: CreateWorktreeOptions,
): Promise<WorktreeInfo> {
  const worktreePath = resolve(options.worktreePath);
  const args = ["worktree", "add"];

  if (options.startPoint) {
    args.push("-b", options.branch, worktreePath, options.startPoint);
  } else {
    args.push(worktreePath, options.branch);
  }

  const result = await git(args, { cwd: options.repoPath });

  if (result.exitCode !== 0) {
    throw new WorktreeError(
      "WORKTREE_CREATE_FAILED",
      `Failed to create worktree at ${worktreePath}`,
      result.stderr,
    );
  }

  const head = await resolveHead(worktreePath);

  return { path: worktreePath, head, branch: options.branch };
}

/**
 * List all worktrees for a repository.
 */
export async function listWorktrees(
  repoPath: string,
): Promise<WorktreeInfo[]> {
  const result = await git(["worktree", "list", "--porcelain"], {
    cwd: repoPath,
  });

  if (result.exitCode !== 0) {
    throw new WorktreeError(
      "REPO_NOT_FOUND",
      `Failed to list worktrees for ${repoPath}`,
      result.stderr,
    );
  }

  return parseWorktreeList(result.stdout);
}

/**
 * Remove a worktree.
 */
export async function removeWorktree(
  repoPath: string,
  worktreePath: string,
  options?: { force?: boolean },
): Promise<void> {
  const absPath = resolve(worktreePath);
  const args = ["worktree", "remove"];

  if (options?.force) {
    args.push("--force");
  }

  args.push(absPath);

  const result = await git(args, { cwd: repoPath });

  if (result.exitCode !== 0) {
    throw new WorktreeError(
      "WORKTREE_REMOVE_FAILED",
      `Failed to remove worktree at ${absPath}`,
      result.stderr,
    );
  }
}

/**
 * Prune stale worktree references (worktrees whose directories were deleted).
 */
export async function pruneWorktrees(repoPath: string): Promise<void> {
  await git(["worktree", "prune"], { cwd: repoPath });
}

async function resolveHead(worktreePath: string): Promise<string> {
  const result = await git(["rev-parse", "HEAD"], { cwd: worktreePath });
  return result.stdout.trim();
}

function parseWorktreeList(output: string): WorktreeInfo[] {
  const worktrees: WorktreeInfo[] = [];
  const blocks = output.split("\n\n").filter(Boolean);

  for (const block of blocks) {
    const lines = block.split("\n");
    let path = "";
    let head = "";
    let branch: string | null = null;

    for (const line of lines) {
      if (line.startsWith("worktree ")) {
        path = line.slice("worktree ".length);
      } else if (line.startsWith("HEAD ")) {
        head = line.slice("HEAD ".length);
      } else if (line.startsWith("branch ")) {
        const ref = line.slice("branch ".length);
        branch = ref.replace("refs/heads/", "");
      }
    }

    if (path && head) {
      worktrees.push({ path, head, branch });
    }
  }

  return worktrees;
}
