import { NextResponse } from "next/server";
import { z } from "zod";

import {
  acceptRecordingTagAssignment,
  createManualRecordingTag,
  removeRecordingTagAssignment
} from "@/db/queries";
import { requireApiSession } from "@/lib/auth/guards";
import { logServerEvent } from "@/lib/server-log";

const createSchema = z.object({
  tagId: z.string().uuid()
});

const patchSchema = z.object({
  assignmentId: z.string().uuid(),
  action: z.enum(["accept", "reject"])
});

const deleteSchema = z.object({
  assignmentId: z.string().uuid()
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession();
  if (auth.response) {
    logServerEvent("api:/api/recordings/[id]/tags", "unauthorized");
    return auth.response;
  }

  const { id } = await context.params;
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const detail = await createManualRecordingTag(id, parsed.data.tagId);
  if (!detail) {
    return NextResponse.json({ message: "Recording not found" }, { status: 404 });
  }

  logServerEvent("api:/api/recordings/[id]/tags", "manual-add", {
    recordingId: id,
    tagId: parsed.data.tagId,
    user: auth.session.email
  });

  return NextResponse.json(detail);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession();
  if (auth.response) {
    logServerEvent("api:/api/recordings/[id]/tags", "unauthorized");
    return auth.response;
  }

  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const detail =
    parsed.data.action === "accept"
      ? await acceptRecordingTagAssignment(id, parsed.data.assignmentId)
      : await removeRecordingTagAssignment(id, parsed.data.assignmentId);

  if (!detail) {
    return NextResponse.json({ message: "Recording not found" }, { status: 404 });
  }

  logServerEvent("api:/api/recordings/[id]/tags", parsed.data.action, {
    assignmentId: parsed.data.assignmentId,
    recordingId: id,
    user: auth.session.email
  });

  return NextResponse.json(detail);
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession();
  if (auth.response) {
    logServerEvent("api:/api/recordings/[id]/tags", "unauthorized");
    return auth.response;
  }

  const { id } = await context.params;
  const parsed = deleteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const detail = await removeRecordingTagAssignment(id, parsed.data.assignmentId);
  if (!detail) {
    return NextResponse.json({ message: "Recording not found" }, { status: 404 });
  }

  logServerEvent("api:/api/recordings/[id]/tags", "remove", {
    assignmentId: parsed.data.assignmentId,
    recordingId: id,
    user: auth.session.email
  });

  return NextResponse.json(detail);
}
