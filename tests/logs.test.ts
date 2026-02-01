import { describe, expect, it } from "bun:test";
import { formatConsoleArgument } from "../src/logs.js";

describe("formatConsoleArgument", () => {
  it("strips error stack by default", () => {
    const arg = {
      type: "object",
      subtype: "error",
      description: "TypeError: boom\n    at foo (index.js:1:1)\n    at bar"
    };
    expect(formatConsoleArgument(arg)).toBe("TypeError: boom");
  });

  it("keeps error stack when verbose", () => {
    const arg = {
      type: "object",
      subtype: "error",
      description: "TypeError: boom\n    at foo (index.js:1:1)\n    at bar"
    };
    expect(formatConsoleArgument(arg, { verbose: true })).toBe(
      "TypeError: boom\n    at foo (index.js:1:1)\n    at bar"
    );
  });
});
