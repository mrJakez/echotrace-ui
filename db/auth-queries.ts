import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { authPasskeys, authUsers } from "@/db/schema";

export async function findUserByEmail(email: string) {
  const db = getDb();
  if (!db) {
    throw new Error("Database is required for passkey auth");
  }

  const [user] = await db.select().from(authUsers).where(eq(authUsers.email, email)).limit(1);
  return user ?? null;
}

export async function findUserById(id: string) {
  const db = getDb();
  if (!db) {
    throw new Error("Database is required for passkey auth");
  }

  const [user] = await db.select().from(authUsers).where(eq(authUsers.id, id)).limit(1);
  return user ?? null;
}

export async function createUser(email: string, displayName: string) {
  const db = getDb();
  if (!db) {
    throw new Error("Database is required for passkey auth");
  }

  const [created] = await db.insert(authUsers).values({ displayName, email }).returning();
  return created;
}

export async function listPasskeysForUser(userId: string) {
  const db = getDb();
  if (!db) {
    throw new Error("Database is required for passkey auth");
  }

  return db.select().from(authPasskeys).where(eq(authPasskeys.userId, userId));
}

export async function findPasskeyByCredentialId(credentialId: string) {
  const db = getDb();
  if (!db) {
    throw new Error("Database is required for passkey auth");
  }

  const [passkey] = await db
    .select()
    .from(authPasskeys)
    .where(eq(authPasskeys.credentialId, credentialId))
    .limit(1);

  return passkey ?? null;
}

export async function createPasskey(input: {
  backedUp: boolean;
  counter: number;
  credentialId: string;
  deviceType: string;
  publicKey: string;
  transports: string | null;
  userId: string;
}) {
  const db = getDb();
  if (!db) {
    throw new Error("Database is required for passkey auth");
  }

  const [created] = await db.insert(authPasskeys).values(input).returning();
  return created;
}

export async function updatePasskeyCounter(credentialId: string, counter: number) {
  const db = getDb();
  if (!db) {
    throw new Error("Database is required for passkey auth");
  }

  await db.update(authPasskeys).set({ counter }).where(eq(authPasskeys.credentialId, credentialId));
}
