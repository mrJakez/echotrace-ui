import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { getMockRecordingDetail } from "@/db/mock-data";
import { recordings } from "@/db/schema";
import { requireApiSession } from "@/lib/auth/guards";
import { env } from "@/lib/env";

function buildCandidateNames(recording: {
  id?: string;
  filename: string;
  assemblyAiTranscriptId?: string | null;
}) {
  const names: string[] = [];

  if ((env.audioFileNaming === "transcript_id" || env.audioFileNaming === "auto") && recording.assemblyAiTranscriptId) {
    names.push(`${recording.assemblyAiTranscriptId}.mp3`);
  }

  // `filename` is the most reliable fallback in the current export shape.
  if (recording.filename) {
    names.push(recording.filename);
  }

  if (recording.id) {
    names.push(`${recording.id}.mp3`);
  }

  return [...new Set(names)];
}

async function loadRecording(id: string) {
  if (env.useMockData) {
    const mock = getMockRecordingDetail(id);
    if (!mock) {
      return null;
    }

    return {
      id,
      filename: mock.filename,
      assemblyAiTranscriptId: mock.assemblyAiTranscriptId ?? null
    };
  }

  const db = getDb();
  if (!db) {
    return null;
  }

  const [recording] = await db
    .select({
      id: recordings.id,
      filename: recordings.filename,
      assemblyAiTranscriptId: recordings.assemblyAiTranscriptId
    })
    .from(recordings)
    .where(eq(recordings.id, id))
    .limit(1);

  return recording ?? null;
}

function notFound(message: string) {
  return new Response(message, { status: 404 });
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession();
  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;

  if (!env.audioFilesRoot) {
    console.error("[audio] AUDIO_FILES_ROOT is not configured");
    return new Response("AUDIO_FILES_ROOT is not configured", { status: 500 });
  }

  const recording = await loadRecording(id);
  if (!recording) {
    console.warn("[audio] recording not found", { id });
    return notFound("Recording not found");
  }

  const candidateNames = buildCandidateNames(recording);
  const candidatePaths = candidateNames.map((name) => path.join(env.audioFilesRoot, name));
  const filePath = candidatePaths.find((candidate) => existsSync(candidate));

  console.info("[audio] request", {
    audioFilesRoot: env.audioFilesRoot,
    candidateNames,
    candidatePaths,
    filename: recording.filename,
    id,
    resolved: filePath ?? null,
    transcriptId: recording.assemblyAiTranscriptId ?? null
  });

  if (!filePath) {
    console.warn("[audio] file not found", { candidatePaths, id });
    return notFound(`Audio file not found for recording ${id}`);
  }

  const fileStat = await stat(filePath);
  const range = request.headers.get("range");

  if (!range) {
    const stream = createReadStream(filePath);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Length": String(fileStat.size),
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=3600"
      }
    });
  }

  const match = /bytes=(\d*)-(\d*)/.exec(range);
  if (!match) {
    return new Response("Invalid range header", { status: 416 });
  }

  const start = match[1] ? Number.parseInt(match[1], 10) : 0;
  const end = match[2] ? Number.parseInt(match[2], 10) : fileStat.size - 1;

  if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= fileStat.size) {
    return new Response("Requested range not satisfiable", {
      status: 416,
      headers: {
        "Content-Range": `bytes */${fileStat.size}`
      }
    });
  }

  const stream = createReadStream(filePath, { start, end });
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status: 206,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${fileStat.size}`,
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=3600"
    }
  });
}
