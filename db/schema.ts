import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const recordings = pgTable("recordings", {
  id: uuid("id").primaryKey(),
  title: text("title"),
  titleProposal: text("title_proposal"),
  reviewStatus: text("review_status").notNull(),
  source: text("source"),
  filename: text("filename").notNull(),
  audioPath: text("audio_path"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
  durationMs: integer("duration_ms"),
  category: text("category"),
  categoryStatus: text("category_status"),
  locationStatus: text("location_status"),
  status: text("status"),
  transcriptSummary: text("transcript_summary"),
  transcriptLanguage: text("transcript_language"),
  locationName: text("location_name"),
  selectedCalendarEventId: uuid("selected_calendar_event_id"),
  titleProposalStatus: text("title_proposal_status"),
  transcriptionStatus: text("transcription_status"),
  calendarMatchStatus: text("calendar_match_status"),
  assemblyAiTranscriptId: uuid("assembly_ai_transcript_id")
});

export const recordingSentences = pgTable("recording_sentences", {
  id: uuid("id").primaryKey(),
  recordingId: uuid("recording_id").notNull(),
  position: integer("position").notNull(),
  startMs: integer("start_ms").notNull(),
  endMs: integer("end_ms").notNull(),
  speaker: text("speaker"),
  text: text("text").notNull()
});

export const recordingLogs = pgTable("recording_logs", {
  id: uuid("id").primaryKey(),
  recordingId: uuid("recording_id").notNull(),
  logger: text("logger").notNull(),
  level: text("level"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
});

export const recordingLogsLegacy = pgTable("recording_logs", {
  id: uuid("id").primaryKey(),
  recordingId: uuid("recording_id").notNull(),
  logger: text("logger").notNull(),
  level: text("level"),
  logMessage: text("log_message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
});

export const tags = pgTable("tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  parentId: uuid("parent_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const recordingTags = pgTable("recording_tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  recordingId: uuid("recording_id").notNull(),
  tagId: uuid("tag_id").notNull(),
  assignmentSource: text("assignment_source").notNull(),
  assignmentState: text("assignment_state").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const prompts = pgTable("prompts", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  prompt: text("prompt").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const authUsers = pgTable("auth_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const authPasskeys = pgTable("auth_passkeys", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  credentialId: text("credential_id").notNull().unique(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  deviceType: text("device_type").notNull(),
  backedUp: boolean("backed_up").notNull().default(false),
  transports: text("transports"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
