import { NextResponse } from "next/server";

import { listWeekRecordings } from "@/db/queries";
import { requireApiSession } from "@/lib/auth/guards";
import { fromDateKey, startOfWeek } from "@/lib/time";

export async function GET(request: Request) {
  const auth = await requireApiSession();
  if (auth.response) {
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

  return NextResponse.json(data);
}
