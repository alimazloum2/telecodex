import type { Context, InputFile } from "grammy";

export type TelegramChatId = number | string;

export interface MacminiActionContext {
  api: Context["api"];
  chatId: TelegramChatId;
  messageThreadId?: number;
  env: NodeJS.ProcessEnv;
  editStatus(text: string): Promise<void>;
  replyText(text: string): Promise<void>;
  sendVideo(file: InputFile, caption: string): Promise<void>;
  sendVoice(file: InputFile, caption: string): Promise<void>;
}

export interface MacminiAction {
  id: string;
  label: string;
  emoji: string;
  runningText: string;
  doneText: string;
  handler(ctx: MacminiActionContext): Promise<void>;
}

export class MacminiCommandError extends Error {
  constructor(message: string, readonly stderr = "") {
    super(message);
    this.name = "MacminiCommandError";
  }
}
