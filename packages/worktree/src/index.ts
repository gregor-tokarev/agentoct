export type {
  CloneOptions,
  CloneResult,
  CreateWorktreeOptions,
  WorktreeInfo,
  ExecOptions,
  ExecResult,
} from "./types.js";

export { WorktreeError, type WorktreeErrorCode } from "./errors.js";

export { cloneRepo, verifyRepo } from "./repo.js";

export {
  createWorktree,
  listWorktrees,
  removeWorktree,
  pruneWorktrees,
} from "./worktree.js";

export { exec, git } from "./exec.js";
