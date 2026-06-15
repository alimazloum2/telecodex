import { commandOutput, execFileAsync } from "../exec.js";
import type { MacminiAction } from "../types.js";

const NETWORK_QUALITY_TIMEOUT_MS = 45_000;

export interface NetworkSpeedSnapshot {
  downloadCapacity: string;
  uploadCapacity: string;
  responsiveness: string;
  idleLatency: string;
}

export const speedAction: MacminiAction = {
  id: "speed",
  emoji: "🌐",
  label: "Speed",
  runningText: "🌐 Testing internet speed…",
  doneText: "✅ Internet speed sent.",
  async handler(ctx) {
    try {
      await ctx.replyText(buildNetworkSpeedText(await collectNetworkSpeedSnapshot()));
    } catch (error) {
      await ctx.replyText(`❌ Speed test failed: ${formatNetworkSpeedError(error)}`);
      throw error;
    }
  },
};

export async function collectNetworkSpeedSnapshot(): Promise<NetworkSpeedSnapshot> {
  const { stdout } = await execFileAsync("networkQuality", [], NETWORK_QUALITY_TIMEOUT_MS);
  return parseNetworkSpeedOutput(stdout);
}

export function parseNetworkSpeedOutput(output: string): NetworkSpeedSnapshot {
  return {
    downloadCapacity: extractFirstNetworkQualityField(output, ["Download capacity", "Downlink capacity"]),
    uploadCapacity: extractFirstNetworkQualityField(output, ["Upload capacity", "Uplink capacity"]),
    responsiveness: extractNetworkQualityField(output, "Responsiveness"),
    idleLatency: extractNetworkQualityField(output, "Idle Latency"),
  };
}

export function buildNetworkSpeedText(snapshot: NetworkSpeedSnapshot): string {
  return [
    "🌐 Mac mini internet speed",
    `Download: ${snapshot.downloadCapacity}`,
    `Upload: ${snapshot.uploadCapacity}`,
    `Responsiveness: ${snapshot.responsiveness}`,
    `Idle latency: ${snapshot.idleLatency}`,
  ].join("\n");
}

export function formatNetworkSpeedError(error: unknown): string {
  const output = commandOutput(error);
  const lower = output.toLowerCase();
  if (lower.includes("enoent")) {
    return "`networkQuality` is not available on this Mac.";
  }
  if (lower.includes("timed out")) {
    return "The speed test timed out. Try again when the network is stable.";
  }
  if (
    lower.includes("server with the specified hostname could not be found") ||
    lower.includes("nsurlerrordomain code=-1003") ||
    lower.includes("resolved 0 endpoints")
  ) {
    return "DNS resolution failed while reaching Apple's networkQuality endpoint. Check internet and DNS on the Mac mini.";
  }
  return output || "The speed test failed for an unknown reason.";
}

function extractNetworkQualityField(output: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = output.match(new RegExp(`^${escaped}:\\s*(.+)$`, "m"));
  const value = match?.[1]?.trim();
  if (!value) {
    throw new Error(`Missing ${label.toLowerCase()} in networkQuality output.`);
  }
  return value;
}

function extractFirstNetworkQualityField(output: string, labels: string[]): string {
  for (const label of labels) {
    try {
      return extractNetworkQualityField(output, label);
    } catch {
      // Try the next label. macOS networkQuality has used both Download/Upload and Downlink/Uplink wording.
    }
  }
  throw new Error(`Missing ${labels[0].toLowerCase()} in networkQuality output.`);
}
