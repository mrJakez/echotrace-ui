import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/guards";

export async function GET() {
  const auth = await requireApiSession();
  if (auth.response) {
    return auth.response;
  }

  return NextResponse.json({
    email: auth.session.email,
    userId: auth.session.userId
  });
}
