export type InspectorApp = {
  id: string;
  title: string;
  appId: string;
  description: string;
  type: "node";
  devtoolsFrontendUrl: string;
  webSocketDebuggerUrl: string;
  deviceName?: string;
  reactNative?: {
    logicalDeviceId: string;
    capabilities: unknown;
  };
};

/**
 * Build Metro server origin from host/port.
 */
export function getMetroServerOrigin(host: string, port: number): string {
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(host);
  const baseUrl = hasScheme ? new URL(host) : new URL(`http://${host}`);
  baseUrl.port = `${port}`;
  return baseUrl.origin;
}

/**
 * Fetch inspector apps from Metro.
 */
export async function fetchInspectorAppsAsync(metroServerOrigin: string): Promise<InspectorApp[]> {
  const { queryAllInspectorAppsAsync } = (await import(
    "@expo/cli/build/src/start/server/middleware/inspector/JsInspector.js"
  )) as {
    queryAllInspectorAppsAsync: (origin: string) => Promise<InspectorApp[]>;
  };

  return queryAllInspectorAppsAsync(metroServerOrigin);
}

/**
 * Select an inspector app by id or name.
 */
export function selectInspectorApp(
  apps: InspectorApp[],
  selector: string
): InspectorApp | null {
  const trimmed = selector.trim();
  if (!trimmed) {
    return null;
  }

  const byId = apps.find((app) => app.id === trimmed);
  if (byId) {
    return byId;
  }

  const normalized = trimmed.toLowerCase();
  const matches = apps.filter((app) => {
    const deviceName = app.deviceName?.toLowerCase();
    return deviceName === normalized || app.appId.toLowerCase() === normalized;
  });

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    throw new Error(`multiple apps match "${selector}"`);
  }

  return null;
}
