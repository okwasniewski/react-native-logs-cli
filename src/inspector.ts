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
    capabilities: {
      nativePageReloads?: boolean;
    };
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
 * Based on Expo CLI JsInspector query helper in expo/cli.
 */
export async function fetchInspectorAppsAsync(metroServerOrigin: string): Promise<InspectorApp[]> {
  const endpoints = ["/json/list", "/json"];
  for (const endpoint of endpoints) {
    const url = `${metroServerOrigin}${endpoint}`;
    const apps = await fetchInspectorAppsFromUrl(url);
    if (apps) {
      const sorted = [...apps].reverse();
      return sorted.filter(pageIsSupported);
    }
  }

  return [];
}

/**
 * Fetch inspector apps from a single Metro endpoint.
 */
async function fetchInspectorAppsFromUrl(url: string): Promise<InspectorApp[] | null> {
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as unknown;
  if (!Array.isArray(data)) {
    return null;
  }

  return data as InspectorApp[];
}

/**
 * Match Expo's supported debug targets filter.
 */
function pageIsSupported(app: InspectorApp): boolean {
  return (
    app.title === "React Native Experimental (Improved Chrome Reloads)" ||
    app.reactNative?.capabilities?.nativePageReloads === true
  );
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
