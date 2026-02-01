import type { CdpConnection } from "./cdp.js";

type CallFrame = {
  functionName: string;
  scriptId: string;
  url: string;
  lineNumber: number;
  columnNumber: number;
};

type StackTrace = {
  description?: string;
  callFrames: CallFrame[];
  parent?: StackTrace;
};

type RemoteObject = {
  type:
    | "object"
    | "function"
    | "undefined"
    | "string"
    | "number"
    | "boolean"
    | "symbol"
    | "bigint";
  subtype?:
    | "array"
    | "null"
    | "node"
    | "regexp"
    | "date"
    | "map"
    | "set"
    | "weakmap"
    | "weakset"
    | "iterator"
    | "generator"
    | "error"
    | "proxy"
    | "promise"
    | "typedarray"
    | "arraybuffer"
    | "dataview";
  className?: string;
  value?: unknown;
  unserializableValue?: string;
  description?: string;
  objectId?: string;
};

type ConsoleMessage = {
  level: string;
  text: string;
  timestamp: number;
  args?: RemoteObject[];
  stackTrace?: StackTrace;
};

type ConsoleListenerOptions = {
  max?: number;
  timeoutMs?: number;
  verbose?: boolean;
  onLog: (message: ConsoleMessage, formatted: string) => void;
};

type ConsoleListenerHandle = {
  close: () => void;
  done: Promise<void>;
};

const UNSUPPORTED_CLIENT_MESSAGE =
  "You are using an unsupported debugging client. Use the Dev Menu in your app (or type `j` in the Metro terminal) to open React Native DevTools.";

/**
 * Formats a Chrome DevTools Protocol RemoteObject into a readable string.
 */
type FormatOptions = {
  verbose?: boolean;
};

/**
 * Format console arguments into a single line.
 */
export function formatConsoleArguments(
  args: RemoteObject[],
  options: FormatOptions = {}
): string {
  const formatted = args.map((arg) => formatConsoleArgument(arg, options));
  if (options.verbose) {
    return formatted.join(" ");
  }

  const locations = findBestLocations(args);
  const filtered = formatted.filter((value) =>
    value && value !== "Error Stack:" && !isCodeFrame(value) && !isStackFrameValue(value)
  );
  const base = filtered.join(" ").trim();
  if (locations.length === 0) {
    return base;
  }
  const stack = locations.map((location) => `  at ${location}`).join("\n");
  if (!base) {
    return `Stack Trace:\n${stack}`;
  }
  return `${base}\nStack Trace:\n${stack}`;
}

/**
 * Format a console argument into a readable string.
 */
export function formatConsoleArgument(arg: RemoteObject, options: FormatOptions = {}): string {
  if (arg.type === "undefined") {
    return "undefined";
  }
  if (arg.subtype === "null") {
    return "null";
  }

  if (arg.subtype === "error" && arg.description !== undefined) {
    return options.verbose ? arg.description : stripStackTrace(arg.description);
  }

  if (arg.description !== undefined) {
    return arg.description;
  }

  if (arg.value !== undefined) {
    return String(arg.value);
  }

  if (arg.unserializableValue !== undefined) {
    return arg.unserializableValue;
  }

  return `[${arg.type}${arg.subtype ? ` ${arg.subtype}` : ""}]`;
}

/**
 * Strip stack traces while keeping the best frame.
 */
function stripStackTrace(description: string): string {
  const lines = description.split("\n");
  const firstLine = lines[0] ?? description;
  const frame = pickRelevantFrame(lines.slice(1));
  if (!frame) {
    return firstLine;
  }
  return `${firstLine} (${frame})`;
}

/**
 * Pick the most relevant stack frame.
 */
function pickRelevantFrame(lines: string[]): string | null {
  for (const line of lines) {
    const cleaned = line.trim();
    if (!cleaned) {
      continue;
    }
    const match = cleaned.match(/\bat\s+(?:.+?\s+\()?([^\s)]+:\d+:\d+)\)?$/);
    if (!match) {
      continue;
    }
    const location = match[1];
    if (
      location.startsWith("http://") ||
      location.startsWith("https://") ||
      location.includes("node_modules/") ||
      location.includes("internal/") ||
      location.includes("[native code]")
    ) {
      continue;
    }
    return location;
  }
  return null;
}

/**
 * Pick a location from stack frame lines.
 */
function collectStackLocations(lines: string[], limit: number): string[] {
  const locations: string[] = [];
  for (const line of lines) {
    if (locations.length >= limit) {
      break;
    }
    const cleaned = line.trim();
    if (!cleaned) {
      continue;
    }
    const inlineSource = extractInlineSource(cleaned);
    if (inlineSource && !inlineSource.includes("node_modules/")) {
      locations.push(inlineSource);
      continue;
    }
    const frame = pickRelevantFrame([cleaned]);
    if (frame && !locations.includes(frame) && !locations.includes(`./${frame}`)) {
      locations.push(frame);
    }
  }

  return locations;
}

/**
 * Extract inline source path from stack frame.
 */
function extractInlineSource(line: string): string | null {
  const start = line.indexOf("(./");
  if (start === -1) {
    return null;
  }
  const end = line.lastIndexOf(") (");
  if (end > start) {
    return line.slice(start + 1, end);
  }
  const fallbackEnd = line.indexOf(")", start);
  if (fallbackEnd > start) {
    return line.slice(start + 1, fallbackEnd);
  }
  return null;
}

/**
 * Find a code frame location from Metro errors.
 */
function findBestLocations(args: RemoteObject[]): string[] {
  let file: string | null = null;
  let line: string | null = null;
  const stackLines: string[] = [];

  for (const arg of args) {
    const text = getArgText(arg);
    if (!text) {
      continue;
    }
    stackLines.push(...text.split("\n"));
    if (!file) {
      const match = text.match(/Code:\s*([^\n]+)/);
      if (match) {
        file = match[1].trim();
      }
    }
    if (!line) {
      const match = text.match(/^>\s*(\d+)\s*\|/m);
      if (match) {
        line = match[1];
      }
    }
    if (file && line) {
      return [`${file}:${line}`, ...collectStackLocations(stackLines, 3)];
    }
  }

  return collectStackLocations(stackLines, 3);
}

/**
 * Get a readable string from a console argument.
 */
function getArgText(arg: RemoteObject): string | null {
  if (arg.description !== undefined) {
    return arg.description;
  }
  if (arg.value !== undefined) {
    return String(arg.value);
  }
  if (arg.unserializableValue !== undefined) {
    return arg.unserializableValue;
  }
  return null;
}

/**
 * Detect Metro code frame blocks.
 */
function isCodeFrame(value: string): boolean {
  return /\bCode:\s*[^\n]+/.test(value) && /^>\s*\d+\s*\|/m.test(value);
}

/**
 * Detect stack frame lines.
 */
function isStackFrameValue(value: string): boolean {
  return value.startsWith("Error Stack:") || /^\s*at\s+/.test(value);
}

/**
 * Format a console message into a single line.
 */
export function formatConsoleMessage(message: ConsoleMessage): string {
  const prefix =
    message.level === "error"
      ? "error: "
      : message.level === "warning"
        ? "warn: "
        : "";
  return `${prefix}${message.text}`;
}

/**
 * Attach console listener to an active CDP connection.
 */
export function attachConsoleListener(
  connection: CdpConnection,
  options: ConsoleListenerOptions
): ConsoleListenerHandle {
  let count = 0;
  let closed = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let resolveDone: () => void;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const close = (): void => {
    if (closed) {
      return;
    }
    closed = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    connection.close();
    resolveDone();
  };

  connection.onMessage((data) => {
    if (closed) {
      return;
    }
    if (!isConsoleApiCalled(data)) {
      return;
    }

    const args = data.params.args || [];
    const text = formatConsoleArguments(args, { verbose: options.verbose });
    if (!text || text.includes(UNSUPPORTED_CLIENT_MESSAGE)) {
      return;
    }

    const level = data.params.type || "log";
    const message: ConsoleMessage = {
      level,
      text,
      timestamp: Date.now(),
      ...(level === "error" || level === "warning"
        ? { args, stackTrace: data.params.stackTrace }
        : {})
    };

    options.onLog(message, formatConsoleMessage(message));
    count += 1;

    if (options.max && count >= options.max) {
      close();
    }
  });

  connection.onClose(() => {
    close();
  });

  connection.onError(() => {
    close();
  });

  if (options.timeoutMs) {
    timeoutId = setTimeout(() => {
      close();
    }, options.timeoutMs);
  }

  return { close, done };
}

/**
 * Send Runtime.enable to start console events.
 */
export function enableRuntime(connection: CdpConnection): void {
  connection.send({ id: 1, method: "Runtime.enable" });
}

function isConsoleApiCalled(
  data: unknown
): data is { method: "Runtime.consoleAPICalled"; params: any } {
  if (!data || typeof data !== "object") {
    return false;
  }
  const candidate = data as { method?: string };
  return candidate.method === "Runtime.consoleAPICalled";
}
