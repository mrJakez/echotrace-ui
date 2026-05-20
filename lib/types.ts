export type ReviewStatus = "pending_review" | "approved" | "rejected";
export type TagAssignmentSource = "manual" | "automatic";
export type TagAssignmentState = "assigned" | "very_likely" | "proposal";

export type TagItem = {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  assignmentCount: number;
  children: TagItem[];
};

export type RecordingTagAssignment = {
  id: string;
  tagId: string;
  tagName: string;
  tagParentId: string | null;
  source: TagAssignmentSource;
  state: TagAssignmentState;
  createdAt: string;
};

export type RecordingListItem = {
  id: string;
  source: string | null;
  filename: string;
  assemblyAiTranscriptId?: string | null;
  customTitle?: string | null;
  titleProposal?: string | null;
  title: string;
  summary: string | null;
  startedAt: string;
  endedAt: string;
  category: string | null;
  categoryStatus?: string | null;
  locationStatus?: string | null;
  reviewStatus: ReviewStatus;
  transcriptLanguage: string | null;
  status: string | null;
  titleProposalStatus?: string | null;
  transcriptionStatus: string | null;
  calendarMatchStatus: string | null;
  audioUrl: string | null;
  tags?: RecordingTagAssignment[];
};

export type SearchTagResult = {
  id: string;
  name: string;
  pathLabel: string;
  recordingCount: number;
};

export type GlobalSearchResult = {
  recordings: RecordingListItem[];
  tags: SearchTagResult[];
};

export type RecordingSentence = {
  id: string;
  position: number;
  startMs: number;
  endMs: number;
  speaker: string | null;
  text: string;
};

export type RecordingLog = {
  id: string;
  logger: string;
  level: string | null;
  message: string;
  createdAt: string;
};

export type PromptItem = {
  id: string;
  title: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
};

export type RecordingDetail = RecordingListItem & {
  audioPath: string | null;
  transcript: string | null;
  durationMs: number | null;
  locationName: string | null;
  selectedCalendarEventId: string | null;
  logs: RecordingLog[];
  sentences: RecordingSentence[];
  tags: RecordingTagAssignment[];
};
