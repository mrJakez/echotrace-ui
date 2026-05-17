import type { RecordingDetail, RecordingListItem } from "@/lib/types";

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
    sentences: []
  }
];

export const MOCK_RECORDINGS: RecordingListItem[] = MOCK_DETAILS.map(
  ({ logs, sentences, transcript, audioPath, durationMs, locationName, selectedCalendarEventId, ...recording }) => recording
);

export function getMockRecordingDetail(id: string) {
  return MOCK_DETAILS.find((item) => item.id === id) ?? null;
}
