import { generateAuthenticationOptions } from "@simplewebauthn/server";

import { env } from "@/lib/env";
import { writeChallengeCookie } from "@/lib/auth/session";

export async function POST() {
  const options = await generateAuthenticationOptions({
    rpID: env.authRpId,
    userVerification: "preferred"
  });

  await writeChallengeCookie({
    challenge: options.challenge,
    type: "login"
  });

  return Response.json(options);
}
