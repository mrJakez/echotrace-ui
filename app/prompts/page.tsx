import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { PromptsShell } from "@/components/prompts-shell";
import { listPrompts } from "@/db/queries";
import { readSession } from "@/lib/auth/session";
import { logServerEvent } from "@/lib/server-log";

export default async function PromptsPage() {
  const session = await readSession();
  if (!session) {
    logServerEvent("page:/prompts", "redirect-login");
    redirect("/login");
  }

  const requestHeaders = await headers();
  const prompts = await listPrompts();

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
