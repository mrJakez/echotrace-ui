import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { NextResponse } from "next/server";
import { z } from "zod";

import { createMergedRecording, getRecordingDetail } from "@/db/queries";
import { requireApiSession } from "@/lib/auth/guards";
import { resolveRecordingAudioPath } from "@/lib/audio-files";
import { env } from "@/lib/env";
import { logServerEvent } from "@/lib/server-log";

export const runtime = "nodejs";

const mergeSchema = z.object({
  recordingIds: z.array(z.string().uuid()).min(2).max(50),
  title: z.string().trim().min(1).max(255),
  mergeAudio: z.boolean().default(true)
}).refine((value) => new Set(value.recordingIds).size === value.recordingIds.length, {
  message: "Recordings must be unique"
});

function runFfmpeg(listPath: string, outputPath: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listPath, "-vn", "-c:a", "libmp3lame", "-q:a", "2", "-y", outputPath]);
    let errorOutput = "";
    child.stderr.on("data", (chunk) => {
      errorOutput += String(chunk);
    });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(errorOutput || `ffmpeg exited with ${code}`)));
  });
}

export async function POST(request: Request) {
  const auth = await requireApiSession();
  if (auth.response) {
    return auth.response;
  }

  const parsed = mergeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid merge request" }, { status: 400 });
  }

  const details = await Promise.all(parsed.data.recordingIds.map((id) => getRecordingDetail(id)));
  if (details.some((detail) => detail === null)) {
    return NextResponse.json({ message: "At least one recording was not found" }, { status: 404 });
  }

  const sources = details.filter((detail): detail is NonNullable<typeof detail> => detail !== null);
  const id = randomUUID();
  let audioPath: string | null = null;
  let audioWarning: string | null = null;

  if (parsed.data.mergeAudio) {
    const sourcePaths = sources.map(resolveRecordingAudioPath);
    if (!env.audioFilesRoot) {
      audioWarning = "Text was combined, but AUDIO_FILES_ROOT is not configured.";
    } else if (sourcePaths.some((sourcePath) => sourcePath === null)) {
      audioWarning = "Text was combined, but at least one source audio file is unavailable.";
    } else {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "echotrace-merge-"));
      const listPath = path.join(tempDir, "inputs.txt");
      const tempOutputPath = path.join(env.audioFilesRoot, `.${id}.merge-in-progress.mp3`);
      const finalOutputPath = path.join(env.audioFilesRoot, `${id}.mp3`);
      try {
        const concatList = (sourcePaths as string[])
          .map((sourcePath) => `file '${sourcePath.replaceAll("'", "'\\''")}'`)
          .join("\n");
        await writeFile(listPath, concatList, "utf8");
        await runFfmpeg(listPath, tempOutputPath);
        await rename(tempOutputPath, finalOutputPath);
        audioPath = finalOutputPath;
      } catch (error) {
        await rm(tempOutputPath, { force: true });
        audioWarning = `Text was combined, but audio merge failed: ${error instanceof Error ? error.message : "unknown error"}`;
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    }
  }

  try {
    const recording = await createMergedRecording({
      id,
      title: parsed.data.title,
      details: sources,
      audioPath
    });
    logServerEvent("api:/api/recordings/merge", "created", {
      audioMerged: Boolean(audioPath),
      id,
      sourceIds: parsed.data.recordingIds,
      user: auth.session.email
    });
    return NextResponse.json({ recording, audioMerged: Boolean(audioPath), warning: audioWarning }, { status: 201 });
  } catch (error) {
    if (audioPath) {
      await rm(audioPath, { force: true });
    }
    logServerEvent("api:/api/recordings/merge", "failed", { id, message: error instanceof Error ? error.message : "unknown", user: auth.session.email });
    return NextResponse.json({ message: "The recordings could not be combined." }, { status: 500 });
  }
}
