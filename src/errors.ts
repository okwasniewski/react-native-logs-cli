type ErrorLike = {
  message?: string;
  cause?: unknown;
  code?: string;
};

const METRO_ERROR_HINTS = "Ensure Metro is running and reachable";

/**
 * Format Metro connection errors into user-friendly messages.
 */
export function formatMetroConnectionError(
  error: unknown,
  metroServerOrigin: string
): string {
  if (isMetroConnectionError(error)) {
    return `Metro not reachable at ${metroServerOrigin}; ${METRO_ERROR_HINTS}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return `Unexpected error: ${String(error)}`;
}

/**
 * Detect Metro connection errors across runtimes.
 */
export function isMetroConnectionError(error: unknown): boolean {
  const message = getErrorMessage(error);
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes("econnrefused") ||
    normalized.includes("econnreset") ||
    normalized.includes("etimedout") ||
    normalized.includes("enotfound") ||
    normalized.includes("ehostunreach") ||
    normalized.includes("connection refused") ||
    normalized.includes("socket hang up") ||
    normalized.includes("fetch failed")
  );
}

function getErrorMessage(error: unknown): string | null {
  if (error instanceof Error) {
    const cause = error.cause as ErrorLike | undefined;
    const causeMessage = cause?.message || cause?.code;
    return [error.message, causeMessage].filter(Boolean).join(" ").trim();
  }

  const candidate = error as ErrorLike;
  if (candidate?.message) {
    return candidate.message;
  }

  if (candidate?.code) {
    return candidate.code;
  }

  return null;
}
