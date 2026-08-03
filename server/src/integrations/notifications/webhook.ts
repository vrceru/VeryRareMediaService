import type { Notifier, NotificationEvent } from "./types.js";

/** Posts the raw event as JSON to every configured generic webhook URL. */
export class GenericWebhookNotifier implements Notifier {
  readonly id = "webhook";

  constructor(private readonly urls: string[]) {}

  isConfigured(): boolean {
    return this.urls.length > 0;
  }

  async send(event: NotificationEvent): Promise<void> {
    if (this.urls.length === 0) {
      throw new Error("Webhook notifier is not configured (no NOTIFICATION_WEBHOOK_URLS)");
    }
    const results = await Promise.allSettled(
      this.urls.map((url) =>
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event),
        }).then((res) => {
          if (!res.ok) throw new Error(`Webhook ${url} failed: ${res.status}`);
        }),
      ),
    );
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    if (failures.length > 0) {
      throw new Error(`${failures.length}/${this.urls.length} webhook(s) failed`);
    }
  }
}
