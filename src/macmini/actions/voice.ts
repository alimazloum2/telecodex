import { stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";

import { InputFile } from "grammy";

import { commandOutput, detectPermissionIssue, execFileAsync } from "../exec.js";
import type { MacminiAction } from "../types.js";

const VOICE_RECORDER_SCRIPT = "/Users/metigerinc/.hermes/scripts/record_environment_audio.sh";
const VOICE_SECONDS = 15;
const VOICE_TIMEOUT_MS = 55_000;

export const voiceAction: MacminiAction = {
  id: "voice",
  emoji: "🎙",
  label: "Voice",
  runningText: "🎙 Recording 15s voice note…",
  doneText: "✅ Voice note sent.",
  async handler(ctx) {
    let outputPath: string | undefined;
    try {
      const result = await execFileAsync(
        VOICE_RECORDER_SCRIPT,
        buildVoiceRecorderArgs(tmpdir(), VOICE_SECONDS),
        VOICE_TIMEOUT_MS,
      );
      outputPath = parseRecorderOutputPath(result.stdout);
      const size = (await stat(outputPath)).size;
      if (size <= 0) {
        throw new Error("Voice capture produced an empty file.");
      }
      await ctx.sendVoice(new InputFile(outputPath, "macmini_voice_15s.ogg"), "🎙 Mac mini voice — 15s");
    } catch (error) {
      await ctx.replyText(`❌ Voice failed: ${formatVoiceCaptureError(error)}`);
      throw error;
    } finally {
      if (outputPath) {
        await unlink(outputPath).catch(() => {});
      }
    }
  },
};

export function buildVoiceRecorderArgs(outdir: string, seconds: number): string[] {
  return [
    "--duration",
    String(seconds),
    "--basename",
    "macmini_voice",
    "--quality",
    "voice",
    "--format",
    "ogg",
    "--outdir",
    outdir,
    "--quiet",
  ];
}

export function parseRecorderOutputPath(stdout: string): string {
  const outputPath = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);
  if (!outputPath) {
    throw new Error("Voice recorder did not print an output path.");
  }
  return outputPath;
}

export function formatVoiceCaptureError(error: unknown): string {
  const output = commandOutput(error);
  const lower = output.toLowerCase();
  if (lower.includes("enoent")) {
    return "The Hermes recorder script is missing or ffmpeg/sox is not available in PATH.";
  }
  if (detectPermissionIssue(output)) {
    return "Microphone permission is required. Grant it in System Settings > Privacy & Security > Microphone, then restart the bot/service.";
  }
  if (lower.includes("sox is required") || lower.includes("ffmpeg is required")) {
    return output;
  }
  if (lower.includes("device not found") || lower.includes("invalid device") || lower.includes("no such device")) {
    return 'Razer Seiren Mini was not found through CoreAudio. List devices with: /Users/metigerinc/.hermes/scripts/record_environment_audio.sh --list-devices';
  }
  return output || "Voice capture failed. Run: /Users/metigerinc/.hermes/scripts/record_environment_audio.sh --duration 3 --format ogg --quality voice";
}
