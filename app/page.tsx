import { redirect } from "next/navigation";

import { CalendarShell } from "@/components/calendar-shell";
import { listWeekRecordings } from "@/db/queries";
import { readSession } from "@/lib/auth/session";
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
    redirect("/login");
  }

  const params = await searchParams;
  const weekStart =
    params.weekStart ? (fromDateKey(params.weekStart) ?? new Date(params.weekStart)) : startOfWeek(new Date());
  const normalizedWeekStart = startOfWeek(weekStart);
  const categoryFilter = params.categoryFilter ?? "all";
  const reviewFilter = params.reviewFilter ?? "all";
  const recordings = await listWeekRecordings(normalizedWeekStart.toISOString(), {
    categoryFilter,
    reviewFilter
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
