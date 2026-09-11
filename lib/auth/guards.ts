import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { readSession } from "@/lib/auth/session";
import { env } from "@/lib/env";

type ApiSession = {
  email: string;
  userId: string;
};

async function readInternalSession(): Promise<ApiSession | null> {
  if (!env.mcpInternalApiToken) {
    return null;
  }

  const requestHeaders = await headers();
  if (requestHeaders.get("x-echotrace-internal-token") !== env.mcpInternalApiToken) {
    return null;
  }

  const userId = requestHeaders.get("x-echotrace-user-id")?.trim();
  if (!userId) {
    return null;
  }

  return {
    email: requestHeaders.get("x-echotrace-user-email")?.trim() || `mcp:${userId}`,
    userId
  };
}

export async function requireApiSession() {
  const session = (await readInternalSession()) ?? (await readSession());
  if (!session) {
    return {
      response: NextResponse.json({ message: "Unauthorized" }, { status: 401 }),
      session: null
    };
  }

  return { response: null, session };
}
