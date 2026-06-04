import { NextResponse } from "next/server";
import { z } from "zod";

import { createAutomaticRecordingTags, createTag, listTags } from "@/db/queries";
import { requireApiSession } from "@/lib/auth/guards";
import { requireApiToken } from "@/lib/api-auth";
import { logServerEvent } from "@/lib/server-log";
import type { TagAssignmentState, TagItem } from "@/lib/types";

const createTagSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.union([z.string().trim().max(1000), z.null()]).optional(),
  parentId: z.union([z.string().uuid(), z.null()]).optional()
});

const assignTagsSchema = z
  .object({
    assignmentState: z.enum(["assigned", "proposal", "very_likely"]).optional(),
    eventId: z.string().uuid().optional(),
    recordingId: z.string().uuid().optional(),
    tagIds: z.array(z.string().uuid()).optional(),
    textIds: z.array(z.string().uuid()).optional()
  })
  .refine((value) => value.recordingId || value.eventId, {
    message: "recordingId or eventId is required"
  })
  .refine((value) => (value.tagIds?.length ?? 0) > 0 || (value.textIds?.length ?? 0) > 0, {
    message: "tagIds or textIds is required"
  });

export async function GET(request: Request) {
  const auth = await requireApiSession();
  if (auth.response) {
    const tokenAuthResponse = requireApiToken(request);
    if (tokenAuthResponse) {
      logServerEvent("api:/api/tags", "unauthorized");
      return tokenAuthResponse;
    }

    const items = await listTags();
    const flattenedTags = flattenTags(items);
    logServerEvent("api:/api/tags", "external-list", { count: flattenedTags.length });
    return NextResponse.json({
      tags: flattenedTags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        description: tag.description,
        parentId: tag.parentId,
        path: tag.path,
        pathLabel: tag.pathLabel,
        sortOrder: tag.sortOrder
      }))
    });
  }

  const items = await listTags();
  logServerEvent("api:/api/tags", "list", { user: auth.session.email, roots: items.length });
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const payload: unknown = await request.json();
  const assignmentPayload = assignTagsSchema.safeParse(payload);
  if (assignmentPayload.success) {
    const tokenAuthResponse = requireApiToken(request);
    if (tokenAuthResponse) {
      logServerEvent("api:/api/tags", "unauthorized-assign");
      return tokenAuthResponse;
    }

    const requestedTagIds = [...new Set([...(assignmentPayload.data.tagIds ?? []), ...(assignmentPayload.data.textIds ?? [])])];
    const knownTagIds = new Set(flattenTags(await listTags()).map((tag) => tag.id));
    const invalidTagIds = requestedTagIds.filter((tagId) => !knownTagIds.has(tagId));
    if (invalidTagIds.length > 0) {
      return NextResponse.json({ invalidTagIds, message: "Unknown tag IDs" }, { status: 400 });
    }

    const detail = await createAutomaticRecordingTags({
      assignmentState: (assignmentPayload.data.assignmentState ?? "very_likely") as TagAssignmentState,
      eventId: assignmentPayload.data.eventId,
      recordingId: assignmentPayload.data.recordingId,
      tagIds: requestedTagIds
    });

    if (!detail) {
      return NextResponse.json({ message: "Recording not found" }, { status: 404 });
    }

    logServerEvent("api:/api/tags", "automatic-assign", {
      assignmentState: assignmentPayload.data.assignmentState ?? "very_likely",
      eventId: assignmentPayload.data.eventId ?? null,
      recordingId: detail.id,
      tagCount: requestedTagIds.length
    });

    return NextResponse.json({
      assignedTagIds: requestedTagIds,
      recording: {
        id: detail.id,
        tags: detail.tags
      }
    });
  }

  const auth = await requireApiSession();
  if (auth.response) {
    logServerEvent("api:/api/tags", "unauthorized");
    return auth.response;
  }

  const parsed = createTagSchema.safeParse(payload);
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

function flattenTags(items: TagItem[], labels: string[] = []): Array<Omit<TagItem, "children"> & { path: string[]; pathLabel: string }> {
  return items.flatMap((item) => {
    const path = [...labels, item.name];
    const { children, ...tag } = item;
    return [{ ...tag, path, pathLabel: path.join(" / ") }, ...flattenTags(children, path)];
  });
}
