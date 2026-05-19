import type { PromptItem, RecordingDetail, RecordingListItem, RecordingTagAssignment, TagItem } from "@/lib/types";

const MOCK_TAGS_FLAT = [
  { id: "18e9108b-8d33-48a2-a5c0-4187f193e76e", name: "Work", description: "General work-related recordings.", parentId: null, sortOrder: 0, assignmentCount: 2 },
  { id: "3f10984b-1f1f-4869-aa1f-00e7a97f8612", name: "Finance", description: "Finance topics such as budgets and planning.", parentId: "18e9108b-8d33-48a2-a5c0-4187f193e76e", sortOrder: 0, assignmentCount: 1 },
  { id: "78dd469b-8f16-460a-8af7-7dfd0219021b", name: "Pricing", description: "Pricing and commercial model discussions.", parentId: "3f10984b-1f1f-4869-aa1f-00e7a97f8612", sortOrder: 0, assignmentCount: 1 },
  { id: "4d869b74-fbe5-4f68-b6eb-933f6e7c1938", name: "Personal", description: "Private and personal recordings.", parentId: null, sortOrder: 1, assignmentCount: 1 }
] as const;

const MOCK_PROMPTS: PromptItem[] = [
  {
    id: "963e718a-9601-4747-a1c6-764ad5b3123d",
    title: "Meeting Summary",
    prompt: "Summarize the selected recordings. Extract decisions, risks, and follow-ups.",
    createdAt: "2026-05-01T08:00:00.000Z",
    updatedAt: "2026-05-01T08:00:00.000Z"
  }
];

function buildMockTagTree(): TagItem[] {
  const items = MOCK_TAGS_FLAT.map((item) => ({ ...item, children: [] as TagItem[] }));
  const byId = new Map(items.map((item) => [item.id, item]));
  const roots: TagItem[] = [];

  for (const item of items) {
    if (item.parentId) {
      const parent = byId.get(item.parentId);
      if (parent) {
        parent.children.push(item);
        continue;
      }
    }

    roots.push(item);
  }

  return roots;
}

const MOCK_RECORDING_TAGS: Record<string, RecordingTagAssignment[]> = {
  "e70089fd-37ec-45e3-a4dd-23fe9fd750c0": [
    {
      id: "ca8f3a11-a59d-4643-b250-c0c7b1e4264a",
      tagId: "78dd469b-8f16-460a-8af7-7dfd0219021b",
      tagName: "Pricing",
      tagParentId: "3f10984b-1f1f-4869-aa1f-00e7a97f8612",
      source: "manual",
      state: "assigned",
      createdAt: "2026-04-30T08:37:00.000Z"
    },
    {
      id: "720d9595-d4cf-4624-ba43-9d130e7cf1a4",
      tagId: "3f10984b-1f1f-4869-aa1f-00e7a97f8612",
      tagName: "Finance",
      tagParentId: "18e9108b-8d33-48a2-a5c0-4187f193e76e",
      source: "automatic",
      state: "very_likely",
      createdAt: "2026-04-30T08:36:20.000Z"
    }
  ],
  "2b7f85c7-39ed-47db-8617-b03fbfdc1e99": [
    {
      id: "cc8a0fe2-9b9f-4c27-bfac-68bb9687fd12",
      tagId: "4d869b74-fbe5-4f68-b6eb-933f6e7c1938",
      tagName: "Personal",
      tagParentId: null,
      source: "manual",
      state: "assigned",
      createdAt: "2026-04-28T09:12:10.000Z"
    }
  ]
};

const MOCK_DETAILS: RecordingDetail[] = [
  {
    id: "e70089fd-37ec-45e3-a4dd-23fe9fd750c0",
    customTitle: null,
    titleProposal: "Pricing-Abstimmung Moovq / SaaS",
    source: "plaud",
    filename: "e70089fd-37ec-45e3-a4dd-23fe9fd750c0.mp3",
    assemblyAiTranscriptId: "25a4aa4b-7116-484d-be30-5dacd0bf52e0",
    title: "Pricing-Abstimmung Moovq / SaaS",
    summary:
      "Kurzes Abstimmungsgespraech zur Preislogik zwischen Tenant-Setup, Betriebskosten und SaaS-Overhead.",
    startedAt: "2026-04-30T08:28:16.307Z",
    endedAt: "2026-04-30T08:33:52.307Z",
    category: "work",
    categoryStatus: "done",
    locationStatus: "done",
    reviewStatus: "pending_review",
    transcriptLanguage: "de",
    status: "new",
    titleProposalStatus: "done",
    transcriptionStatus: "open",
    calendarMatchStatus: "pending",
    audioUrl: "/api/audio/e70089fd-37ec-45e3-a4dd-23fe9fd750c0",
    audioPath: "/data/knowledge/audio/e70089fd-37ec-45e3-a4dd-23fe9fd750c0.mp3",
    transcript:
      "Hallo, hallo Kevin, hi! So, da bist du ja schon ... Das ist so eigentlich meine grundlegende Frage, die ich spaeter habe.",
    durationMs: 336000,
    locationName: null,
    logs: [
      {
        id: "b6a4db25-c9f9-43fe-9cb2-0bf5254ed3f4",
        logger: "title-proposal-workflow",
        level: "info",
        message: "Title proposal successfully generated from transcript summary.",
        createdAt: "2026-04-30T08:36:12.000Z"
      },
      {
        id: "ef5fb43e-5c7d-44a8-972f-7dd6cb7c31f4",
        logger: "transcription-workflow",
        level: "warn",
        message: "Transcript segments imported, but speaker labels are only partially resolved.",
        createdAt: "2026-04-30T08:35:57.000Z"
      }
    ],
    selectedCalendarEventId: null,
    tags: MOCK_RECORDING_TAGS["e70089fd-37ec-45e3-a4dd-23fe9fd750c0"] ?? [],
    sentences: [
      {
        id: "325d4a21-470a-4fa4-b130-e63e939a2a10",
        position: 1,
        startMs: 957,
        endMs: 2713,
        speaker: "A",
        text: "Hallo, hallo Kevin, hi!"
      },
      {
        id: "cfa5b2d4-dc58-467d-8ce4-eeb28a56ed30",
        position: 2,
        startMs: 2714,
        endMs: 5100,
        speaker: "B",
        text: "So, da bist du ja schon, ist doch halb erst eingeladen, oder?"
      },
      {
        id: "566f4d20-b2a5-4e31-a925-b068ea7317c9",
        position: 3,
        startMs: 5101,
        endMs: 8333,
        speaker: "A",
        text: "Ich wollte nur einmal kurz mit dir drueber sprechen, ob ich irgendwas uebersehen habe."
      }
    ]
  },
  {
    id: "2b7f85c7-39ed-47db-8617-b03fbfdc1e99",
    customTitle: null,
    titleProposal: "",
    source: "plaud",
    filename: "2b7f85c7-39ed-47db-8617-b03fbfdc1e99.mp3",
    assemblyAiTranscriptId: "6c8f9736-61d6-4213-a7a0-54a1e1107f07",
    title: "Kurze Plaud-Notiz",
    summary: "Perfect. Oh, ich liebe so was echt.",
    startedAt: "2026-04-28T09:01:07.203Z",
    endedAt: "2026-04-28T09:11:15.203Z",
    category: "private",
    categoryStatus: "done",
    locationStatus: "pending",
    reviewStatus: "approved",
    transcriptLanguage: "de",
    status: "new",
    titleProposalStatus: "done",
    transcriptionStatus: "done",
    calendarMatchStatus: "pending",
    audioUrl: "/api/audio/2b7f85c7-39ed-47db-8617-b03fbfdc1e99",
    audioPath: "/data/knowledge/audio/2b7f85c7-39ed-47db-8617-b03fbfdc1e99.mp3",
    transcript: "Perfect. Oh, ich liebe so was echt.",
    durationMs: 608000,
    locationName: null,
    logs: [
      {
        id: "3cb32eb1-f4a7-40a0-94fe-e3df8894219f",
        logger: "calendar-match-workflow",
        level: "info",
        message: "No calendar event candidates found for this recording window.",
        createdAt: "2026-04-28T09:12:01.000Z"
      }
    ],
    selectedCalendarEventId: null,
    tags: MOCK_RECORDING_TAGS["2b7f85c7-39ed-47db-8617-b03fbfdc1e99"] ?? [],
    sentences: []
  },
  {
    id: "d28cc673-2989-449e-9b82-cc3f9fac61da",
    customTitle: null,
    titleProposal: null,
    source: "plaud",
    filename: "d28cc673-2989-449e-9b82-cc3f9fac61da.mp3",
    assemblyAiTranscriptId: "76c331a4-8b15-4445-ab23-01b9596ada40",
    title: "Langes Meeting ohne Summary",
    summary: null,
    startedAt: "2026-04-28T12:43:22.000Z",
    endedAt: "2026-04-28T13:40:44.000Z",
    category: "unknown",
    categoryStatus: "pending",
    locationStatus: "pending",
    reviewStatus: "rejected",
    transcriptLanguage: null,
    status: "new",
    titleProposalStatus: "pending",
    transcriptionStatus: "open",
    calendarMatchStatus: "pending",
    audioUrl: "/api/audio/d28cc673-2989-449e-9b82-cc3f9fac61da",
    audioPath: "/data/knowledge/audio/d28cc673-2989-449e-9b82-cc3f9fac61da.mp3",
    transcript: null,
    durationMs: 3442000,
    locationName: null,
    logs: [
      {
        id: "f73824a0-6671-4e10-9f9c-f83987308755",
        logger: "transcription-workflow",
        level: "error",
        message: "Transcript body missing after processing. Retry required.",
        createdAt: "2026-04-28T13:44:48.000Z"
      }
    ],
    selectedCalendarEventId: null,
    tags: [],
    sentences: []
  }
];

export const MOCK_RECORDINGS: RecordingListItem[] = MOCK_DETAILS.map(
  ({ logs, sentences, transcript, audioPath, durationMs, locationName, selectedCalendarEventId, ...recording }) => recording
);

export function getMockRecordingDetail(id: string) {
  return MOCK_DETAILS.find((item) => item.id === id) ?? null;
}

export function listMockTags() {
  return buildMockTagTree();
}

export function listMockPrompts() {
  return MOCK_PROMPTS;
}
