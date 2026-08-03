import type { AppConfig } from "../../config/index.js";
import type { Notifier, NotificationEvent } from "./types.js";
import { DiscordNotifier } from "./discord.js";
import { GenericWebhookNotifier } from "./webhook.js";
import { getLogger } from "../../logging/logger.js";

const log = getLogger("notifications");

/** Fans out pipeline events to every configured notifier, isolating failures per-notifier. */
export class NotificationDispatcher {
  private readonly notifiers: Notifier[];

  constructor(config: AppConfig) {
    this.notifiers = [new DiscordNotifier(config.discord?.webhookUrl), new GenericWebhookNotifier(config.webhookUrls)];
  }

  async dispatch(event: Omit<NotificationEvent, "timestamp">): Promise<void> {
    const fullEvent: NotificationEvent = { ...event, timestamp: Date.now() };
    const configured = this.notifiers.filter((n) => n.isConfigured());

    await Promise.all(
      configured.map(async (notifier) => {
        try {
          await notifier.send(fullEvent);
        } catch (err) {
          log.warn(
            { notifier: notifier.id, err: err instanceof Error ? err.message : err },
            "notifier failed to send event",
          );
        }
      }),
    );
  }
}
