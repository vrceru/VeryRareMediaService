import pino from "pino";

export type Logger = pino.Logger;

let rootLogger: Logger | undefined;

export function initLogger(level: string, pretty: boolean): Logger {
  rootLogger = pino({
    level,
    transport: pretty
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
      : undefined,
  });
  return rootLogger;
}

export function getLogger(scope?: string): Logger {
  if (!rootLogger) {
    rootLogger = pino({ level: "info" });
  }
  return scope ? rootLogger.child({ scope }) : rootLogger;
}
