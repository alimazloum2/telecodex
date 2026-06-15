import { commandOutput, execFileAsync } from "../exec.js";
import type { MacminiAction } from "../types.js";

const ALEXA_PHRASE = "Alexa";
const ALEXA_TIMEOUT_MS = 8_000;

export const alexaAction: MacminiAction = {
  id: "alexa",
  emoji: "🔊",
  label: "Alexa",
  runningText: "🔊 Saying Alexa from the Mac mini speaker…",
  doneText: "✅ Alexa wake word spoken.",
  async handler(ctx) {
    try {
      await execFileAsync("say", buildAlexaSayArgs(ALEXA_PHRASE), ALEXA_TIMEOUT_MS);
      await ctx.replyText("🔊 Mac mini speaker said: Alexa");
    } catch (error) {
      await ctx.replyText(`❌ Alexa speaker failed: ${formatAlexaSayError(error)}`);
      throw error;
    }
  },
};

export function buildAlexaSayArgs(phrase = ALEXA_PHRASE): string[] {
  return ["-r", "165", phrase];
}

export function formatAlexaSayError(error: unknown): string {
  const output = commandOutput(error);
  const lower = output.toLowerCase();
  if (lower.includes("enoent")) {
    return "macOS say command was not found.";
  }
  if (lower.includes("audio") || lower.includes("output") || lower.includes("device")) {
    return "macOS audio output failed. Check the selected speaker/output device on the Mac mini.";
  }
  return output || "Unable to speak through the Mac mini speaker.";
}
