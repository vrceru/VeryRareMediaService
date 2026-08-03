export type NotificationEventType =
  | "download.started"
  | "download.completed"
  | "processing.failed"
  | "library.updated"
  | "queue.finished";

export interface NotificationEvent {
  type: NotificationEventType;
  title: string;
  message: string;
  jobId?: string;
  timestamp: number;
}

export interface Notifier {
  readonly id: string;
  isConfigured(): boolean;
  send(event: NotificationEvent): Promise<void>;
}
