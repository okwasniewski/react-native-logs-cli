import { describe, expect, it } from "bun:test";
import { formatConsoleArgument, formatConsoleMessage } from "../src/logs.js";

describe("formatConsoleArgument", () => {
  it("renders undefined and null", () => {
    expect(formatConsoleArgument({ type: "undefined" })).toBe("undefined");
    expect(formatConsoleArgument({ type: "object", subtype: "null" })).toBe("null");
  });

  it("prefers description", () => {
    expect(
      formatConsoleArgument({
        type: "object",
        description: "{ foo: 1 }"
      })
    ).toBe("{ foo: 1 }");
  });

  it("falls back to value", () => {
    expect(formatConsoleArgument({ type: "string", value: "hi" })).toBe("hi");
  });

  it("handles unserializable values", () => {
    expect(
      formatConsoleArgument({
        type: "number",
        unserializableValue: "NaN"
      })
    ).toBe("NaN");
  });
});

describe("formatConsoleMessage", () => {
  it("prefixes errors and warnings", () => {
    expect(
      formatConsoleMessage({
        level: "error",
        text: "boom",
        timestamp: 0
      })
    ).toBe("error: boom");
    expect(
      formatConsoleMessage({
        level: "warning",
        text: "warn",
        timestamp: 0
      })
    ).toBe("warn: warn");
  });
});
