import { statSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";

import { env } from "@/lib/env";

export function resolveRecordingAudioPath(recording: {
  id: string;
  filename: string;
  audioPath?: string | null;
  assemblyAiTranscriptId?: string | null;
  sourceRecordingId?: string | null;
}) {
  if (!env.audioFilesRoot) {
    return null;
  }

  const root = path.resolve(env.audioFilesRoot);
  const candidates = [
    recording.audioPath,
    recording.assemblyAiTranscriptId ? path.join(root, `${recording.assemblyAiTranscriptId}.mp3`) : null,
    recording.sourceRecordingId ? path.join(root, `${recording.sourceRecordingId}.mp3`) : null,
    recording.filename ? path.join(root, path.basename(recording.filename)) : null,
    path.join(root, `${recording.id}.mp3`)
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find((candidate) => {
    const resolved = path.resolve(candidate);
    if (!resolved.startsWith(`${root}${path.sep}`)) {
      return false;
    }

    try {
      return statSync(resolved).isFile();
    } catch {
      return false;
    }
  }) ?? null;
}

export async function deleteMergedRecordingAudio(recording: { id: string; source?: string | null }) {
  if (recording.source !== "merged" || !env.audioFilesRoot) {
    return false;
  }

  const root = path.resolve(env.audioFilesRoot);
  const expectedPath = path.join(root, `${recording.id}.mp3`);
  let exists = false;
  try {
    exists = statSync(expectedPath).isFile();
  } catch {
    return false;
  }

  if (exists) {
    await rm(expectedPath, { force: true });
  }
  return exists;
}
