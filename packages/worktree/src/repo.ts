import { resolve } from "node:path";
import { git } from "./exec.js";
import { WorktreeError } from "./errors.js";
import type { CloneOptions, CloneResult } from "./types.js";

/**
 * Clone a repository. By default creates a bare clone suitable for worktrees.
 */
export async function cloneRepo(options: CloneOptions): Promise<CloneResult> {
  const dest = resolve(options.dest);
  const args = ["clone"];

  if (options.bare !== false) {
    args.push("--bare");
  }

  if (options.branch) {
    args.push("--branch", options.branch);
  }

  args.push(options.url, dest);

  const result = await git(args, { cwd: process.cwd() });

  if (result.exitCode !== 0) {
    throw new WorktreeError(
      "CLONE_FAILED",
      `Failed to clone ${options.url}`,
      result.stderr,
    );
  }

  return { path: dest };
}

/**
 * Verify that a path is a git repository (bare or normal).
 */
export async function verifyRepo(repoPath: string): Promise<void> {
  const result = await git(["rev-parse", "--git-dir"], { cwd: repoPath });

  if (result.exitCode !== 0) {
    throw new WorktreeError(
      "REPO_NOT_FOUND",
      `Not a git repository: ${repoPath}`,
      result.stderr,
    );
  }
}
