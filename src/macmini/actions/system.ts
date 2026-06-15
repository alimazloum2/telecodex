import os from "node:os";

import { execFileAsync } from "../exec.js";
import type { MacminiAction } from "../types.js";

export interface SystemSnapshot {
  hostname: string;
  uptime: string;
  cpuPercent: number;
  ramUsedGb: number;
  ramTotalGb: number;
  diskFree: string;
  diskMount: string;
}

export const systemAction: MacminiAction = {
  id: "system",
  emoji: "🖥",
  label: "System",
  runningText: "🖥 Checking Mac mini status…",
  doneText: "✅ System status sent.",
  async handler(ctx) {
    await ctx.replyText(buildSystemStatusText(await collectSystemSnapshot()));
  },
};

export async function collectSystemSnapshot(): Promise<SystemSnapshot> {
  const [disk, uptimeText, cpuPercent] = await Promise.all([readDiskFree(), readUptime(), readCpuPercent()]);
  const total = os.totalmem();
  const free = os.freemem();
  return {
    hostname: os.hostname(),
    uptime: uptimeText,
    cpuPercent,
    ramUsedGb: bytesToGb(total - free),
    ramTotalGb: bytesToGb(total),
    diskFree: disk.free,
    diskMount: disk.mount,
  };
}

export function buildSystemStatusText(snapshot: SystemSnapshot): string {
  return [
    "🖥 Mac mini system",
    `Host: ${snapshot.hostname}`,
    `CPU: ${snapshot.cpuPercent.toFixed(1)}%`,
    `RAM: ${snapshot.ramUsedGb.toFixed(1)}/${snapshot.ramTotalGb.toFixed(1)} GB`,
    `Disk free (${snapshot.diskMount}): ${snapshot.diskFree}`,
    `Uptime: ${snapshot.uptime}`,
  ].join("\n");
}

async function readDiskFree(): Promise<{ free: string; mount: string }> {
  const { stdout } = await execFileAsync("df", ["-h", "/"], 5_000);
  const line = stdout.trim().split(/\r?\n/).at(-1) ?? "";
  const parts = line.trim().split(/\s+/);
  return { free: parts[3] ?? "unknown", mount: parts[8] ?? parts[5] ?? "/" };
}

async function readUptime(): Promise<string> {
  const { stdout } = await execFileAsync("uptime", [], 5_000);
  return stdout.trim().replace(/^.* up\s+/, "").replace(/,\s+\d+ users?.*$/, "").replace(/,\s+load averages?:.*$/, "");
}

async function readCpuPercent(): Promise<number> {
  try {
    const { stdout } = await execFileAsync("sh", ["-lc", "top -l 1 -n 0 | grep 'CPU usage'"], 8_000);
    const user = Number(stdout.match(/([0-9.]+)% user/)?.[1] ?? 0);
    const sys = Number(stdout.match(/([0-9.]+)% sys/)?.[1] ?? 0);
    return user + sys;
  } catch {
    const load = os.loadavg()[0] ?? 0;
    return Math.min(100, (load / os.cpus().length) * 100);
  }
}

function bytesToGb(bytes: number): number {
  return bytes / 1024 / 1024 / 1024;
}
