import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { CalendarShell } from "@/components/calendar-shell";
import { listWeekRecordings } from "@/db/queries";
import { readSession } from "@/lib/auth/session";
import { logServerEvent } from "@/lib/server-log";
import { fromDateKey, startOfWeek } from "@/lib/time";

type HomePageProps = {
  searchParams: Promise<{
    categoryFilter?: "all" | "work" | "private" | "unknown";
    reviewFilter?: "all" | "pending_review" | "approved" | "rejected";
    weekStart?: string;
  }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await readSession();
  if (!session) {
    logServerEvent("page:/", "redirect-login");
    redirect("/login");
  }

  const params = await searchParams;
  const requestHeaders = await headers();
  const weekStart =
    params.weekStart ? (fromDateKey(params.weekStart) ?? new Date(params.weekStart)) : startOfWeek(new Date());
  const normalizedWeekStart = startOfWeek(weekStart);
  const categoryFilter = params.categoryFilter ?? "all";
  const reviewFilter = params.reviewFilter ?? "all";
  const recordings = await listWeekRecordings(normalizedWeekStart.toISOString(), {
    categoryFilter,
    reviewFilter
  });

  logServerEvent("page:/", "render", {
    categoryFilter,
    host: requestHeaders.get("host") ?? "-",
    reviewFilter,
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
      initialWeekStart={normalizedWeekStart.toISOString()}
      recordings={recordings}
    />
  );
}
