import { stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { InputFile } from "grammy";

import { commandOutput, detectPermissionIssue, execFileAsync } from "../exec.js";
import type { MacminiAction } from "../types.js";

const CAMERA_DEVICE_INDEX = 0;
const CAMERA_SECONDS = 15;
const CAMERA_TIMEOUT_MS = 35_000;

export const cameraAction: MacminiAction = {
  id: "camera",
  emoji: "📸",
  label: "Camera",
  runningText: "📸 Capturing 15s clip…",
  doneText: "✅ Camera clip sent.",
  async handler(ctx) {
    const outputPath = path.join(tmpdir(), `macmini_camera_${Date.now()}.mp4`);
    try {
      await execFileAsync("ffmpeg", buildCameraFfmpegArgs(outputPath, CAMERA_DEVICE_INDEX, CAMERA_SECONDS), CAMERA_TIMEOUT_MS);
      const size = (await stat(outputPath)).size;
      if (size <= 0) {
        throw new Error("Camera capture produced an empty file.");
      }
      await ctx.sendVideo(new InputFile(outputPath, "macmini_camera_15s.mp4"), "📸 Mac mini camera — 15s");
    } catch (error) {
      await ctx.replyText(`❌ Camera failed: ${formatCameraCaptureError(error)}`);
      throw error;
    } finally {
      await unlink(outputPath).catch(() => {});
    }
  },
};

export function buildCameraFfmpegArgs(outputPath: string, deviceIndex: number, seconds: number): string[] {
  return [
    "-y",
    "-f",
    "avfoundation",
    "-framerate",
    "30",
    "-i",
    `${deviceIndex}:none`,
    "-t",
    String(seconds),
    "-pix_fmt",
    "yuv420p",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-movflags",
    "+faststart",
    outputPath,
  ];
}

export function formatCameraCaptureError(error: unknown): string {
  const output = commandOutput(error);
  const lower = output.toLowerCase();
  if (lower.includes("enoent")) {
    return "ffmpeg is not installed or not available in PATH.";
  }
  if (detectPermissionIssue(output)) {
    return "Camera permission is required. Grant it in System Settings > Privacy & Security > Camera, then restart the bot/service.";
  }
  if (
    lower.includes("device not found") ||
    lower.includes("invalid device") ||
    lower.includes("selected framerate") ||
    lower.includes("no such device")
  ) {
    return 'No camera device was found at AVFoundation index 0. List devices with: ffmpeg -f avfoundation -list_devices true -i ""';
  }
  return output || 'Camera capture failed. List devices with: ffmpeg -f avfoundation -list_devices true -i ""';
}
