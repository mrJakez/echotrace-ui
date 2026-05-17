import { and, asc, desc, eq, gte, lt, notInArray, sql } from "drizzle-orm";

import { env } from "@/lib/env";
import type { RecordingDetail, RecordingListItem, RecordingLog, RecordingSentence, ReviewStatus } from "@/lib/types";
import { getDb } from "@/db/client";
import { getMockRecordingDetail, MOCK_RECORDINGS } from "@/db/mock-data";
import { recordingLogs, recordingLogsLegacy, recordings, recordingSentences } from "@/db/schema";

function buildTitle(recording: {
  title?: string | null;
  titleProposal?: string | null;
  filename: string;
  transcriptSummary: string | null;
}) {
  if (recording.title && recording.title.trim()) {
    return recording.title.trim();
  }

  if (recording.titleProposal && recording.titleProposal.trim()) {
    return recording.titleProposal.trim();
  }

  if (recording.transcriptSummary) {
    return recording.transcriptSummary.slice(0, 72);
  }

  return recording.filename;
}

function buildAudioUrl(filename: string) {
  if (env.audioPublicMode === "url" && env.audioPublicBaseUrl) {
    const base = env.audioPublicBaseUrl.replace(/\/$/, "");
    return `${base}/${filename}`;
  }

  if (env.audioPublicMode === "proxy") {
    return null;
  }

  return null;
}

function mapRecording(recording: typeof recordings.$inferSelect): RecordingListItem {
  return {
    id: recording.id,
    source: recording.source,
    filename: recording.filename,
    assemblyAiTranscriptId: recording.assemblyAiTranscriptId,
    customTitle: recording.title,
    titleProposal: recording.titleProposal,
    title: buildTitle(recording),
    summary: recording.transcriptSummary,
    startedAt: recording.startedAt.toISOString(),
    endedAt: recording.endedAt.toISOString(),
    category: recording.category,
    categoryStatus: recording.categoryStatus,
    locationStatus: recording.locationStatus,
    reviewStatus: recording.reviewStatus as ReviewStatus,
    transcriptLanguage: recording.transcriptLanguage,
    status: recording.status,
    titleProposalStatus: recording.titleProposalStatus,
    transcriptionStatus: recording.transcriptionStatus,
    calendarMatchStatus: recording.calendarMatchStatus,
    audioUrl:
      env.audioPublicMode === "proxy"
        ? `/api/audio/${recording.id}`
        : buildAudioUrl(recording.filename)
  };
}

function mapSentence(sentence: typeof recordingSentences.$inferSelect): RecordingSentence {
  return {
    id: sentence.id,
    position: sentence.position,
    startMs: sentence.startMs,
    endMs: sentence.endMs,
    speaker: sentence.speaker,
    text: sentence.text
  };
}

function mapLog(log: typeof recordingLogs.$inferSelect): RecordingLog {
  return {
    id: log.id,
    logger: log.logger,
    level: log.level,
    message: log.message,
    createdAt: log.createdAt.toISOString()
  };
}

function mapLegacyLog(log: typeof recordingLogsLegacy.$inferSelect): RecordingLog {
  return {
    id: log.id,
    logger: log.logger,
    level: log.level,
    message: log.logMessage,
    createdAt: log.createdAt.toISOString()
  };
}

export async function listWeekRecordings(
  weekStartIso: string,
  options?: {
    categoryFilter?: "all" | "work" | "private" | "unknown";
    includeRejected?: boolean;
    reviewFilter?: "all" | "pending_review" | "approved" | "rejected";
  }
) {
  const db = getDb();
  const weekStart = new Date(weekStartIso);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  if (!db || env.useMockData) {
    return applyReviewFilter(
      MOCK_RECORDINGS.filter((recording) => {
        const startedAt = new Date(recording.startedAt).getTime();
        return startedAt >= weekStart.getTime() && startedAt < weekEnd.getTime();
      }),
      options
    );
  }

  const filters = [gte(recordings.startedAt, weekStart), lt(recordings.startedAt, weekEnd)];

  if (options?.reviewFilter && options.reviewFilter !== "all") {
    filters.push(eq(recordings.reviewStatus, options.reviewFilter));
  } else if (!options?.includeRejected) {
    filters.push(notInArray(recordings.reviewStatus, ["rejected"]));
  }

  if (options?.categoryFilter && options.categoryFilter !== "all") {
    if (options.categoryFilter === "unknown") {
      filters.push(sql`(${recordings.category} is null or ${recordings.category} = 'unknown')`);
    } else {
      filters.push(eq(recordings.category, options.categoryFilter));
    }
  }

  const rows = await db
    .select()
    .from(recordings)
    .where(and(...filters))
    .orderBy(asc(recordings.startedAt));

  return rows.map(mapRecording);
}

function applyReviewFilter(
  recordings: RecordingListItem[],
  options?: {
    categoryFilter?: "all" | "work" | "private" | "unknown";
    includeRejected?: boolean;
    reviewFilter?: "all" | "pending_review" | "approved" | "rejected";
  }
) {
  return recordings.filter((recording) => {
    if (options?.reviewFilter && options.reviewFilter !== "all" && recording.reviewStatus !== options.reviewFilter) {
      return false;
    }

    if ((!options?.reviewFilter || options.reviewFilter === "all") && !options?.includeRejected && recording.reviewStatus === "rejected") {
      return false;
    }

    if (options?.categoryFilter && options.categoryFilter !== "all") {
      return (recording.category ?? "unknown").toLowerCase() === options.categoryFilter;
    }

    return true;
  });
}

export async function getRecordingDetail(id: string): Promise<RecordingDetail | null> {
  const db = getDb();

  if (!db || env.useMockData) {
    return getMockRecordingDetail(id);
  }

  const [recording] = await db.select().from(recordings).where(eq(recordings.id, id)).limit(1);

  if (!recording) {
    return null;
  }

  const sentences = await db
    .select()
    .from(recordingSentences)
    .where(eq(recordingSentences.recordingId, id))
    .orderBy(asc(recordingSentences.position));

  let logs: RecordingLog[] = [];
  try {
    const logRows = await db
      .select()
      .from(recordingLogs)
      .where(eq(recordingLogs.recordingId, id))
      .orderBy(desc(recordingLogs.createdAt));

    logs = logRows.map(mapLog);
  } catch {
    try {
      const legacyLogRows = await db
        .select()
        .from(recordingLogsLegacy)
        .where(eq(recordingLogsLegacy.recordingId, id))
        .orderBy(desc(recordingLogsLegacy.createdAt));

      logs = legacyLogRows.map(mapLegacyLog);
    } catch {
      logs = [];
    }
  }

  return {
    ...mapRecording(recording),
    audioPath: recording.audioPath,
    transcript: recording.transcriptSummary,
    durationMs: recording.durationMs,
    locationName: recording.locationName,
    logs,
    selectedCalendarEventId: recording.selectedCalendarEventId,
    sentences: sentences.map(mapSentence)
  };
}

export async function updateRecordingTitle(id: string, title: string | null): Promise<RecordingDetail | null> {
  const db = getDb();

  if (!db || env.useMockData) {
    const mock = getMockRecordingDetail(id);
    if (!mock) {
      return null;
    }

    mock.customTitle = title;
    mock.title = buildTitle({
      title,
      titleProposal: mock.titleProposal ?? null,
      filename: mock.filename,
      transcriptSummary: mock.summary
    });
    return mock;
  }

  await db.update(recordings).set({ title }).where(eq(recordings.id, id));
  return getRecordingDetail(id);
}

export async function updateRecordingReviewStatus(
  id: string,
  reviewStatus: ReviewStatus
): Promise<RecordingDetail | null> {
  const db = getDb();

  if (!db || env.useMockData) {
    const mock = getMockRecordingDetail(id);
    if (!mock) {
      return null;
    }

    mock.reviewStatus = reviewStatus;
    return mock;
  }

  await db.update(recordings).set({ reviewStatus }).where(eq(recordings.id, id));
  return getRecordingDetail(id);
}

export async function updateRecordingPipelineStatuses(
  id: string,
  updates: Partial<{
    categoryStatus: string | null;
    locationStatus: string | null;
    titleProposalStatus: string | null;
    transcriptionStatus: string | null;
    calendarMatchStatus: string | null;
  }>
): Promise<RecordingDetail | null> {
  const db = getDb();

  if (!db || env.useMockData) {
    const mock = getMockRecordingDetail(id);
    if (!mock) {
      return null;
    }

    if (Object.hasOwn(updates, "categoryStatus")) {
      mock.categoryStatus = updates.categoryStatus ?? null;
    }
    if (Object.hasOwn(updates, "locationStatus")) {
      mock.locationStatus = updates.locationStatus ?? null;
    }
    if (Object.hasOwn(updates, "titleProposalStatus")) {
      mock.titleProposalStatus = updates.titleProposalStatus ?? null;
    }
    if (Object.hasOwn(updates, "transcriptionStatus")) {
      mock.transcriptionStatus = updates.transcriptionStatus ?? null;
    }
    if (Object.hasOwn(updates, "calendarMatchStatus")) {
      mock.calendarMatchStatus = updates.calendarMatchStatus ?? null;
    }

    return mock;
  }

  await db
    .update(recordings)
    .set({
      categoryStatus: updates.categoryStatus,
      locationStatus: updates.locationStatus,
      titleProposalStatus: updates.titleProposalStatus,
      transcriptionStatus: updates.transcriptionStatus,
      calendarMatchStatus: updates.calendarMatchStatus
    })
    .where(eq(recordings.id, id));

  return getRecordingDetail(id);
}
