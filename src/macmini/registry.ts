import { InlineKeyboard } from "grammy";

import { alexaAction } from "./actions/alexa.js";
import { cameraAction } from "./actions/camera.js";
import { linearAction } from "./actions/linear.js";
import { speedAction } from "./actions/speed.js";
import { systemAction } from "./actions/system.js";
import { tigercoinAction } from "./actions/tigercoin.js";
import { voiceAction } from "./actions/voice.js";
import type { MacminiAction } from "./types.js";

export const MACMINI_CALLBACK_PREFIX = "macmini:";

export const MACMINI_ACTIONS: MacminiAction[] = [
  cameraAction,
  voiceAction,
  alexaAction,
  speedAction,
  linearAction,
  systemAction,
  tigercoinAction,
];

// Example future button:
// export const nexcoreAction: MacminiAction = { id: "nexcore", emoji: "🏗️", label: "NexCore", async handler(ctx) { ... } };
// Then append it to MACMINI_ACTIONS above.

export function macminiCallbackData(actionId: string): string {
  return `${MACMINI_CALLBACK_PREFIX}${actionId}`;
}

export function getMacminiAction(actionId: string): MacminiAction | undefined {
  return MACMINI_ACTIONS.find((action) => action.id === actionId);
}

export function buildMacminiKeyboard(actions: MacminiAction[] = MACMINI_ACTIONS): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  actions.forEach((action, index) => {
    keyboard.text(`${action.emoji} ${action.label}`, macminiCallbackData(action.id));
    if (index % 2 === 1 && index < actions.length - 1) {
      keyboard.row();
    }
  });
  return keyboard;
}
