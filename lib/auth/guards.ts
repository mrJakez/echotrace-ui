import { NextResponse } from "next/server";

import { readSession } from "@/lib/auth/session";

export async function requireApiSession() {
  const session = await readSession();
  if (!session) {
    return {
      response: NextResponse.json({ message: "Unauthorized" }, { status: 401 }),
      session: null
    };
  }

  return { response: null, session };
}
