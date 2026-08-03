import { connect } from "node:net";
import { createReadStream } from "node:fs";
import type { ScanResult, VirusScanner } from "./types.js";

const CHUNK_SIZE = 64 * 1024;

export interface ClamavConfig {
  enabled: boolean;
  host: string;
  port: number;
}

/**
 * Talks directly to clamd's INSTREAM protocol over TCP (no external client library needed).
 * See https://docs.clamav.net/manual/Usage/Scanning.html#stream-scanning.
 */
export class ClamavScanner implements VirusScanner {
  constructor(private readonly config: ClamavConfig) {}

  isEnabled(): boolean {
    return this.config.enabled;
  }

  async scanFile(filePath: string): Promise<ScanResult> {
    if (!this.config.enabled) {
      throw new Error("Virus scanning is disabled (set VIRUS_SCAN_ENABLED=true to enable)");
    }

    return new Promise<ScanResult>((resolve, reject) => {
      const socket = connect(this.config.port, this.config.host);
      let response = "";

      socket.on("connect", () => {
        socket.write("zINSTREAM\0");
        const fileStream = createReadStream(filePath, { highWaterMark: CHUNK_SIZE });

        fileStream.on("data", (chunk) => {
          const lenBuf = Buffer.alloc(4);
          lenBuf.writeUInt32BE((chunk as Buffer).length, 0);
          socket.write(lenBuf);
          socket.write(chunk);
        });
        fileStream.on("end", () => {
          const zeroLen = Buffer.alloc(4);
          socket.write(zeroLen);
        });
        fileStream.on("error", (err) => {
          socket.destroy();
          reject(err);
        });
      });

      socket.on("data", (data) => {
        response += data.toString("utf8");
      });

      socket.on("error", reject);

      socket.on("close", () => {
        // Response looks like: "stream: OK\0" or "stream: Eicar-Test-Signature FOUND\0"
        const clean = /:\s*OK/.test(response);
        const match = /:\s*(.+?)\s*FOUND/.exec(response);
        resolve({ clean, ...(match?.[1] ? { signature: match[1] } : {}) });
      });
    });
  }
}
