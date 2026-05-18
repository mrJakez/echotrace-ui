import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getRecordingDetail,
  updateRecordingPipelineStatuses,
  updateRecordingReviewStatus,
  updateRecordingTitle
} from "@/db/queries";
import { requireApiSession } from "@/lib/auth/guards";
import { logServerEvent } from "@/lib/server-log";
import type { ReviewStatus } from "@/lib/types";

const updateTitleSchema = z.object({
  title: z.union([z.string().max(255), z.null()]).transform((value) => {
    if (value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  })
});

const updateReviewSchema = z.object({
  reviewStatus: z.enum(["pending_review", "approved", "rejected"])
});

const updatePipelineStatusesSchema = z
  .object({
    categoryStatus: z.string().trim().min(1).max(255).optional(),
    locationStatus: z.string().trim().min(1).max(255).optional(),
    titleProposalStatus: z.string().trim().min(1).max(255).optional(),
    transcriptionStatus: z.string().trim().min(1).max(255).optional(),
    calendarMatchStatus: z.string().trim().min(1).max(255).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one pipeline status must be provided"
  });

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession();
  if (auth.response) {
    logServerEvent("api:/api/recordings/[id]", "unauthorized");
    return auth.response;
  }

  const { id } = await context.params;
  const detail = await getRecordingDetail(id);

  if (!detail) {
    logServerEvent("api:/api/recordings/[id]", "not-found", { id, user: auth.session.email });
    return NextResponse.json({ message: "Recording not found" }, { status: 404 });
  }

  logServerEvent("api:/api/recordings/[id]", "get", { id, user: auth.session.email });

  return NextResponse.json(detail);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession();
  if (auth.response) {
    logServerEvent("api:/api/recordings/[id]", "unauthorized");
    return auth.response;
  }

  const { id } = await context.params;
  const payload = await request.json();

  const titleParsed = updateTitleSchema.safeParse(payload);
  if (titleParsed.success) {
    const detail = await updateRecordingTitle(id, titleParsed.data.title);
    if (!detail) {
      logServerEvent("api:/api/recordings/[id]", "title-not-found", { id, user: auth.session.email });
      return NextResponse.json({ message: "Recording not found" }, { status: 404 });
    }

    logServerEvent("api:/api/recordings/[id]", "title-updated", {
      id,
      title: titleParsed.data.title,
      user: auth.session.email
    });
    return NextResponse.json(detail);
  }

  const reviewParsed = updateReviewSchema.safeParse(payload);
  if (reviewParsed.success) {
    const detail = await updateRecordingReviewStatus(id, reviewParsed.data.reviewStatus as ReviewStatus);
    if (!detail) {
      logServerEvent("api:/api/recordings/[id]", "review-not-found", { id, user: auth.session.email });
      return NextResponse.json({ message: "Recording not found" }, { status: 404 });
    }

    logServerEvent("api:/api/recordings/[id]", "review-updated", {
      id,
      reviewStatus: reviewParsed.data.reviewStatus,
      user: auth.session.email
    });
    return NextResponse.json(detail);
  }

  const pipelineParsed = updatePipelineStatusesSchema.safeParse(payload);
  if (!pipelineParsed.success) {
    logServerEvent("api:/api/recordings/[id]", "invalid-payload", { id, user: auth.session.email });
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const detail = await updateRecordingPipelineStatuses(id, pipelineParsed.data);
  if (!detail) {
    logServerEvent("api:/api/recordings/[id]", "pipeline-not-found", { id, user: auth.session.email });
    return NextResponse.json({ message: "Recording not found" }, { status: 404 });
  }

  logServerEvent("api:/api/recordings/[id]", "pipeline-updated", {
    id,
    updates: pipelineParsed.data,
    user: auth.session.email
  });
  return NextResponse.json(detail);
}
