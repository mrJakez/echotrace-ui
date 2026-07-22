import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { PromptsShell } from "@/components/prompts-shell";
import { DatabaseUnavailable } from "@/components/database-unavailable";
import { listPrompts } from "@/db/queries";
import { readSession } from "@/lib/auth/session";
import { isDatabaseConnectionError } from "@/lib/database-errors";
import { describeError, logServerError, logServerEvent } from "@/lib/server-log";

export default async function PromptsPage() {
  const session = await readSession();
  if (!session) {
    logServerEvent("page:/prompts", "redirect-login");
    redirect("/login");
  }

  const requestHeaders = await headers();
  let prompts;
  try {
    prompts = await listPrompts();
  } catch (error) {
    if (!isDatabaseConnectionError(error)) {
      throw error;
    }

    logServerError("page:/prompts", "database-unavailable", describeError(error));
    return <DatabaseUnavailable />;
  }

  logServerEvent("page:/prompts", "render", {
    count: prompts.length,
    host: requestHeaders.get("host") ?? "-",
    user: session.email
  });

  return (
    <PromptsShell
      activeProfileEmail={session.email}
      buildSha={process.env.NEXT_PUBLIC_BUILD_SHA || "dev"}
      buildTime={process.env.NEXT_PUBLIC_BUILD_TIME || ""}
      initialPrompts={prompts}
    />
  );
}
