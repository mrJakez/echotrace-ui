import { NextResponse } from "next/server";

import { listWeekRecordings } from "@/db/queries";
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
  const includeRejected = searchParams.get("includeRejected") === "true";
  const weekStart = weekStartParam ? (fromDateKey(weekStartParam) ?? new Date(weekStartParam)) : startOfWeek(new Date());
  const data = await listWeekRecordings(startOfWeek(weekStart).toISOString(), {
    categoryFilter: categoryFilter ?? "all",
    includeRejected,
    reviewFilter: reviewFilter ?? "all"
  });

  logServerEvent("api:/api/recordings", "ok", {
    categoryFilter: categoryFilter ?? "all",
    includeRejected,
    reviewFilter: reviewFilter ?? "all",
    user: auth.session.email,
    weekStart: startOfWeek(weekStart).toISOString(),
    count: data.length
  });

  return NextResponse.json(data);
}
