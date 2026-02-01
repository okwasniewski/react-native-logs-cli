import { describe, expect, it } from "bun:test";
import type { CdpConnection } from "../src/cdp.js";
import { attachConsoleListener, enableRuntime } from "../src/logs.js";

const makeConnection = () => {
  const messages: unknown[] = [];
  let closeHandler: (() => void) | undefined;
  let errorHandler: ((error: Error) => void) | undefined;
  let messageHandler: ((data: unknown) => void) | undefined;

  const connection: CdpConnection = {
    close: () => closeHandler?.(),
    send: (payload) => messages.push(payload),
    onMessage: (handler) => {
      messageHandler = handler;
    },
    onClose: (handler) => {
      closeHandler = handler;
    },
    onError: (handler) => {
      errorHandler = handler;
    }
  };

  return {
    connection,
    messages,
    emitMessage: (payload: unknown) => messageHandler?.(payload),
    emitClose: () => closeHandler?.(),
    emitError: (error: Error) => errorHandler?.(error)
  };
};

describe("enableRuntime", () => {
  it("sends Runtime.enable", () => {
    const { connection, messages } = makeConnection();
    enableRuntime(connection);
    expect(messages).toEqual([{ id: 1, method: "Runtime.enable" }]);
  });
});

describe("attachConsoleListener", () => {
  it("emits formatted logs", async () => {
    const { connection, emitMessage } = makeConnection();
    const output: string[] = [];
    const listener = attachConsoleListener(connection, {
      timeoutMs: 10,
      onLog: (_, formatted) => output.push(formatted)
    });

    emitMessage({
      method: "Runtime.consoleAPICalled",
      params: {
        type: "log",
        args: [{ type: "string", value: "hello" }]
      }
    });

    await listener.done;
    expect(output).toEqual(["hello"]);
  });

  it("stops after max logs", async () => {
    const { connection, emitMessage, emitClose } = makeConnection();
    const output: string[] = [];
    const listener = attachConsoleListener(connection, {
      max: 1,
      onLog: (_, formatted) => output.push(formatted)
    });

    emitMessage({
      method: "Runtime.consoleAPICalled",
      params: {
        type: "log",
        args: [{ type: "string", value: "first" }]
      }
    });

    emitClose();
    await listener.done;
    expect(output).toEqual(["first"]);
  });

  it("closes on error", async () => {
    const { connection, emitError } = makeConnection();
    const listener = attachConsoleListener(connection, {
      timeoutMs: 10,
      onLog: () => {}
    });

    emitError(new Error("boom"));
    await listener.done;
    expect(true).toBe(true);
  });
});
