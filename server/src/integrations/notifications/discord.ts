import type { Notifier, NotificationEvent } from "./types.js";

const COLOR_BY_TYPE: Record<NotificationEvent["type"], number> = {
  "download.started": 0x3498db,
  "download.completed": 0x2ecc71,
  "processing.failed": 0xe74c3c,
  "library.updated": 0x9b59b6,
  "queue.finished": 0x95a5a6,
};

export class DiscordNotifier implements Notifier {
  readonly id = "discord";

  constructor(private readonly webhookUrl: string | undefined) {}

  isConfigured(): boolean {
    return this.webhookUrl !== undefined;
  }

  async send(event: NotificationEvent): Promise<void> {
    if (!this.webhookUrl) {
      throw new Error("Discord notifier is not configured (missing DISCORD_WEBHOOK_URL)");
    }
    const res = await fetch(this.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: event.title,
            description: event.message,
            color: COLOR_BY_TYPE[event.type],
            timestamp: new Date(event.timestamp).toISOString(),
            footer: { text: event.type },
          },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`Discord webhook failed: ${res.status}`);
    }
  }
}
