import { NextResponse } from "next/server";
import { z } from "zod";

import { createPrompt, listPrompts } from "@/db/queries";
import { requireApiSession } from "@/lib/auth/guards";
import { logServerEvent } from "@/lib/server-log";

const promptSchema = z.object({
  title: z.string().trim().min(1).max(160),
  prompt: z.string().trim().min(1).max(20000)
});

export async function GET() {
  const auth = await requireApiSession();
  if (auth.response) {
    logServerEvent("api:/api/prompts", "unauthorized");
    return auth.response;
  }

  const items = await listPrompts();
  logServerEvent("api:/api/prompts", "list", { count: items.length, user: auth.session.email });
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const auth = await requireApiSession();
  if (auth.response) {
    logServerEvent("api:/api/prompts", "unauthorized");
    return auth.response;
  }

  const parsed = promptSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const items = await createPrompt(parsed.data);
  logServerEvent("api:/api/prompts", "created", { title: parsed.data.title, user: auth.session.email });
  return NextResponse.json(items);
}
