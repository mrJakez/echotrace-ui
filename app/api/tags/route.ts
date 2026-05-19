import { NextResponse } from "next/server";
import { z } from "zod";

import { createTag, listTags } from "@/db/queries";
import { requireApiSession } from "@/lib/auth/guards";
import { logServerEvent } from "@/lib/server-log";

const createTagSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.union([z.string().trim().max(1000), z.null()]).optional(),
  parentId: z.union([z.string().uuid(), z.null()]).optional()
});

export async function GET() {
  const auth = await requireApiSession();
  if (auth.response) {
    logServerEvent("api:/api/tags", "unauthorized");
    return auth.response;
  }

  const items = await listTags();
  logServerEvent("api:/api/tags", "list", { user: auth.session.email, roots: items.length });
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const auth = await requireApiSession();
  if (auth.response) {
    logServerEvent("api:/api/tags", "unauthorized");
    return auth.response;
  }

  const parsed = createTagSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const items = await createTag({
    name: parsed.data.name,
    description: parsed.data.description?.trim() || null,
    parentId: parsed.data.parentId ?? null
  });

  logServerEvent("api:/api/tags", "created", {
    name: parsed.data.name,
    description: parsed.data.description?.trim() || null,
    parentId: parsed.data.parentId ?? null,
    user: auth.session.email
  });

  return NextResponse.json(items);
}
