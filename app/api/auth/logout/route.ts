import { clearChallengeCookie, clearSessionCookie } from "@/lib/auth/session";

export async function POST() {
  await clearChallengeCookie();
  await clearSessionCookie();
  return Response.json({ ok: true });
}
