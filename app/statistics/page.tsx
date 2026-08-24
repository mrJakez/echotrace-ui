import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { StatisticsShell } from "@/components/statistics-shell";
import { DatabaseUnavailable } from "@/components/database-unavailable";
import { getRecordingStatistics } from "@/db/queries";
import { readSession } from "@/lib/auth/session";
import { isDatabaseConnectionError } from "@/lib/database-errors";
import { describeError, logServerError, logServerEvent } from "@/lib/server-log";

export default async function StatisticsPage() {
  const session = await readSession();
  if (!session) {
    logServerEvent("page:/statistics", "redirect-login");
    redirect("/login");
  }

  const requestHeaders = await headers();
  let statistics;
  try {
    statistics = await getRecordingStatistics();
  } catch (error) {
    if (!isDatabaseConnectionError(error)) {
      throw error;
    }

    logServerError("page:/statistics", "database-unavailable", describeError(error));
    return <DatabaseUnavailable />;
  }

  logServerEvent("page:/statistics", "render", {
    host: requestHeaders.get("host") ?? "-",
    recordings: statistics.totalRecordings,
    storageBytes: statistics.storage.totalBytes,
    user: session.email
  });

  return (
    <StatisticsShell
      activeProfileEmail={session.email}
      buildSha={process.env.NEXT_PUBLIC_BUILD_SHA || "dev"}
      buildTime={process.env.NEXT_PUBLIC_BUILD_TIME || ""}
      statistics={statistics}
    />
  );
}
