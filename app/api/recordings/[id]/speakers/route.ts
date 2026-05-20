import { NextResponse } from "next/server";
import { z } from "zod";

import { renameRecordingSpeaker } from "@/db/queries";
import { requireApiSession } from "@/lib/auth/guards";
import { logServerEvent } from "@/lib/server-log";

const renameSpeakerSchema = z.object({
  oldSpeaker: z.union([z.string().trim().min(1).max(120), z.null()]),
  newSpeaker: z.string().trim().min(1).max(120)
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession();
  if (auth.response) {
    logServerEvent("api:/api/recordings/[id]/speakers", "unauthorized");
    return auth.response;
  }

  const { id } = await context.params;
  const parsed = renameSpeakerSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const detail = await renameRecordingSpeaker(id, parsed.data.oldSpeaker, parsed.data.newSpeaker);
  if (!detail) {
    logServerEvent("api:/api/recordings/[id]/speakers", "not-found", { id, user: auth.session.email });
    return NextResponse.json({ message: "Recording not found" }, { status: 404 });
  }

  logServerEvent("api:/api/recordings/[id]/speakers", "renamed", {
    id,
    newSpeaker: parsed.data.newSpeaker,
    oldSpeaker: parsed.data.oldSpeaker ?? "-",
    user: auth.session.email
  });

  return NextResponse.json(detail);
}
