import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { CalendarShell } from "@/components/calendar-shell";
import { DatabaseUnavailable } from "@/components/database-unavailable";
import { listWeekRecordings } from "@/db/queries";
import { readSession } from "@/lib/auth/session";
import { isDatabaseConnectionError } from "@/lib/database-errors";
import { describeError, logServerError, logServerEvent } from "@/lib/server-log";
import { fromDateKey, startOfWeek } from "@/lib/time";

export type RecordingsViewSearchParams = Promise<{
  categoryFilter?: "all" | "work" | "private" | "unknown";
  reviewFilter?: "all" | "pending_review" | "approved" | "rejected";
  tagFilter?: string;
  weekStart?: string;
}>;

export async function RecordingsViewPage({
  searchParams,
  view
}: {
  searchParams: RecordingsViewSearchParams;
  view: "list" | "week";
}) {
  const session = await readSession();
  if (!session) {
    logServerEvent(`page:/${view}`, "redirect-login");
    redirect("/login");
  }

  const params = await searchParams;
  const requestHeaders = await headers();
  const weekStart =
    params.weekStart ? (fromDateKey(params.weekStart) ?? new Date(params.weekStart)) : startOfWeek(new Date());
  const normalizedWeekStart = startOfWeek(weekStart);
  const categoryFilter = params.categoryFilter ?? "all";
  const reviewFilter = params.reviewFilter ?? "all";
  const tagFilter = params.tagFilter?.trim() || null;
  let recordings;
  try {
    recordings = await listWeekRecordings(normalizedWeekStart.toISOString(), {
      categoryFilter: "all",
      includeRejected: true,
      reviewFilter: "all",
      tagFilter: null
    });
  } catch (error) {
    if (!isDatabaseConnectionError(error)) {
      throw error;
    }

    logServerError(`page:/${view}`, "database-unavailable", describeError(error));
    return <DatabaseUnavailable />;
  }

  logServerEvent(`page:/${view}`, "render", {
    categoryFilter,
    host: requestHeaders.get("host") ?? "-",
    reviewFilter,
    tagFilter: tagFilter ?? "-",
    user: session.email,
    weekStart: normalizedWeekStart.toISOString()
  });

  return (
    <CalendarShell
      activeProfileEmail={session.email}
      buildSha={process.env.NEXT_PUBLIC_BUILD_SHA || "dev"}
      buildTime={process.env.NEXT_PUBLIC_BUILD_TIME || ""}
      initialCategoryFilter={categoryFilter}
      initialReviewFilter={reviewFilter}
      initialTagFilter={tagFilter}
      initialWeekStart={normalizedWeekStart.toISOString()}
      recordings={recordings}
    />
  );
}
