import { execFile } from "node:child_process";

import { MacminiCommandError } from "./types.js";

export interface ExecResult {
  stdout: string;
  stderr: string;
}

export function execFileAsync(command: string, args: string[], timeoutMs: number): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        reject(new MacminiCommandError(err.message, stderr));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

export function commandOutput(error: unknown): string {
  if (error instanceof MacminiCommandError) {
    return `${error.message}\n${error.stderr}`.trim();
  }
  return error instanceof Error ? error.message : String(error);
}

export function detectPermissionIssue(output: string): boolean {
  const lower = output.toLowerCase();
  return ["not authorized", "not authorised", "permission", "denied", "privacy", "tcc", "input/output error"].some(
    (hint) => lower.includes(hint),
  );
}
