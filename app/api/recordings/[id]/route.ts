import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getRecordingDetail,
  updateRecordingPipelineStatuses,
  updateRecordingReviewStatus,
  updateRecordingTitle
} from "@/db/queries";
import { requireApiSession } from "@/lib/auth/guards";
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
    return auth.response;
  }

  const { id } = await context.params;
  const detail = await getRecordingDetail(id);

  if (!detail) {
    return NextResponse.json({ message: "Recording not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession();
  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const payload = await request.json();

  const titleParsed = updateTitleSchema.safeParse(payload);
  if (titleParsed.success) {
    const detail = await updateRecordingTitle(id, titleParsed.data.title);
    if (!detail) {
      return NextResponse.json({ message: "Recording not found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  }

  const reviewParsed = updateReviewSchema.safeParse(payload);
  if (reviewParsed.success) {
    const detail = await updateRecordingReviewStatus(id, reviewParsed.data.reviewStatus as ReviewStatus);
    if (!detail) {
      return NextResponse.json({ message: "Recording not found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  }

  const pipelineParsed = updatePipelineStatusesSchema.safeParse(payload);
  if (!pipelineParsed.success) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const detail = await updateRecordingPipelineStatuses(id, pipelineParsed.data);
  if (!detail) {
    return NextResponse.json({ message: "Recording not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
