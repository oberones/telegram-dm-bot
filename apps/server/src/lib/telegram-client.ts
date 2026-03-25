import type { OutboundMessage } from "@dm-bot/domain";

import type { AppConfig } from "@dm-bot/shared";

import type { TelegramUpdate } from "./telegram-types.js";

export class TelegramClient {
  constructor(private readonly config: AppConfig) {}

  async sendMessage(chatId: string | number, message: OutboundMessage) {
    return this.call("sendMessage", {
      chat_id: chatId,
      text: message.text,
      reply_markup: message.replyMarkup,
    });
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string) {
    return this.call("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text,
    });
  }

  async getUpdates(offset?: number) {
    return this.call("getUpdates", {
      offset,
      timeout: this.config.telegramPollingTimeoutSeconds,
      allowed_updates: ["message", "callback_query"],
    }) as Promise<{ ok: true; result: TelegramUpdate[] }>;
  }

  async deleteWebhook(dropPendingUpdates = false) {
    return this.call("deleteWebhook", {
      drop_pending_updates: dropPendingUpdates,
    });
  }

  private async call(method: string, payload: Record<string, unknown>) {
    const response = await fetch(
      `https://api.telegram.org/bot${this.config.telegramBotToken}/${method}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telegram API ${method} failed: ${response.status} ${body}`);
    }

    return response.json();
  }
}
