import { NextResponse } from "next/server";
import { z } from "zod";

import { deletePrompt, updatePrompt } from "@/db/queries";
import { requireApiSession } from "@/lib/auth/guards";
import { logServerEvent } from "@/lib/server-log";

const promptSchema = z.object({
  title: z.string().trim().min(1).max(160),
  prompt: z.string().trim().min(1).max(20000)
});

type PromptRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: PromptRouteContext) {
  const auth = await requireApiSession();
  if (auth.response) {
    logServerEvent("api:/api/prompts/[id]", "unauthorized");
    return auth.response;
  }

  const { id } = await context.params;
  const parsed = promptSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const items = await updatePrompt({
    id,
    title: parsed.data.title,
    prompt: parsed.data.prompt
  });

  logServerEvent("api:/api/prompts/[id]", "updated", { id, title: parsed.data.title, user: auth.session.email });
  return NextResponse.json(items);
}

export async function DELETE(_request: Request, context: PromptRouteContext) {
  const auth = await requireApiSession();
  if (auth.response) {
    logServerEvent("api:/api/prompts/[id]", "unauthorized");
    return auth.response;
  }

  const { id } = await context.params;
  const items = await deletePrompt(id);
  logServerEvent("api:/api/prompts/[id]", "deleted", { id, user: auth.session.email });
  return NextResponse.json(items);
}
