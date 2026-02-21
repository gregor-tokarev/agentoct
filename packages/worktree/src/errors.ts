export type WorktreeErrorCode =
  | "CLONE_FAILED"
  | "WORKTREE_CREATE_FAILED"
  | "WORKTREE_REMOVE_FAILED"
  | "WORKTREE_PRUNE_FAILED"
  | "EXEC_FAILED"
  | "REPO_NOT_FOUND"
  | "WORKTREE_NOT_FOUND";

export class WorktreeError extends Error {
  override readonly name = "WorktreeError";
  readonly code: WorktreeErrorCode;
  override readonly cause?: string;

  constructor(code: WorktreeErrorCode, message: string, cause?: string) {
    super(message);
    this.code = code;
    this.cause = cause;
  }
}
