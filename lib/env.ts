const truthy = new Set(["1", "true", "yes"]);

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
  authOrigin: process.env.AUTH_ORIGIN || "http://localhost:3000",
  authSessionSecret: process.env.AUTH_SESSION_SECRET || "",
  authAllowRegistration: truthy.has((process.env.AUTH_ALLOW_REGISTRATION || "").toLowerCase()),
  n8nLlmRunsWebhookEndpoint: process.env.N8N_LLM_RUNS_WEBHOOK_ENDPOINT || "",
  apiToken: process.env.API_TOKEN || ""
};

export function hasDatabaseConfig() {
  return Boolean(env.databaseUrl);
}
