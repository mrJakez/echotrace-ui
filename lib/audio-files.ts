import { existsSync } from "node:fs";
import path from "node:path";

import { env } from "@/lib/env";

export function resolveRecordingAudioPath(recording: {
  id: string;
  filename: string;
  audioPath?: string | null;
  assemblyAiTranscriptId?: string | null;
}) {
  if (!env.audioFilesRoot) {
    return null;
  }

  const root = path.resolve(env.audioFilesRoot);
  const candidates = [
    recording.audioPath,
    recording.assemblyAiTranscriptId ? path.join(root, `${recording.assemblyAiTranscriptId}.mp3`) : null,
    recording.filename ? path.join(root, path.basename(recording.filename)) : null,
    path.join(root, `${recording.id}.mp3`)
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find((candidate) => {
    const resolved = path.resolve(candidate);
    return (resolved === root || resolved.startsWith(`${root}${path.sep}`)) && existsSync(resolved);
  }) ?? null;
}
