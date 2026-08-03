import type { QueueService } from "./queueService.js";
import type { Job } from "./types.js";
import { getLogger } from "../logging/logger.js";

const log = getLogger("worker");

export interface WorkerOptions {
  concurrency: number;
  pollIntervalMs: number;
}

export type JobRunner = (job: Job) => Promise<void>;

/**
 * Polls the queue for claimable jobs and runs up to `concurrency` of them at once.
 * Each job's own success/failure handling (retry, terminal fail, complete) is the
 * responsibility of the pipeline runner passed in — this class only manages scheduling.
 */
export class JobWorker {
  private inFlight = 0;
  private timer: NodeJS.Timeout | undefined;
  private stopped = true;

  constructor(
    private readonly queue: QueueService,
    private readonly runJob: JobRunner,
    private readonly options: WorkerOptions,
  ) {}

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    log.info({ concurrency: this.options.concurrency }, "worker started");
    this.scheduleTick();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    log.info("worker stopped");
  }

  private scheduleTick(): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      this.tick().finally(() => this.scheduleTick());
    }, this.options.pollIntervalMs);
  }

  private async tick(): Promise<void> {
    while (this.inFlight < this.options.concurrency) {
      const job = this.queue.claimNext();
      if (!job) break;
      this.inFlight++;
      this.execute(job).finally(() => {
        this.inFlight--;
      });
    }
  }

  private async execute(job: Job): Promise<void> {
    try {
      await this.runJob(job);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ jobId: job.id, err: message }, "unhandled error running job");
      this.queue.failJob(job.id, message);
    }
  }
}
