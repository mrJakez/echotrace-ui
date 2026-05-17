export type ReviewStatus = "pending_review" | "approved" | "rejected";

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

export type RecordingDetail = RecordingListItem & {
  audioPath: string | null;
  transcript: string | null;
  durationMs: number | null;
  locationName: string | null;
  selectedCalendarEventId: string | null;
  logs: RecordingLog[];
  sentences: RecordingSentence[];
};
