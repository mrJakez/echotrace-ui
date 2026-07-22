import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";

import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { getMockRecordingDetail } from "@/db/mock-data";
import { recordings } from "@/db/schema";
import { requireApiSession } from "@/lib/auth/guards";
import { env } from "@/lib/env";
import { logServerEvent } from "@/lib/server-log";

function buildCandidateNames(recording: {
  id?: string;
  filename: string;
  assemblyAiTranscriptId?: string | null;
  sourceRecordingId?: string | null;
}) {
  const names: string[] = [];

  if ((env.audioFileNaming === "transcript_id" || env.audioFileNaming === "auto") && recording.assemblyAiTranscriptId) {
    names.push(`${recording.assemblyAiTranscriptId}.mp3`);
  }

  if (recording.sourceRecordingId) {
    const sourceRecordingName = path.basename(recording.sourceRecordingId);
    if (sourceRecordingName === recording.sourceRecordingId) {
      names.push(`${sourceRecordingName}.mp3`);
    }
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
      assemblyAiTranscriptId: mock.assemblyAiTranscriptId ?? null,
      sourceRecordingId: mock.sourceRecordingId ?? null
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
      assemblyAiTranscriptId: recordings.assemblyAiTranscriptId,
      sourceRecordingId: recordings.sourceRecordingId
    })
    .from(recordings)
    .where(eq(recordings.id, id))
    .limit(1);

  return recording ?? null;
}

function notFound(message: string) {
  return new Response(message, { status: 404 });
}

function getAudioContentType(filePath: string) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".m4a":
    case ".mp4":
      return "audio/mp4";
    case ".webm":
      return "audio/webm";
    case ".flac":
      return "audio/flac";
    case ".wav":
      return "audio/wav";
    default:
      return "audio/mpeg";
  }
}

function createCancellableWebStream(stream: ReturnType<typeof createReadStream>) {
  const iterator = stream[Symbol.asyncIterator]();
  let closed = false;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const result = await iterator.next();
        if (closed) {
          return;
        }
        if (result.done) {
          closed = true;
          controller.close();
          return;
        }
        controller.enqueue(result.value);
      } catch (error) {
        if (!closed) {
          closed = true;
          controller.error(error);
        }
      }
    },
    async cancel() {
      closed = true;
      stream.destroy();
      await iterator.return?.();
    }
  });
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession();
  if (auth.response) {
    logServerEvent("api:/api/audio/[id]", "unauthorized");
    return auth.response;
  }

  const { id } = await context.params;

  if (!env.audioFilesRoot) {
    logServerEvent("api:/api/audio/[id]", "missing-audio-root", { id, user: auth.session.email });
    return new Response("AUDIO_FILES_ROOT is not configured", { status: 500 });
  }

  const recording = await loadRecording(id);
  if (!recording) {
    logServerEvent("api:/api/audio/[id]", "recording-not-found", { id, user: auth.session.email });
    return notFound("Recording not found");
  }

  const candidateNames = buildCandidateNames(recording);
  const candidatePaths = candidateNames.map((name) => path.join(env.audioFilesRoot, name));
  const filePath = candidatePaths.find((candidate) => existsSync(candidate));

  logServerEvent("api:/api/audio/[id]", "lookup", {
    audioFilesRoot: env.audioFilesRoot,
    candidateNames,
    candidatePaths,
    filename: recording.filename,
    id,
    resolved: filePath ?? null,
    transcriptId: recording.assemblyAiTranscriptId ?? null,
    user: auth.session.email
  });

  if (!filePath) {
    logServerEvent("api:/api/audio/[id]", "file-not-found", { candidatePaths, id, user: auth.session.email });
    return notFound(`Audio file not found for recording ${id}`);
  }

  const fileStat = await stat(filePath);
  const range = request.headers.get("range");
  const shouldDownload = new URL(request.url).searchParams.get("download") === "1";
  const contentType = getAudioContentType(filePath);
  const contentDisposition: Record<string, string> = shouldDownload
    ? { "Content-Disposition": `attachment; filename="${path.basename(filePath)}"` }
    : {};

  if (!range) {
    logServerEvent("api:/api/audio/[id]", "stream-full", { filePath, id, size: fileStat.size, user: auth.session.email });
    const stream = createReadStream(filePath);
    return new Response(createCancellableWebStream(stream), {
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Length": String(fileStat.size),
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
        ...contentDisposition
      }
    });
  }

  const match = /bytes=(\d*)-(\d*)/.exec(range);
  if (!match) {
    logServerEvent("api:/api/audio/[id]", "invalid-range", { id, range, user: auth.session.email });
    return new Response("Invalid range header", { status: 416 });
  }

  const start = match[1] ? Number.parseInt(match[1], 10) : 0;
  const end = match[2] ? Number.parseInt(match[2], 10) : fileStat.size - 1;

  if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= fileStat.size) {
    logServerEvent("api:/api/audio/[id]", "range-not-satisfiable", {
      end,
      id,
      range,
      size: fileStat.size,
      start,
      user: auth.session.email
    });
    return new Response("Requested range not satisfiable", {
      status: 416,
      headers: {
        "Content-Range": `bytes */${fileStat.size}`
      }
    });
  }

  const stream = createReadStream(filePath, { start, end });
  logServerEvent("api:/api/audio/[id]", "stream-range", {
    end,
    filePath,
    id,
    size: fileStat.size,
    start,
    user: auth.session.email
  });
  return new Response(createCancellableWebStream(stream), {
    status: 206,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${fileStat.size}`,
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
      ...contentDisposition
    }
  });
}
