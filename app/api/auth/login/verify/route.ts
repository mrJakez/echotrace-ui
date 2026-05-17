import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";

import { findPasskeyByCredentialId, findUserById, updatePasskeyCounter } from "@/db/auth-queries";
import { base64UrlToBytes } from "@/lib/auth/encoding";
import { clearChallengeCookie, createSessionCookie, readChallengeCookie } from "@/lib/auth/session";
import { env } from "@/lib/env";

export async function POST(request: Request) {
  const challenge = await readChallengeCookie();
  if (!challenge || challenge.type !== "login") {
    return Response.json({ message: "Login challenge missing" }, { status: 400 });
  }

  const body = await request.json();
  const passkey = await findPasskeyByCredentialId(body.id);
  if (!passkey) {
    return Response.json({ message: "Passkey not found" }, { status: 404 });
  }

  const verification = await verifyAuthenticationResponse({
    expectedChallenge: challenge.challenge,
    expectedOrigin: env.authOrigin,
    expectedRPID: env.authRpId,
    response: body,
    credential: {
      id: passkey.credentialId,
      publicKey: base64UrlToBytes(passkey.publicKey),
      counter: passkey.counter,
      transports: passkey.transports
        ? (passkey.transports.split(",") as AuthenticatorTransportFuture[])
        : undefined
    }
  });

  if (!verification.verified) {
    return Response.json({ message: "Passkey login failed" }, { status: 400 });
  }

  await updatePasskeyCounter(passkey.credentialId, verification.authenticationInfo.newCounter);

  const user = await findUserById(passkey.userId);
  if (!user) {
    return Response.json({ message: "User not found" }, { status: 404 });
  }

  await clearChallengeCookie();
  await createSessionCookie({ email: user.email, userId: user.id });

  return Response.json({ ok: true });
}
