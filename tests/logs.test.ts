import { describe, expect, it } from "bun:test";
import { formatConsoleArgument, formatConsoleArguments } from "../src/logs.js";

describe("formatConsoleArgument", () => {
  it("strips error stack by default", () => {
    const arg = {
      type: "object",
      subtype: "error",
      description: "TypeError: boom\n    at foo (index.js:1:1)\n    at bar"
    };
    expect(formatConsoleArgument(arg)).toBe("TypeError: boom (index.js:1:1)");
  });

  it("skips node_modules frames", () => {
    const arg = {
      type: "object",
      subtype: "error",
      description:
        "TypeError: boom\n    at foo (node_modules/react/index.js:1:1)\n    at bar (App.tsx:2:3)"
    };
    expect(formatConsoleArgument(arg)).toBe("TypeError: boom (App.tsx:2:3)");
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

describe("formatConsoleArguments", () => {
  it("appends code frame location and drops Error Stack", () => {
    const args = [
      { type: "string", value: "error:" },
      { type: "string", value: "wtf" },
      {
        type: "string",
        value: "Code: explore.tsx\n  11 |\n> 13 |   console.error(\"wtf\");"
      },
      { type: "string", value: "Error Stack:" }
    ];
    expect(formatConsoleArguments(args)).toBe("error: wtf\nStack Trace:\n  at explore.tsx:13");
  });

  it("uses inline source from stack lines when available", () => {
    const args = [
      { type: "string", value: "error:" },
      { type: "string", value: "wtf" },
      {
        type: "string",
        value:
          "Error Stack:\n    at overrideMethod (http://localhost:8081/index.bundle:1:1)\n    at TabTwoScreen(./(tabs)/explore.tsx) (http://localhost:8081/index.bundle:2:2)"
      }
    ];
    expect(formatConsoleArguments(args)).toBe(
      "error: wtf\nStack Trace:\n  at ./(tabs)/explore.tsx"
    );
  });
});
