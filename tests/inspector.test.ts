import { describe, expect, it } from "bun:test";
import { getMetroServerOrigin, selectInspectorApp, type InspectorApp } from "../src/inspector.js";

const apps: InspectorApp[] = [
  {
    id: "1",
    title: "app",
    appId: "com.example.app",
    description: "",
    type: "node",
    devtoolsFrontendUrl: "",
    webSocketDebuggerUrl: "ws://localhost:1234",
    deviceName: "iPhone 15"
  },
  {
    id: "2",
    title: "app",
    appId: "com.example.other",
    description: "",
    type: "node",
    devtoolsFrontendUrl: "",
    webSocketDebuggerUrl: "ws://localhost:5678",
    deviceName: "Pixel 8"
  }
];

describe("getMetroServerOrigin", () => {
  it("adds scheme when missing", () => {
    expect(getMetroServerOrigin("localhost", 8081)).toBe("http://localhost:8081");
  });

  it("preserves scheme", () => {
    expect(getMetroServerOrigin("http://127.0.0.1", 8081)).toBe("http://127.0.0.1:8081");
  });
});

describe("selectInspectorApp", () => {
  it("selects by id", () => {
    expect(selectInspectorApp(apps, "1")?.appId).toBe("com.example.app");
  });

  it("selects by appId", () => {
    expect(selectInspectorApp(apps, "com.example.other")?.id).toBe("2");
  });

  it("selects by device name", () => {
    expect(selectInspectorApp(apps, "iphone 15")?.id).toBe("1");
  });

  it("throws on ambiguous selector", () => {
    const duplicated = [
      { ...apps[0], id: "3", deviceName: "Pixel 8" }
    ];
    expect(() => selectInspectorApp([...apps, ...duplicated], "pixel 8")).toThrow(
      /multiple apps match/
    );
  });
});
