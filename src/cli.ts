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

const DEFAULT_HOST = "localhost";
const DEFAULT_PORT = 8081;

type GlobalOptions = {
  host: string;
  port: number;
};

type LogsOptions = GlobalOptions & {
  app?: string;
  regex?: string;
  max?: number;
  follow?: boolean;
};

/**
 * Validate and normalize Metro host/port.
 */
function normalizeGlobalOptions(options: GlobalOptions): GlobalOptions {
  const port = Number(options.port);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("invalid --port value");
  }

  if (!options.host?.trim()) {
    throw new Error("invalid --host value");
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
    .option("--max <n>", "max logs then exit", (value) => Number(value))
    .option("--follow", "stream logs", true)
    .addHelpText(
      "after",
      "\nExamples:\n  rn-logs logs --app \"MyApp\" --follow\n  rn-logs logs --app \"MyApp\" --max 50\n  rn-logs logs --app \"MyApp\" --regex \"error|warn\"\n"
    )
    .action(async (options: LogsOptions) => {
      let metroServerOrigin = "";
      try {
        const { host, port } = normalizeGlobalOptions(options);
        if (options.max !== undefined && (!Number.isInteger(options.max) || options.max <= 0)) {
          throw new Error("invalid --max value");
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
            throw new Error(`invalid --regex: ${(error as Error).message}`);
          }
        }
        const follow = options.follow !== false;
        const max = options.max ?? 0;

        const listener = attachConsoleListener(connection, {
          regex,
          max: max > 0 ? max : undefined,
          timeoutMs: follow || max ? undefined : 5000,
          onLog: (_, formatted) => printLine(formatted)
        });

        await listener.done;
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
    printWarn("no apps connected to Metro. Run your app on a simulator or device.");
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
    throw new Error("no apps connected to Metro. Run your app on a simulator or device.");
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
    throw new Error("multiple apps connected. use --app to select one");
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
    throw new Error("app selection failed");
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

  return `unexpected error: ${String(error)}`;
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
