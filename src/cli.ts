#!/usr/bin/env node
import { cancel, isCancel, log, select } from "@clack/prompts";
import { Command } from "commander";
import {
  fetchInspectorAppsAsync,
  getMetroServerOrigin,
  selectInspectorApp,
  type InspectorApp
} from "./inspector.js";
import { formatMetroConnectionError, isMetroConnectionError } from "./errors.js";
import { connectCdpAsync } from "./cdp.js";
import { attachConsoleListener, enableRuntime } from "./logs.js";
import { createTailBuffer } from "./buffer.js";

const DEFAULT_HOST = "localhost";
const DEFAULT_PORT = 8081;

type GlobalOptions = {
  host: string;
  port: number;
};

type LogsOptions = GlobalOptions & {
  app?: string;
  regex?: string;
  limit?: number;
  follow?: boolean;
  verbose?: boolean;
};

type BufferedLogEntry = {
  level: string;
  formatted: string;
};

/**
 * Validate and normalize Metro host/port.
 */
function normalizeGlobalOptions(options: GlobalOptions): GlobalOptions {
  const port = Number(options.port);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("Invalid --port value");
  }

  if (!options.host?.trim()) {
    throw new Error("Invalid --host value");
  }

  return {
    host: options.host.trim(),
    port
  };
}

/**
 * CLI entrypoint.
 */
function run(): void {
  const program = new Command();

  program
    .name("rn-logs")
    .description("React Native Metro logs CLI")
    .version("0.0.1")
    .addHelpText(
      "after",
      "\nExamples:\n  rn-logs apps\n  rn-logs logs --app \"MyApp\" --regex \"error|warn\"\n"
    );

  program
    .command("apps")
    .description("list apps connected to Metro")
    .option("--host <host>", "Metro host", DEFAULT_HOST)
    .option("--port <port>", "Metro port", `${DEFAULT_PORT}`)
    .addHelpText("after", "\nExample:\n  rn-logs apps --port 8081\n")
    .action(async (options: GlobalOptions) => {
      let metroServerOrigin = "";
      try {
        const { host, port } = normalizeGlobalOptions(options);
        metroServerOrigin = getMetroServerOrigin(host, port);
        const apps = await fetchInspectorAppsAsync(metroServerOrigin);
        printInspectorApps(apps);
      } catch (error) {
        handleActionError(error, metroServerOrigin);
      }
    });

  program
    .command("logs")
    .description("stream or snapshot logs from an app")
    .option("--app <id|name>", "target app id or name")
    .option("--host <host>", "Metro host", DEFAULT_HOST)
    .option("--port <port>", "Metro port", `${DEFAULT_PORT}`)
    .option("--regex <expr>", "filter logs by regex")
    .option("--limit <n>", "capture last n logs then exit", (value) => Number(value))
    .option("--verbose", "include full stack traces")
    .option("--follow", "stream logs")
    .addHelpText(
      "after",
      "\nExamples:\n  rn-logs logs --app \"MyApp\" --follow\n  rn-logs logs --app \"MyApp\" --limit 50\n  rn-logs logs --app \"MyApp\" --regex \"error|warn\"\n"
    )
    .action(async (options: LogsOptions) => {
      let metroServerOrigin = "";
      try {
        const { host, port } = normalizeGlobalOptions(options);
        if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit <= 0)) {
          throw new Error("Invalid --limit value");
        }
        metroServerOrigin = getMetroServerOrigin(host, port);
        const apps = await fetchInspectorAppsAsync(metroServerOrigin);
        const target = await resolveTargetApp(apps, options.app);
        const connection = await connectCdpAsync(target.webSocketDebuggerUrl);
        enableRuntime(connection);

        let regex: RegExp | undefined;
        if (options.regex) {
          try {
            regex = new RegExp(options.regex);
          } catch (error) {
            throw new Error(`Invalid --regex: ${(error as Error).message}`);
          }
        }
        const limit = options.limit ?? 0;
        const follow =
          limit > 0
            ? false
            : options.follow !== undefined
              ? options.follow
              : !options.regex;
        const shouldBuffer = limit > 0 && !follow;
        const tailBuffer = shouldBuffer ? createTailBuffer<BufferedLogEntry>(limit) : null;

        const listener = attachConsoleListener(connection, {
          regex,
          verbose: options.verbose,
          max: shouldBuffer ? undefined : limit > 0 ? limit : undefined,
          timeoutMs: follow ? undefined : shouldBuffer ? 500 : 5000,
          onLog: (message, formatted) => {
            if (!shouldBuffer) {
              printLog(message.level, formatted);
              return;
            }
            tailBuffer?.push({ level: message.level, formatted });
          }
        });

        await listener.done;
        const bufferedLogs = tailBuffer?.values() ?? [];
        if (shouldBuffer && bufferedLogs.length > 0) {
          for (const entry of bufferedLogs) {
            printLog(entry.level, entry.formatted);
          }
        }
      } catch (error) {
        handleActionError(error, metroServerOrigin);
      }
    });

  program.parse(process.argv);
}

/**
 * Print inspector apps in a compact list.
 */
function printInspectorApps(apps: InspectorApp[]): void {
  if (apps.length === 0) {
    printWarn("No apps connected to Metro. Run your app on a simulator or device.");
    return;
  }

  for (const app of apps) {
    const deviceName = app.deviceName ?? "Unknown device";
    printLine(`${app.id}\t${deviceName}\t${app.appId}`);
  }
}

/**
 * Resolve target app by selector or interactive prompt.
 */
async function resolveTargetApp(
  apps: InspectorApp[],
  selector?: string
): Promise<InspectorApp> {
  if (apps.length === 0) {
    throw new Error("No apps connected to Metro. Run your app on a simulator or device.");
  }

  if (selector) {
    const selected = selectInspectorApp(apps, selector);
    if (!selected) {
      throw new Error(`app not found: ${selector}`);
    }
    return selected;
  }

  if (apps.length === 1) {
    return apps[0];
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Multiple apps connected. Use --app to select one");
  }

  const selection = await select({
    message: "Select app",
    options: apps.map((app) => ({
      value: app.id,
      label: app.appId,
      hint: app.deviceName ?? "Unknown device"
    }))
  });

  if (isCancel(selection)) {
    cancel("cancelled");
    process.exit(1);
  }

  const selected = selectInspectorApp(apps, selection as string);
  if (!selected) {
    throw new Error("App selection failed");
  }
  return selected;
}

/**
 * Print a line with non-interactive fallback.
 */
function printLine(message: string): void {
  if (!isInteractive()) {
    console.log(message);
    return;
  }
  log.info(message);
}

/**
 * Print log with level-aware styling.
 */
function printLog(level: string, message: string): void {
  if (!isInteractive()) {
    console.log(message);
    return;
  }
  if (level === "error") {
    log.error(message);
    return;
  }
  if (level === "warning") {
    log.warn(message);
    return;
  }
  log.info(message);
}

/**
 * Print a warning with non-interactive fallback.
 */
function printWarn(message: string): void {
  if (!isInteractive()) {
    console.log(message);
    return;
  }
  log.warn(message);
}

/**
 * Check if interactive TTY mode is available.
 */
function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/**
 * Print action errors and exit with code 1.
 */
function handleActionError(error: unknown, metroServerOrigin: string): never {
  const message = buildErrorMessage(error, metroServerOrigin);
  printError(message);
  process.exit(1);
}

/**
 * Build a user-friendly error message.
 */
function buildErrorMessage(error: unknown, metroServerOrigin: string): string {
  if (metroServerOrigin && isMetroConnectionError(error)) {
    return formatMetroConnectionError(error, metroServerOrigin);
  }

  if (error instanceof Error) {
    return error.message;
  }

  return `Unexpected error: ${String(error)}`;
}

/**
 * Print an error with non-interactive fallback.
 */
function printError(message: string): void {
  if (!isInteractive()) {
    console.error(message);
    return;
  }
  log.error(message);
}

run();
