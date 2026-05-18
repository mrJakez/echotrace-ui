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
