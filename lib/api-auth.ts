import { NextResponse } from "next/server";

import { env } from "@/lib/env";

export function requireApiToken(request: Request) {
  if (!env.apiToken) {
    return NextResponse.json({ message: "API_TOKEN is not configured." }, { status: 503 });
  }

  const token = getRequestToken(request);
  if (token !== env.apiToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  return null;
}

function getRequestToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim();
  }

  return (
    request.headers.get("x-echotrace-client-token") ??
    request.headers.get("client-authentication") ??
    request.headers.get("x-client-authentication") ??
    ""
  ).trim();
}
