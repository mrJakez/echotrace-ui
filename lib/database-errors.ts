const CONNECTION_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTDOWN",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
  "57P01",
  "57P02",
  "57P03"
]);

const CONNECTION_ERROR_MESSAGES = [
  "connection terminated unexpectedly",
  "connection timeout",
  "connection is closed",
  "could not connect",
  "database system is starting up",
  "getaddrinfo",
  "the database system is in recovery mode"
];

type ErrorLike = {
  cause?: unknown;
  code?: unknown;
  message?: unknown;
};

export function isDatabaseConnectionError(error: unknown): boolean {
  let current = error;
  const visited = new Set<unknown>();

  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    const candidate = current as ErrorLike;
    const code = typeof candidate.code === "string" ? candidate.code : "";
    const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";

    if (
      CONNECTION_ERROR_CODES.has(code) ||
      CONNECTION_ERROR_MESSAGES.some((fragment) => message.includes(fragment))
    ) {
      return true;
    }

    current = candidate.cause;
  }

  return false;
}
