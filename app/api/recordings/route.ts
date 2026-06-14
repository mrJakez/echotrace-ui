import { NextResponse } from "next/server";

import { listWeekRecordings, searchRecordings, searchRecordingsByTag } from "@/db/queries";
import { requireApiSession } from "@/lib/auth/guards";
import { logServerEvent } from "@/lib/server-log";
import { fromDateKey, startOfWeek } from "@/lib/time";

export async function GET(request: Request) {
  const auth = await requireApiSession();
  if (auth.response) {
    logServerEvent("api:/api/recordings", "unauthorized");
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const categoryFilter = searchParams.get("categoryFilter") as "all" | "work" | "private" | "unknown" | null;
  const weekStartParam = searchParams.get("weekStart");
  const reviewFilter = searchParams.get("reviewFilter") as "all" | "pending_review" | "approved" | "rejected" | null;
  const query = searchParams.get("q")?.trim() ?? "";
  const tagId = searchParams.get("tagId")?.trim() ?? "";
  const tagFilter = searchParams.get("tagFilter")?.trim() ?? "";
  const limit = Number.parseInt(searchParams.get("limit") ?? "20", 10);
  const includeRejected = searchParams.get("includeRejected") === "true";
  const data =
    tagId.length > 0
      ? await searchRecordingsByTag(tagId, {
          categoryFilter: categoryFilter ?? "all",
          includeRejected,
          limit: Number.isFinite(limit) ? Math.max(1, Math.min(limit, 100)) : 50,
          reviewFilter: reviewFilter ?? "all"
        })
      : query.length > 0
      ? await searchRecordings(query, {
          categoryFilter: categoryFilter ?? "all",
          includeRejected,
          limit: Number.isFinite(limit) ? Math.max(1, Math.min(limit, 100)) : 20,
          reviewFilter: reviewFilter ?? "all"
        })
      : await listWeekRecordings(startOfWeek(weekStartParam ? (fromDateKey(weekStartParam) ?? new Date(weekStartParam)) : startOfWeek(new Date())).toISOString(), {
          categoryFilter: categoryFilter ?? "all",
          includeRejected,
          reviewFilter: reviewFilter ?? "all",
          tagFilter: tagFilter || null
        });

  logServerEvent("api:/api/recordings", "ok", {
    categoryFilter: categoryFilter ?? "all",
    includeRejected,
    query: query || "-",
    reviewFilter: reviewFilter ?? "all",
    tagFilter: tagFilter || "-",
    user: auth.session.email,
    weekStart: weekStartParam ?? "-",
    count: data.length
  });

  return NextResponse.json(data);
}
