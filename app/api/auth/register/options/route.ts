import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { z } from "zod";

import { createUser, findUserByEmail, listPasskeysForUser } from "@/db/auth-queries";
import { env } from "@/lib/env";
import { writeChallengeCookie } from "@/lib/auth/session";

const schema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(120)
});

export async function POST(request: Request) {
  if (!env.authAllowRegistration) {
    return Response.json({ message: "Registration is disabled" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ message: "Invalid payload" }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  let user = await findUserByEmail(email);

  if (!user) {
    user = await createUser(email, parsed.data.name.trim());
  }

  const passkeys = await listPasskeysForUser(user.id);
  const options = await generateRegistrationOptions({
    attestationType: "none",
    excludeCredentials: passkeys.map((passkey) => ({
      id: passkey.credentialId,
      transports: passkey.transports
        ? (passkey.transports.split(",") as AuthenticatorTransportFuture[])
        : undefined
    })),
    rpID: env.authRpId,
    rpName: env.authRpName,
    supportedAlgorithmIDs: [-7, -257],
    userDisplayName: user.displayName,
    userID: Buffer.from(user.id, "utf8"),
    userName: user.email,
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "preferred"
    }
  });

  await writeChallengeCookie({
    challenge: options.challenge,
    email: user.email,
    name: user.displayName,
    type: "register"
  });

  return Response.json(options);
}
