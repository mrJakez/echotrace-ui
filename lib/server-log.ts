function formatMeta(meta: Record<string, unknown>) {
  return Object.entries(meta)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(" ");
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

  const cause = "cause" in error ? error.cause : undefined;
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    cause: cause === undefined ? undefined : describeError(cause)
  };
}
