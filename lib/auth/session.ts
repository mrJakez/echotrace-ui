import { createHmac, timingSafeEqual } from "crypto";

import { cookies } from "next/headers";

import { env } from "@/lib/env";

export const AUTH_SESSION_COOKIE = "echotrace_session";
export const AUTH_CHALLENGE_COOKIE = "echotrace_auth_challenge";

type SessionPayload = {
  email: string;
  exp: number;
  userId: string;
};

type ChallengePayload =
  | {
      challenge: string;
      email: string;
      exp: number;
      name: string;
      type: "register";
    }
  | {
      challenge: string;
      exp: number;
      type: "login";
    };

type ChallengeInput =
  | {
      challenge: string;
      email: string;
      name: string;
      type: "register";
    }
  | {
      challenge: string;
      type: "login";
    };

function getSecret() {
  if (!env.authSessionSecret) {
    throw new Error("AUTH_SESSION_SECRET is required for passkey auth");
  }

  return env.authSessionSecret;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function serialize<T>(payload: T) {
  const encoded = encodeBase64Url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

function deserialize<T>(token: string | undefined): T | null {
  if (!token) {
    return null;
  }

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expected = sign(encoded);
  const given = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) {
    return null;
  }

  try {
    return JSON.parse(decodeBase64Url(encoded)) as T;
  } catch {
    return null;
  }
}

export async function readSession() {
  const token = (await cookies()).get(AUTH_SESSION_COOKIE)?.value;
  const payload = deserialize<SessionPayload>(token);

  if (!payload || payload.exp < Date.now()) {
    return null;
  }

  return payload;
}

export async function createSessionCookie(input: { email: string; userId: string }) {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 30;
  const value = serialize<SessionPayload>({ ...input, exp });

  (await cookies()).set(AUTH_SESSION_COOKIE, value, {
    expires: new Date(exp),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: env.authOrigin.startsWith("https://")
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(AUTH_SESSION_COOKIE);
}

export async function writeChallengeCookie(payload: ChallengeInput) {
  const exp = Date.now() + 1000 * 60 * 10;
  const value = serialize<ChallengePayload>({ ...payload, exp });

  (await cookies()).set(AUTH_CHALLENGE_COOKIE, value, {
    expires: new Date(exp),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: env.authOrigin.startsWith("https://")
  });
}

export async function readChallengeCookie() {
  const token = (await cookies()).get(AUTH_CHALLENGE_COOKIE)?.value;
  const payload = deserialize<ChallengePayload>(token);

  if (!payload || payload.exp < Date.now()) {
    return null;
  }

  return payload;
}

export async function clearChallengeCookie() {
  (await cookies()).delete(AUTH_CHALLENGE_COOKIE);
}
