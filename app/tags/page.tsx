import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { TagsShell } from "@/components/tags-shell";
import { listTags } from "@/db/queries";
import { readSession } from "@/lib/auth/session";
import { logServerEvent } from "@/lib/server-log";

export default async function TagsPage() {
  const session = await readSession();
  if (!session) {
    logServerEvent("page:/tags", "redirect-login");
    redirect("/login");
  }

  const requestHeaders = await headers();
  const tags = await listTags();

  logServerEvent("page:/tags", "render", {
    host: requestHeaders.get("host") ?? "-",
    roots: tags.length,
    user: session.email
  });

  return (
    <TagsShell
      activeProfileEmail={session.email}
      buildSha={process.env.NEXT_PUBLIC_BUILD_SHA || "dev"}
      buildTime={process.env.NEXT_PUBLIC_BUILD_TIME || ""}
      initialTags={tags}
    />
  );
}
