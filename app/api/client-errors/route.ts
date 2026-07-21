import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiSession } from "@/lib/auth/guards";
import { logServerError } from "@/lib/server-log";

const clientErrorSchema = z.object({
  scope: z.string().trim().min(1).max(80),
  stage: z.string().trim().min(1).max(80),
  name: z.string().max(120).optional(),
  message: z.string().max(4000),
  stack: z.string().max(12000).optional(),
  context: z.record(z.unknown()).optional()
});

export async function POST(request: Request) {
  const auth = await requireApiSession();
  if (auth.response) {
    return auth.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    logServerError("api:/api/client-errors", "invalid-json", {
      message: error instanceof Error ? error.message : String(error),
      user: auth.session.email
    });
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = clientErrorSchema.safeParse(body);
  if (!parsed.success) {
    logServerError("api:/api/client-errors", "invalid-payload", {
      issues: parsed.error.issues,
      user: auth.session.email
    });
    return NextResponse.json({ message: "Invalid client error payload" }, { status: 400 });
  }

  logServerError(`client:${parsed.data.scope}`, parsed.data.stage, {
    name: parsed.data.name,
    message: parsed.data.message,
    stack: parsed.data.stack,
    context: parsed.data.context,
    user: auth.session.email
  });

  return NextResponse.json({ ok: true });
}
