import { NextResponse } from "next/server";

import { searchGlobal } from "@/db/queries";
import { requireApiSession } from "@/lib/auth/guards";
import { logServerEvent } from "@/lib/server-log";

export async function GET(request: Request) {
  const auth = await requireApiSession();
  if (auth.response) {
    logServerEvent("api:/api/search", "unauthorized");
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const categoryFilter = searchParams.get("categoryFilter") as "all" | "work" | "private" | "unknown" | null;
  const reviewFilter = searchParams.get("reviewFilter") as "all" | "pending_review" | "approved" | "rejected" | null;
  const includeRejected = searchParams.get("includeRejected") === "true";
  const limit = Number.parseInt(searchParams.get("limit") ?? "20", 10);

  const payload = await searchGlobal(query, {
    categoryFilter: categoryFilter ?? "all",
    includeRejected,
    limit: Number.isFinite(limit) ? Math.max(1, Math.min(limit, 100)) : 20,
    reviewFilter: reviewFilter ?? "all"
  });

  logServerEvent("api:/api/search", "ok", {
    query: query || "-",
    recordings: payload.recordings.length,
    tags: payload.tags.length,
    user: auth.session.email
  });

  return NextResponse.json(payload);
}
