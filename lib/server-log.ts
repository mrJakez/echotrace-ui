const MAX_LOG_VALUE_LENGTH = 4_000;
const REDACTED_LOG_KEYS = new Set([
  "body",
  "markdown",
  "parameters",
  "params",
  "payload",
  "requestbody",
  "responsebody",
  "summary",
  "text",
  "transcript",
  "transcriptsummary"
]);

function serializeMetaValue(value: unknown) {
  const serialized = JSON.stringify(value, (key, nestedValue) =>
    REDACTED_LOG_KEYS.has(key.toLowerCase()) ? "[redacted]" : nestedValue
  );
  if (!serialized || serialized.length <= MAX_LOG_VALUE_LENGTH) {
    return serialized;
  }

  return `${serialized.slice(0, MAX_LOG_VALUE_LENGTH)}… [truncated]`;
}

function formatMeta(meta: Record<string, unknown>) {
  return Object.entries(meta)
    .filter(([, value]) => value !== undefined)
    .map(
      ([key, value]) =>
        `${key}=${REDACTED_LOG_KEYS.has(key.toLowerCase()) ? JSON.stringify("[redacted]") : serializeMetaValue(value)}`
    )
    .join(" ");
}

const MAX_ERROR_TEXT_LENGTH = 4_000;

function sanitizeErrorText(value: string) {
  const withoutQueryParameters = value.replace(/(\bparams?:)([\s\S]*?)(?=\n\s+at\s|$)/gi, "$1 [redacted]");
  if (withoutQueryParameters.length <= MAX_ERROR_TEXT_LENGTH) {
    return withoutQueryParameters;
  }

  return `${withoutQueryParameters.slice(0, MAX_ERROR_TEXT_LENGTH)}… [truncated]`;
}

export function logServerEvent(scope: string, message: string, meta: Record<string, unknown> = {}) {
  const suffix = formatMeta(meta);
  const line = suffix ? `[server] ${scope} ${message} ${suffix}` : `[server] ${scope} ${message}`;
  console.info(line);
}

export function logServerError(scope: string, message: string, meta: Record<string, unknown> = {}) {
  const suffix = formatMeta(meta);
  const line = suffix ? `[server:error] ${scope} ${message} ${suffix}` : `[server:error] ${scope} ${message}`;
  console.error(line);
}

export function describeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { value: String(error) };
  }

  const candidate = error as Error & { cause?: unknown; code?: unknown; constraint?: unknown };
  const cause = candidate.cause;
  return {
    name: error.name,
    message: sanitizeErrorText(error.message),
    code: typeof candidate.code === "string" ? candidate.code : undefined,
    constraint: typeof candidate.constraint === "string" ? candidate.constraint : undefined,
    stack: error.stack ? sanitizeErrorText(error.stack) : undefined,
    cause: cause === undefined ? undefined : describeError(cause)
  };
}
