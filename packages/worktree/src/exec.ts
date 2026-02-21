import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ExecOptions, ExecResult } from "./types.js";

const execFileAsync = promisify(execFile);

const DEFAULT_TIMEOUT = 60_000;
const MAX_BUFFER = 10 * 1024 * 1024; // 10 MB

interface ExecFileError {
  code: number | null;
  stdout: string;
  stderr: string;
}

function isExecError(err: unknown): err is ExecFileError {
  return err instanceof Error && "stdout" in err && "stderr" in err;
}

/**
 * Run `git` with the given arguments.
 * Uses execFile (not shell exec) to avoid injection.
 * Returns ExecResult — does NOT throw on non-zero exit codes.
 */
export async function git(
  args: string[],
  options: ExecOptions,
): Promise<ExecResult> {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd: options.cwd,
      timeout: options.timeout ?? DEFAULT_TIMEOUT,
      env: options.env ? { ...process.env, ...options.env } : undefined,
      signal: options.signal,
      maxBuffer: MAX_BUFFER,
    });
    return { exitCode: 0, stdout, stderr };
  } catch (err: unknown) {
    if (isExecError(err)) {
      return {
        exitCode: err.code ?? 1,
        stdout: err.stdout ?? "",
        stderr: err.stderr ?? "",
      };
    }
    throw err;
  }
}

/**
 * Run an arbitrary command inside a directory.
 * Uses execFile (not shell exec) to avoid injection.
 * Returns ExecResult — does NOT throw on non-zero exit codes.
 */
export async function exec(
  command: string,
  args: string[],
  options: ExecOptions,
): Promise<ExecResult> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: options.cwd,
      timeout: options.timeout ?? DEFAULT_TIMEOUT,
      env: options.env ? { ...process.env, ...options.env } : undefined,
      signal: options.signal,
      maxBuffer: MAX_BUFFER,
    });
    return { exitCode: 0, stdout, stderr };
  } catch (err: unknown) {
    if (isExecError(err)) {
      return {
        exitCode: err.code ?? 1,
        stdout: err.stdout ?? "",
        stderr: err.stderr ?? "",
      };
    }
    throw err;
  }
}
