import { describe, expect, it } from "bun:test";
import { createTailBuffer } from "../src/buffer.js";

describe("createTailBuffer", () => {
  it("keeps last n items", () => {
    const buffer = createTailBuffer(3);
    buffer.push("a");
    buffer.push("b");
    buffer.push("c");
    buffer.push("d");
    expect(buffer.values()).toEqual(["b", "c", "d"]);
  });

  it("returns all items when under limit", () => {
    const buffer = createTailBuffer(5);
    buffer.push("a");
    buffer.push("b");
    expect(buffer.values()).toEqual(["a", "b"]);
  });
});
