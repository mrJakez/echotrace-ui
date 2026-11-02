const truthy = new Set(["1", "true", "yes"]);
const authOrigin = process.env.AUTH_ORIGIN || "http://localhost:3000";

function isLocalOrigin(value: string) {
  try {
    const hostname = new URL(value).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname.endsWith(".localhost");
  } catch {
    return false;
  }
}

export const env = {
  databaseUrl: process.env.DATABASE_URL,
  appTimezone: process.env.APP_TIMEZONE || "Europe/Berlin",
  audioFilesRoot: process.env.AUDIO_FILES_ROOT || "",
  audioPublicMode: process.env.AUDIO_PUBLIC_MODE || "proxy",
  audioPublicBaseUrl: process.env.AUDIO_PUBLIC_BASE_URL || "",
  audioFileNaming: process.env.AUDIO_FILE_NAMING || "auto",
  useMockData: truthy.has((process.env.USE_MOCK_DATA || "").toLowerCase()),
  authRpId: process.env.AUTH_RP_ID || "localhost",
  authRpName: process.env.AUTH_RP_NAME || "EchoTrace",
  authOrigin,
  authSessionSecret: process.env.AUTH_SESSION_SECRET || "",
  authAllowRegistration: truthy.has((process.env.AUTH_ALLOW_REGISTRATION || "").toLowerCase()),
  authBypass: truthy.has((process.env.AUTH_BYPASS || "").toLowerCase()) && isLocalOrigin(authOrigin),
  mcpInternalApiToken: process.env.MCP_INTERNAL_API_TOKEN || process.env.API_TOKEN || "",
  trelloApiKey: process.env.TRELLO_API_KEY || "",
  trelloApiToken: process.env.TRELLO_API_TOKEN || "",
  trelloApiAccessToken: process.env.TRELLO_API_ACCESS_TOKEN || "",
  trelloMaxCards: Number.parseInt(process.env.TRELLO_MAX_CARDS || "200", 10),
  n8nLlmRunsWebhookEndpoint: process.env.N8N_LLM_RUNS_WEBHOOK_ENDPOINT || "",
  apiToken: process.env.API_TOKEN || ""
};

export function hasDatabaseConfig() {
  return Boolean(env.databaseUrl);
}
