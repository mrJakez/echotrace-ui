import { clearChallengeCookie, clearSessionCookie } from "@/lib/auth/session";
import { logServerEvent } from "@/lib/server-log";

export async function POST() {
  await clearChallengeCookie();
  await clearSessionCookie();
  logServerEvent("api:/api/auth/logout", "logout-ok");
  return Response.json({ ok: true });
}
