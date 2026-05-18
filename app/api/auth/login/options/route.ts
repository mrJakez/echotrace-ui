import { generateAuthenticationOptions } from "@simplewebauthn/server";

import { env } from "@/lib/env";
import { writeChallengeCookie } from "@/lib/auth/session";
import { logServerEvent } from "@/lib/server-log";

export async function POST() {
  const options = await generateAuthenticationOptions({
    rpID: env.authRpId,
    userVerification: "preferred"
  });

  await writeChallengeCookie({
    challenge: options.challenge,
    type: "login"
  });

  logServerEvent("api:/api/auth/login/options", "challenge-created");

  return Response.json(options);
}
