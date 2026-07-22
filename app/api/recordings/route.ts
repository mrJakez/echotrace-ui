import { NextResponse } from "next/server";

import { listRecordingsPage, listWeekRecordings, searchRecordings, searchRecordingsByTag } from "@/db/queries";
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
  const categoryFilters = (searchParams.get("categories") ?? "")
    .split(",")
    .filter((value): value is "work" | "private" | "unknown" =>
      value === "work" || value === "private" || value === "unknown"
    );
  const weekStartParam = searchParams.get("weekStart");
  const reviewFilter = searchParams.get("reviewFilter") as "all" | "pending_review" | "approved" | "rejected" | null;
  const query = searchParams.get("q")?.trim() ?? "";
  const tagId = searchParams.get("tagId")?.trim() ?? "";
  const tagFilter = searchParams.get("tagFilter")?.trim() ?? "";
  const limit = Number.parseInt(searchParams.get("limit") ?? "20", 10);
  const includeRejected = searchParams.get("includeRejected") === "true";
  if (searchParams.get("scope") === "all") {
    const offset = Number.parseInt(searchParams.get("offset") ?? "0", 10);
    const page = await listRecordingsPage({
      categoryFilter: categoryFilter ?? "all",
      categoryFilters,
      dateFrom: searchParams.get("dateFrom")?.trim() ?? "",
      dateTo: searchParams.get("dateTo")?.trim() ?? "",
      limit: Number.isFinite(limit) ? Math.max(1, Math.min(limit, 100)) : 50,
      offset: Number.isFinite(offset) ? Math.max(0, offset) : 0,
      query,
      reviewFilter: reviewFilter ?? "all",
      reviewStatuses: (searchParams.get("reviewStatuses") ?? "")
        .split(",")
        .filter((value): value is "pending_review" | "approved" | "rejected" =>
          value === "pending_review" || value === "approved" || value === "rejected"
        ),
      tagIds: (searchParams.get("tagIds") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
      tagQuery: searchParams.get("tagQuery")?.trim() ?? "",
      titleQuery: searchParams.get("titleQuery")?.trim() ?? ""
    });
    logServerEvent("api:/api/recordings", "all-page", {
      categoryFilter: categoryFilter ?? "all",
      count: page.items.length,
      hasMore: page.hasMore,
      offset,
      reviewFilter: reviewFilter ?? "all",
      total: page.total,
      user: auth.session.email
    });
    return NextResponse.json(page);
  }
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
