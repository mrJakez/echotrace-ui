import { NextResponse } from "next/server";
import { z } from "zod";

import { deleteTag, reorderTag, updateTag } from "@/db/queries";
import { requireApiSession } from "@/lib/auth/guards";
import { logServerEvent } from "@/lib/server-log";

const updateTagSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.union([z.string().trim().max(1000), z.null()]),
  parentId: z.union([z.string().uuid(), z.null()])
});

const reorderSchema = z.object({
  action: z.enum(["move_up", "move_down"])
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession();
  if (auth.response) {
    logServerEvent("api:/api/tags/[id]", "unauthorized");
    return auth.response;
  }

  const { id } = await context.params;
  const body = await request.json();
  const reorderParsed = reorderSchema.safeParse(body);
  if (reorderParsed.success) {
    const items = await reorderTag(id, reorderParsed.data.action === "move_up" ? "up" : "down");
    logServerEvent("api:/api/tags/[id]", reorderParsed.data.action, { id, user: auth.session.email });
    return NextResponse.json(items);
  }

  const parsed = updateTagSchema.safeParse(body);
  if (!parsed.success || parsed.data.parentId === id) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const items = await updateTag({
    id,
    name: parsed.data.name,
    description: parsed.data.description?.trim() || null,
    parentId: parsed.data.parentId
  });

  logServerEvent("api:/api/tags/[id]", "updated", {
    id,
    name: parsed.data.name,
    description: parsed.data.description?.trim() || null,
    parentId: parsed.data.parentId,
    user: auth.session.email
  });

  return NextResponse.json(items);
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession();
  if (auth.response) {
    logServerEvent("api:/api/tags/[id]", "unauthorized");
    return auth.response;
  }

  const { id } = await context.params;
  const items = await deleteTag(id);
  logServerEvent("api:/api/tags/[id]", "deleted", { id, user: auth.session.email });
  return NextResponse.json(items);
}
