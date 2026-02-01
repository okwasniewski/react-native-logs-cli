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
  regex?: RegExp;
  max?: number;
  timeoutMs?: number;
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
export function formatConsoleArgument(arg: RemoteObject): string {
  if (arg.type === "undefined") {
    return "undefined";
  }
  if (arg.subtype === "null") {
    return "null";
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
    const text = args.map(formatConsoleArgument).join(" ");
    if (!text || text.includes(UNSUPPORTED_CLIENT_MESSAGE)) {
      return;
    }

    if (options.regex && !matchesRegex(options.regex, text)) {
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

/**
 * Test regex safely, including global/sticky cases.
 */
function matchesRegex(regex: RegExp, text: string): boolean {
  if (regex.global || regex.sticky) {
    regex.lastIndex = 0;
  }
  return regex.test(text);
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
