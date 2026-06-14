import { and, asc, count, desc, eq, gte, inArray, lt, notInArray, or, sql } from "drizzle-orm";

import { env } from "@/lib/env";
import type {
  GlobalSearchResult,
  PromptItem,
  ProcessingStatus,
  RecordingCategory,
  RecordingDetail,
  RecordingListItem,
  RecordingLog,
  RecordingSentence,
  RecordingTagAssignment,
  ReviewStatus,
  TagAssignmentSource,
  TagAssignmentState,
  TagItem
} from "@/lib/types";
import { getDb } from "@/db/client";
import { getMockRecordingDetail, listMockPrompts, listMockTags, MOCK_RECORDINGS } from "@/db/mock-data";
import { prompts, recordingLogs, recordingLogsLegacy, recordings, recordingSentences, recordingTags, tags } from "@/db/schema";

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
    notes: recording.notes,
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
    tagProposalStatus: recording.tagProposalStatus,
    transcriptionStatus: recording.transcriptionStatus,
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

function mapPrompt(prompt: typeof prompts.$inferSelect): PromptItem {
  return {
    id: prompt.id,
    title: prompt.title,
    prompt: prompt.prompt,
    createdAt: prompt.createdAt.toISOString(),
    updatedAt: prompt.updatedAt.toISOString()
  };
}

function buildTagTree(items: Array<Omit<TagItem, "children">>): TagItem[] {
  const nodes = items.map((item) => ({ ...item, children: [] as TagItem[] }));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const roots: TagItem[] = [];

  for (const node of nodes) {
    if (node.parentId) {
      const parent = byId.get(node.parentId);
      if (parent) {
        parent.children.push(node);
        continue;
      }
    }

    roots.push(node);
  }

  const sortNodes = (entries: TagItem[]) => {
    entries.sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
    for (const entry of entries) {
      sortNodes(entry.children);
    }
  };

  sortNodes(roots);
  return roots;
}

function flattenTagTree(items: TagItem[], labels: string[] = []): Array<TagItem & { pathLabel: string }> {
  return items.flatMap((item) => {
    const pathLabel = [...labels, item.name].join(" / ");
    return [{ ...item, pathLabel }, ...flattenTagTree(item.children, [...labels, item.name])];
  });
}

function mapRecordingTag(row: {
  assignmentId: string;
  assignmentSource: string;
  assignmentState: string;
  createdAt: Date;
  tagId: string;
  tagName: string;
  tagParentId: string | null;
}): RecordingTagAssignment {
  return {
    id: row.assignmentId,
    tagId: row.tagId,
    tagName: row.tagName,
    tagParentId: row.tagParentId,
    source: row.assignmentSource as TagAssignmentSource,
    state: row.assignmentState as TagAssignmentState,
    createdAt: row.createdAt.toISOString()
  };
}

async function listRecordingTagsByRecordingIds(recordingIds: string[]) {
  const db = getDb();
  const byRecordingId = new Map<string, RecordingTagAssignment[]>();

  if (!db || env.useMockData || recordingIds.length === 0) {
    return byRecordingId;
  }

  const rows = await db
    .select({
      assignmentId: recordingTags.id,
      assignmentSource: recordingTags.assignmentSource,
      assignmentState: recordingTags.assignmentState,
      createdAt: recordingTags.createdAt,
      recordingId: recordingTags.recordingId,
      tagId: tags.id,
      tagName: tags.name,
      tagParentId: tags.parentId
    })
    .from(recordingTags)
    .innerJoin(tags, eq(recordingTags.tagId, tags.id))
    .where(inArray(recordingTags.recordingId, recordingIds))
    .orderBy(asc(tags.name));

  for (const row of rows) {
    const current = byRecordingId.get(row.recordingId) ?? [];
    current.push(mapRecordingTag(row));
    byRecordingId.set(row.recordingId, current);
  }

  return byRecordingId;
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
      }).map((recording) => ({
        ...recording,
        tags: getMockRecordingDetail(recording.id)?.tags ?? []
      })),
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

  const recordingTagsById = await listRecordingTagsByRecordingIds(rows.map((row) => row.id));

  return rows.map((row) => ({
    ...mapRecording(row),
    tags: recordingTagsById.get(row.id) ?? []
  }));
}

export async function searchRecordings(
  query: string,
  options?: {
    categoryFilter?: "all" | "work" | "private" | "unknown";
    includeRejected?: boolean;
    limit?: number;
    reviewFilter?: "all" | "pending_review" | "approved" | "rejected";
  }
) {
  const db = getDb();
  const normalizedQuery = query.trim().toLowerCase();
  const limit = options?.limit ?? 20;

  if (!normalizedQuery) {
    return [] as RecordingListItem[];
  }

  if (!db || env.useMockData) {
    return applyReviewFilter(MOCK_RECORDINGS, options)
      .map((recording) => {
        const detail = getMockRecordingDetail(recording.id);
        return {
          ...recording,
          tags: detail?.tags ?? [],
          __searchText: [
          recording.title,
          recording.customTitle ?? "",
          recording.titleProposal ?? "",
          recording.summary ?? "",
          recording.source ?? "",
          recording.filename,
          detail?.transcript ?? "",
          ...(detail?.sentences.map((sentence) => sentence.text) ?? []),
          ...(detail?.tags.map((tag) => tag.tagName) ?? [])
          ].join(" ").toLowerCase()
        };
      })
      .filter((recording) => recording.__searchText.includes(normalizedQuery))
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
      .slice(0, limit)
      .map(({ __searchText, ...recording }) => recording);
  }

  const filters = [
    sql`(
      lower(concat_ws(' ',
        coalesce(${recordings.title}, ''),
        coalesce(${recordings.titleProposal}, ''),
        coalesce(${recordings.transcriptSummary}, ''),
        coalesce(${recordings.source}, ''),
        ${recordings.filename}
      )) like ${`%${normalizedQuery}%`}
      or exists (
        select 1 from ${recordingSentences}
        where ${recordingSentences.recordingId} = ${recordings.id}
          and lower(${recordingSentences.text}) like ${`%${normalizedQuery}%`}
      )
      or exists (
        select 1 from ${recordingTags}
        inner join ${tags} on ${recordingTags.tagId} = ${tags.id}
        where ${recordingTags.recordingId} = ${recordings.id}
          and lower(${tags.name}) like ${`%${normalizedQuery}%`}
      )
    )`
  ];

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
    .orderBy(desc(recordings.startedAt))
    .limit(limit);

  const recordingTagsById = await listRecordingTagsByRecordingIds(rows.map((row) => row.id));

  return rows.map((row) => ({
    ...mapRecording(row),
    tags: recordingTagsById.get(row.id) ?? []
  }));
}

export async function searchRecordingsByTag(
  tagId: string,
  options?: {
    categoryFilter?: "all" | "work" | "private" | "unknown";
    includeRejected?: boolean;
    limit?: number;
    reviewFilter?: "all" | "pending_review" | "approved" | "rejected";
  }
) {
  const db = getDb();
  const limit = options?.limit ?? 50;

  if (!db || env.useMockData) {
    return applyReviewFilter(
      MOCK_RECORDINGS.map((recording) => {
        const detail = getMockRecordingDetail(recording.id);
        return {
          ...recording,
          tags: detail?.tags ?? []
        };
      }).filter((recording) => recording.tags.some((tag) => tag.tagId === tagId)),
      options
    ).slice(0, limit);
  }

  const filters = [
    sql`exists (
      select 1 from ${recordingTags}
      where ${recordingTags.recordingId} = ${recordings.id}
        and ${recordingTags.tagId} = ${tagId}
    )`
  ];

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
    .orderBy(desc(recordings.startedAt))
    .limit(limit);

  const recordingTagsById = await listRecordingTagsByRecordingIds(rows.map((row) => row.id));

  return rows.map((row) => ({
    ...mapRecording(row),
    tags: recordingTagsById.get(row.id) ?? []
  }));
}

export async function searchGlobal(
  query: string,
  options?: {
    categoryFilter?: "all" | "work" | "private" | "unknown";
    includeRejected?: boolean;
    limit?: number;
    reviewFilter?: "all" | "pending_review" | "approved" | "rejected";
  }
): Promise<GlobalSearchResult> {
  const normalizedQuery = query.trim().toLowerCase();
  const limit = options?.limit ?? 20;

  if (!normalizedQuery) {
    return { recordings: [], tags: [] };
  }

  const allTags = flattenTagTree(await listTags());
  const matchingTags = allTags
    .filter(
      (tag) =>
        tag.name.toLowerCase().includes(normalizedQuery) ||
        tag.pathLabel.toLowerCase().includes(normalizedQuery) ||
        (tag.description ?? "").toLowerCase().includes(normalizedQuery)
    )
    .slice(0, 6);
  const tagRecordingCounts = new Map<string, number>();

  await Promise.all(
    matchingTags.map(async (tag) => {
      const recordings = await searchRecordingsByTag(tag.id, { ...options, limit: 100 });
      tagRecordingCounts.set(tag.id, recordings.length);
    })
  );

  return {
    recordings: await searchRecordings(query, options),
    tags: matchingTags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      pathLabel: tag.pathLabel,
      recordingCount: tagRecordingCounts.get(tag.id) ?? 0
    }))
  };
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

  const tagRows = await db
    .select({
      assignmentId: recordingTags.id,
      assignmentSource: recordingTags.assignmentSource,
      assignmentState: recordingTags.assignmentState,
      createdAt: recordingTags.createdAt,
      tagId: tags.id,
      tagName: tags.name,
      tagParentId: tags.parentId
    })
    .from(recordingTags)
    .innerJoin(tags, eq(recordingTags.tagId, tags.id))
    .where(eq(recordingTags.recordingId, id))
    .orderBy(asc(tags.name));

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
    sentences: sentences.map(mapSentence),
    tags: tagRows.map(mapRecordingTag)
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

export async function updateRecordingNotes(id: string, notes: string | null): Promise<RecordingDetail | null> {
  const db = getDb();

  if (!db || env.useMockData) {
    const mock = getMockRecordingDetail(id);
    if (!mock) {
      return null;
    }

    mock.notes = notes;
    return mock;
  }

  await db.update(recordings).set({ notes }).where(eq(recordings.id, id));
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

export async function updateRecordingCategory(
  id: string,
  category: RecordingCategory
): Promise<RecordingDetail | null> {
  const db = getDb();

  if (!db || env.useMockData) {
    const mock = getMockRecordingDetail(id);
    if (!mock) {
      return null;
    }

    mock.category = category;
    return mock;
  }

  await db.update(recordings).set({ category }).where(eq(recordings.id, id));
  return getRecordingDetail(id);
}

export async function updateRecordingPipelineStatuses(
  id: string,
  updates: Partial<{
    categoryStatus: ProcessingStatus | null;
    locationStatus: ProcessingStatus | null;
    tagProposalStatus: ProcessingStatus | null;
    titleProposalStatus: ProcessingStatus | null;
    transcriptionStatus: ProcessingStatus | null;
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
    if (Object.hasOwn(updates, "tagProposalStatus")) {
      mock.tagProposalStatus = updates.tagProposalStatus ?? null;
    }
    if (Object.hasOwn(updates, "titleProposalStatus")) {
      mock.titleProposalStatus = updates.titleProposalStatus ?? null;
    }
    if (Object.hasOwn(updates, "transcriptionStatus")) {
      mock.transcriptionStatus = updates.transcriptionStatus ?? null;
    }

    return mock;
  }

  const statusUpdates: Partial<typeof recordings.$inferInsert> = {};
  if (Object.hasOwn(updates, "categoryStatus")) {
    statusUpdates.categoryStatus = updates.categoryStatus ?? null;
  }
  if (Object.hasOwn(updates, "locationStatus")) {
    statusUpdates.locationStatus = updates.locationStatus ?? null;
  }
  if (Object.hasOwn(updates, "tagProposalStatus")) {
    statusUpdates.tagProposalStatus = updates.tagProposalStatus ?? null;
  }
  if (Object.hasOwn(updates, "titleProposalStatus")) {
    statusUpdates.titleProposalStatus = updates.titleProposalStatus ?? null;
  }
  if (Object.hasOwn(updates, "transcriptionStatus")) {
    statusUpdates.transcriptionStatus = updates.transcriptionStatus ?? null;
  }

  await db
    .update(recordings)
    .set(statusUpdates)
    .where(eq(recordings.id, id));

  return getRecordingDetail(id);
}

export async function renameRecordingSpeaker(
  recordingId: string,
  oldSpeaker: string | null,
  newSpeaker: string
): Promise<RecordingDetail | null> {
  const db = getDb();

  if (!db || env.useMockData) {
    const mock = getMockRecordingDetail(recordingId);
    if (!mock) {
      return null;
    }

    mock.sentences = mock.sentences.map((sentence) =>
      (sentence.speaker ?? null) === oldSpeaker ? { ...sentence, speaker: newSpeaker } : sentence
    );
    return mock;
  }

  await db
    .update(recordingSentences)
    .set({ speaker: newSpeaker })
    .where(
      and(
        eq(recordingSentences.recordingId, recordingId),
        oldSpeaker === null ? sql`${recordingSentences.speaker} is null` : eq(recordingSentences.speaker, oldSpeaker)
      )
    );

  return getRecordingDetail(recordingId);
}

export async function listTags(): Promise<TagItem[]> {
  const db = getDb();

  if (!db || env.useMockData) {
    return listMockTags();
  }

  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      description: tags.description,
      parentId: tags.parentId,
      sortOrder: tags.sortOrder,
      assignmentCount: count(recordingTags.id)
    })
    .from(tags)
    .leftJoin(recordingTags, eq(recordingTags.tagId, tags.id))
    .groupBy(tags.id, tags.name, tags.description, tags.parentId, tags.sortOrder)
    .orderBy(asc(tags.parentId), asc(tags.sortOrder), asc(tags.name));

  return buildTagTree(
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      parentId: row.parentId,
      sortOrder: row.sortOrder,
      assignmentCount: Number(row.assignmentCount)
    }))
  );
}

export async function listPrompts(): Promise<PromptItem[]> {
  const db = getDb();

  if (!db || env.useMockData) {
    return listMockPrompts();
  }

  const rows = await db.select().from(prompts).orderBy(asc(prompts.title));
  return rows.map(mapPrompt);
}

export async function getPrompt(id: string): Promise<PromptItem | null> {
  const db = getDb();

  if (!db || env.useMockData) {
    return listMockPrompts().find((prompt) => prompt.id === id) ?? null;
  }

  const [row] = await db.select().from(prompts).where(eq(prompts.id, id)).limit(1);
  return row ? mapPrompt(row) : null;
}

export async function createPrompt(input: { title: string; prompt: string }): Promise<PromptItem[]> {
  const db = getDb();

  if (!db || env.useMockData) {
    return listMockPrompts();
  }

  await db.insert(prompts).values({
    title: input.title,
    prompt: input.prompt
  });

  return listPrompts();
}

export async function updatePrompt(input: { id: string; title: string; prompt: string }): Promise<PromptItem[]> {
  const db = getDb();

  if (!db || env.useMockData) {
    return listMockPrompts();
  }

  await db
    .update(prompts)
    .set({
      title: input.title,
      prompt: input.prompt,
      updatedAt: new Date()
    })
    .where(eq(prompts.id, input.id));

  return listPrompts();
}

export async function deletePrompt(id: string): Promise<PromptItem[]> {
  const db = getDb();

  if (!db || env.useMockData) {
    return listMockPrompts();
  }

  await db.delete(prompts).where(eq(prompts.id, id));
  return listPrompts();
}

async function getNextTagSortOrder(parentId: string | null) {
  const db = getDb();
  if (!db || env.useMockData) {
    return 0;
  }

  const [row] = await db
    .select({ maxSortOrder: sql<number>`coalesce(max(${tags.sortOrder}), -1)` })
    .from(tags)
    .where(parentId === null ? sql`${tags.parentId} is null` : eq(tags.parentId, parentId));

  return Number(row?.maxSortOrder ?? -1) + 1;
}

export async function createTag(input: {
  name: string;
  description: string | null;
  parentId: string | null;
}): Promise<TagItem[]> {
  const db = getDb();

  if (!db || env.useMockData) {
    return listMockTags();
  }

  const sortOrder = await getNextTagSortOrder(input.parentId);
  await db.insert(tags).values({
    name: input.name,
    description: input.description,
    parentId: input.parentId,
    sortOrder
  });

  return listTags();
}

export async function updateTag(input: {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
}): Promise<TagItem[]> {
  const db = getDb();

  if (!db || env.useMockData) {
    return listMockTags();
  }

  const [existing] = await db.select().from(tags).where(eq(tags.id, input.id)).limit(1);
  if (!existing) {
    return listTags();
  }

  const parentChanged = (existing.parentId ?? null) !== input.parentId;
  const nextSortOrder = parentChanged ? await getNextTagSortOrder(input.parentId) : existing.sortOrder;

  await db
    .update(tags)
    .set({
      name: input.name,
      description: input.description,
      parentId: input.parentId,
      sortOrder: nextSortOrder,
      updatedAt: new Date()
    })
    .where(eq(tags.id, input.id));

  return listTags();
}

export async function deleteTag(id: string): Promise<TagItem[]> {
  const db = getDb();

  if (!db || env.useMockData) {
    return listMockTags();
  }

  const [existing] = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
  if (!existing) {
    return listTags();
  }

  await db
    .update(tags)
    .set({
      parentId: existing.parentId,
      updatedAt: new Date()
    })
    .where(eq(tags.parentId, id));

  await db.delete(tags).where(eq(tags.id, id));
  return listTags();
}

export async function reorderTag(id: string, direction: "up" | "down"): Promise<TagItem[]> {
  const db = getDb();

  if (!db || env.useMockData) {
    return listMockTags();
  }

  const [current] = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
  if (!current) {
    return listTags();
  }

  const siblings = await db
    .select()
    .from(tags)
    .where(current.parentId === null ? sql`${tags.parentId} is null` : eq(tags.parentId, current.parentId))
    .orderBy(asc(tags.sortOrder), asc(tags.name));

  const index = siblings.findIndex((item) => item.id === id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapIndex < 0 || swapIndex >= siblings.length) {
    return listTags();
  }

  const target = siblings[swapIndex];

  await db.update(tags).set({ sortOrder: target.sortOrder, updatedAt: new Date() }).where(eq(tags.id, current.id));
  await db.update(tags).set({ sortOrder: current.sortOrder, updatedAt: new Date() }).where(eq(tags.id, target.id));

  return listTags();
}

export async function createManualRecordingTag(recordingId: string, tagId: string): Promise<RecordingDetail | null> {
  const db = getDb();

  if (!db || env.useMockData) {
    return getRecordingDetail(recordingId);
  }

  const [existing] = await db
    .select({ id: recordingTags.id })
    .from(recordingTags)
    .where(and(eq(recordingTags.recordingId, recordingId), eq(recordingTags.tagId, tagId)))
    .limit(1);

  if (existing) {
    await db
      .update(recordingTags)
      .set({
        assignmentSource: "manual",
        assignmentState: "assigned",
        updatedAt: new Date()
      })
      .where(eq(recordingTags.id, existing.id));
  } else {
    await db.insert(recordingTags).values({
      recordingId,
      tagId,
      assignmentSource: "manual",
      assignmentState: "assigned"
    });
  }

  return getRecordingDetail(recordingId);
}

export async function createAutomaticRecordingTags(input: {
  eventId?: string;
  recordingId?: string;
  tagIds: string[];
  assignmentState: Extract<TagAssignmentState, "assigned" | "proposal" | "very_likely">;
}): Promise<RecordingDetail | null> {
  const db = getDb();
  const recordingId = await resolveRecordingId(input.recordingId, input.eventId);

  if (!recordingId) {
    return null;
  }

  if (!db || env.useMockData) {
    return getRecordingDetail(recordingId);
  }

  for (const tagId of input.tagIds) {
    const [existing] = await db
      .select({ id: recordingTags.id })
      .from(recordingTags)
      .where(and(eq(recordingTags.recordingId, recordingId), eq(recordingTags.tagId, tagId)))
      .limit(1);

    if (existing) {
      await db
        .update(recordingTags)
        .set({
          assignmentSource: "automatic",
          assignmentState: input.assignmentState,
          updatedAt: new Date()
        })
        .where(eq(recordingTags.id, existing.id));
    } else {
      await db.insert(recordingTags).values({
        recordingId,
        tagId,
        assignmentSource: "automatic",
        assignmentState: input.assignmentState
      });
    }
  }

  return getRecordingDetail(recordingId);
}

async function resolveRecordingId(recordingId?: string, eventId?: string) {
  if (recordingId) {
    return recordingId;
  }

  if (!eventId) {
    return null;
  }

  if (env.useMockData) {
    return getMockRecordingDetail(eventId) ? eventId : null;
  }

  const db = getDb();
  if (!db) {
    return null;
  }

  const [row] = await db
    .select({ id: recordings.id })
    .from(recordings)
    .where(or(eq(recordings.id, eventId), eq(recordings.selectedCalendarEventId, eventId)))
    .limit(1);

  return row?.id ?? null;
}

export async function acceptRecordingTagAssignment(
  recordingId: string,
  assignmentId: string
): Promise<RecordingDetail | null> {
  const db = getDb();

  if (!db || env.useMockData) {
    return getRecordingDetail(recordingId);
  }

  await db
    .update(recordingTags)
    .set({
      assignmentState: "assigned",
      updatedAt: new Date()
    })
    .where(and(eq(recordingTags.id, assignmentId), eq(recordingTags.recordingId, recordingId)));

  return getRecordingDetail(recordingId);
}

export async function removeRecordingTagAssignment(
  recordingId: string,
  assignmentId: string
): Promise<RecordingDetail | null> {
  const db = getDb();

  if (!db || env.useMockData) {
    return getRecordingDetail(recordingId);
  }

  await db
    .delete(recordingTags)
    .where(and(eq(recordingTags.id, assignmentId), eq(recordingTags.recordingId, recordingId)));

  return getRecordingDetail(recordingId);
}
