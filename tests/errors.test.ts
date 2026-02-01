import { describe, expect, it } from "bun:test";
import { formatMetroConnectionError, isMetroConnectionError } from "../src/errors.js";

describe("isMetroConnectionError", () => {
  it("detects connection refused", () => {
    const error = new Error("connect ECONNREFUSED 127.0.0.1:8081");
    expect(isMetroConnectionError(error)).toBe(true);
  });

  it("does not treat no apps connected as Metro error", () => {
    const error = new Error("no apps connected to Metro. Run your app on a simulator or device.");
    expect(isMetroConnectionError(error)).toBe(false);
  });

  it("detects fetch failed", () => {
    const error = new Error("fetch failed");
    expect(isMetroConnectionError(error)).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    const error = new Error("bad input");
    expect(isMetroConnectionError(error)).toBe(false);
  });
});

describe("formatMetroConnectionError", () => {
  it("adds metro origin and hint", () => {
    const error = new Error("connect ECONNREFUSED 127.0.0.1:8081");
    const message = formatMetroConnectionError(error, "http://localhost:8081");
    expect(message).toContain("http://localhost:8081");
    expect(message).toContain("ensure Metro is running");
  });
});
