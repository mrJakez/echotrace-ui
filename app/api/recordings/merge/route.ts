import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { copyFile, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { NextResponse } from "next/server";
import { z } from "zod";

import { createMergedRecording, getRecordingDetail } from "@/db/queries";
import { requireApiSession } from "@/lib/auth/guards";
import { resolveRecordingAudioPath } from "@/lib/audio-files";
import { env } from "@/lib/env";
import { describeError, logServerError, logServerEvent } from "@/lib/server-log";

export const runtime = "nodejs";

const mergeSchema = z.object({
  recordingIds: z.array(z.string().uuid()).min(2).max(50),
  title: z.string().trim().min(1).max(255),
  mergeAudio: z.boolean().default(true)
}).refine((value) => new Set(value.recordingIds).size === value.recordingIds.length, {
  message: "Recordings must be unique"
});

function runFfmpeg(listPath: string, outputPath: string, context: { id: string; sourceCount: number; user: string }) {
  return new Promise<void>((resolve, reject) => {
    logServerEvent("api:/api/recordings/merge", "ffmpeg-start", {
      ...context,
      listPath,
      outputPath
    });
    const child = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listPath, "-vn", "-c:a", "libmp3lame", "-q:a", "2", "-y", outputPath]);
    let standardOutput = "";
    let errorOutput = "";
    child.stdout.on("data", (chunk) => {
      standardOutput += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      errorOutput += String(chunk);
    });
    child.once("error", (error) => {
      logServerError("api:/api/recordings/merge", "ffmpeg-spawn-failed", {
        ...context,
        ...describeError(error)
      });
      reject(error);
    });
    child.once("close", (code, signal) => {
      const outputMeta = {
        ...context,
        code,
        signal,
        stderr: errorOutput || undefined,
        stdout: standardOutput || undefined
      };
      if (code === 0) {
        logServerEvent("api:/api/recordings/merge", "ffmpeg-complete", outputMeta);
        resolve();
      } else {
        const error = new Error(errorOutput || `ffmpeg exited with ${code}`);
        logServerError("api:/api/recordings/merge", "ffmpeg-failed", {
          ...outputMeta,
          ...describeError(error)
        });
        reject(error);
      }
    });
  });
}

async function removeIfPresent(target: string | null) {
  if (!target) {
    return;
  }

  await rm(target, { force: true, recursive: true }).catch(() => undefined);
}

export async function POST(request: Request) {
  const auth = await requireApiSession();
  if (auth.response) {
    logServerError("api:/api/recordings/merge", "unauthorized");
    return auth.response;
  }

  logServerEvent("api:/api/recordings/merge", "request-received", {
    contentLength: request.headers.get("content-length"),
    contentType: request.headers.get("content-type"),
    user: auth.session.email
  });

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch (error) {
    logServerError("api:/api/recordings/merge", "request-json-failed", {
      ...describeError(error),
      user: auth.session.email
    });
    return NextResponse.json({ message: "The merge request was not valid JSON." }, { status: 400 });
  }

  const parsed = mergeSchema.safeParse(requestBody);
  if (!parsed.success) {
    logServerError("api:/api/recordings/merge", "request-invalid", {
      issues: parsed.error.issues,
      user: auth.session.email
    });
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid merge request" }, { status: 400 });
  }

  logServerEvent("api:/api/recordings/merge", "request-validated", {
    mergeAudio: parsed.data.mergeAudio,
    recordingCount: parsed.data.recordingIds.length,
    recordingIds: parsed.data.recordingIds,
    titleLength: parsed.data.title.length,
    user: auth.session.email
  });

  let details;
  try {
    details = await Promise.all(parsed.data.recordingIds.map((id) => getRecordingDetail(id)));
  } catch (error) {
    logServerError("api:/api/recordings/merge", "source-load-failed", {
      ...describeError(error),
      recordingIds: parsed.data.recordingIds,
      user: auth.session.email
    });
    return NextResponse.json({ message: "The source recordings could not be loaded." }, { status: 500 });
  }
  if (details.some((detail) => detail === null)) {
    logServerError("api:/api/recordings/merge", "source-not-found", {
      missingIds: parsed.data.recordingIds.filter((_, index) => details[index] === null),
      user: auth.session.email
    });
    return NextResponse.json({ message: "At least one recording was not found" }, { status: 404 });
  }

  const sources = details.filter((detail): detail is NonNullable<typeof detail> => detail !== null);
  const id = randomUUID();
  logServerEvent("api:/api/recordings/merge", "sources-loaded", {
    id,
    sources: sources.map((source) => ({
      audioPath: source.audioPath,
      audioUrl: source.audioUrl,
      filename: source.filename,
      id: source.id,
      sourceRecordingId: source.sourceRecordingId,
      transcriptId: source.assemblyAiTranscriptId
    })),
    user: auth.session.email
  });
  let audioPath: string | null = null;
  let audioWarning: string | null = null;

  if (parsed.data.mergeAudio) {
    let tempDir: string | null = null;
    let stagedOutputPath: string | null = null;
    try {
      const sourcePaths = sources.map(resolveRecordingAudioPath);
      logServerEvent("api:/api/recordings/merge", "audio-sources-resolved", {
        id,
        sourcePaths,
        user: auth.session.email
      });
      if (!env.audioFilesRoot) {
        audioWarning = "Text was combined, but AUDIO_FILES_ROOT is not configured.";
      } else if (sourcePaths.some((sourcePath) => sourcePath === null)) {
        audioWarning = "Text was combined, but at least one source audio file is unavailable.";
      } else {
        tempDir = await mkdtemp(path.join(os.tmpdir(), "echotrace-merge-"));
        const listPath = path.join(tempDir, "inputs.txt");
        const tempOutputPath = path.join(tempDir, `${id}.mp3`);
        stagedOutputPath = path.join(env.audioFilesRoot, `.${id}.merge-in-progress.mp3`);
        const finalOutputPath = path.join(env.audioFilesRoot, `${id}.mp3`);
        const concatList = (sourcePaths as string[])
          .map((sourcePath) => `file '${sourcePath.replaceAll("'", "'\\''")}'`)
          .join("\n");
        await writeFile(listPath, concatList, "utf8");
        logServerEvent("api:/api/recordings/merge", "concat-list-written", {
          id,
          listPath,
          sourceCount: sourcePaths.length,
          user: auth.session.email
        });
        await runFfmpeg(listPath, tempOutputPath, {
          id,
          sourceCount: sourcePaths.length,
          user: auth.session.email
        });
        logServerEvent("api:/api/recordings/merge", "audio-copy-start", {
          finalOutputPath,
          id,
          stagedOutputPath,
          tempOutputPath,
          user: auth.session.email
        });
        await copyFile(tempOutputPath, stagedOutputPath);
        await rename(stagedOutputPath, finalOutputPath);
        audioPath = finalOutputPath;
        logServerEvent("api:/api/recordings/merge", "audio-persisted", {
          audioPath,
          id,
          user: auth.session.email
        });
      }
    } catch (error) {
      audioWarning = `Text was combined, but audio merge failed: ${error instanceof Error ? error.message : "unknown error"}`;
      logServerError("api:/api/recordings/merge", "audio-failed", {
        ...describeError(error),
        id,
        sourceIds: parsed.data.recordingIds,
        user: auth.session.email
      });
    } finally {
      await removeIfPresent(stagedOutputPath);
      await removeIfPresent(tempDir);
    }
  }

  try {
    logServerEvent("api:/api/recordings/merge", "database-create-start", {
      audioPath,
      id,
      sourceIds: parsed.data.recordingIds,
      user: auth.session.email
    });
    const recording = await createMergedRecording({
      id,
      title: parsed.data.title,
      details: sources,
      audioPath
    });
    logServerEvent("api:/api/recordings/merge", "database-create-complete", {
      audioMerged: Boolean(audioPath),
      id,
      sourceIds: parsed.data.recordingIds,
      user: auth.session.email
    });
    return NextResponse.json({ recording, audioMerged: Boolean(audioPath), warning: audioWarning }, { status: 201 });
  } catch (error) {
    if (audioPath) {
      await removeIfPresent(audioPath);
    }
    logServerError("api:/api/recordings/merge", "database-create-failed", {
      ...describeError(error),
      audioPath,
      id,
      sourceIds: parsed.data.recordingIds,
      user: auth.session.email
    });
    return NextResponse.json({ id, message: "The recordings could not be combined." }, { status: 500 });
  }
}
