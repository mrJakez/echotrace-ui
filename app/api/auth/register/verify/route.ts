import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";

import { createPasskey, findPasskeyByCredentialId, findUserByEmail } from "@/db/auth-queries";
import { bytesToBase64Url } from "@/lib/auth/encoding";
import { clearChallengeCookie, createSessionCookie, readChallengeCookie } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { logServerEvent } from "@/lib/server-log";

export async function POST(request: Request) {
  if (!env.authAllowRegistration) {
    logServerEvent("api:/api/auth/register/verify", "registration-disabled");
    return Response.json({ message: "Registration is disabled" }, { status: 403 });
  }

  const challenge = await readChallengeCookie();
  if (!challenge || challenge.type !== "register") {
    logServerEvent("api:/api/auth/register/verify", "missing-challenge");
    return Response.json({ message: "Registration challenge missing" }, { status: 400 });
  }

  const body = await request.json();
  const verification = await verifyRegistrationResponse({
    expectedChallenge: challenge.challenge,
    expectedOrigin: env.authOrigin,
    expectedRPID: env.authRpId,
    response: body
  });

  if (!verification.verified || !verification.registrationInfo) {
    logServerEvent("api:/api/auth/register/verify", "verification-failed", { email: challenge.email });
    return Response.json({ message: "Passkey registration failed" }, { status: 400 });
  }

  const existingPasskey = await findPasskeyByCredentialId(verification.registrationInfo.credential.id);
  if (existingPasskey) {
    logServerEvent("api:/api/auth/register/verify", "passkey-exists", { email: challenge.email });
    return Response.json({ message: "Passkey already exists" }, { status: 409 });
  }

  const user = await findUserByEmail(challenge.email);
  if (!user) {
    logServerEvent("api:/api/auth/register/verify", "user-not-found", { email: challenge.email });
    return Response.json({ message: "User not found" }, { status: 404 });
  }

  await createPasskey({
    backedUp: verification.registrationInfo.credentialBackedUp,
    counter: verification.registrationInfo.credential.counter,
    credentialId: verification.registrationInfo.credential.id,
    deviceType: verification.registrationInfo.credentialDeviceType,
    publicKey: bytesToBase64Url(verification.registrationInfo.credential.publicKey),
    transports: body.response?.transports?.join(",") ?? null,
    userId: user.id
  });

  await clearChallengeCookie();
  await createSessionCookie({ email: user.email, userId: user.id });
  logServerEvent("api:/api/auth/register/verify", "registration-ok", { email: user.email, userId: user.id });

  return Response.json({ ok: true });
}
