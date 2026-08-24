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

export function inspectRecordingAudioStorage(
  recordings: Array<{
    assemblyAiTranscriptId?: string | null;
    audioPath?: string | null;
    filename: string;
    id: string;
    reviewStatus?: string | null;
    sourceRecordingId?: string | null;
  }>
) {
  const sizesByRecordingId = new Map<string, number>();
  const uniqueFiles = new Map<string, number>();
  const uniqueFilesByReviewStatus = new Map<string, Map<string, number>>();
  let missingFileCount = 0;

  for (const recording of recordings) {
    const audioPath = resolveRecordingAudioPath(recording);
    if (!audioPath) {
      missingFileCount += 1;
      continue;
    }

    try {
      const fileSize = statSync(audioPath).size;
      sizesByRecordingId.set(recording.id, fileSize);
      uniqueFiles.set(audioPath, fileSize);
      const reviewStatus = recording.reviewStatus ?? "unknown";
      const statusFiles = uniqueFilesByReviewStatus.get(reviewStatus) ?? new Map<string, number>();
      statusFiles.set(audioPath, fileSize);
      uniqueFilesByReviewStatus.set(reviewStatus, statusFiles);
    } catch {
      missingFileCount += 1;
    }
  }

  return {
    bytesByReviewStatus: new Map(
      [...uniqueFilesByReviewStatus.entries()].map(([status, files]) => [
        status,
        [...files.values()].reduce((total, size) => total + size, 0)
      ])
    ),
    fileCount: uniqueFiles.size,
    missingFileCount,
    sizesByRecordingId,
    totalBytes: [...uniqueFiles.values()].reduce((total, size) => total + size, 0)
  };
}

export async function deleteMergedRecordingAudio(recording: {
  audioPath?: string | null;
  filename?: string | null;
  id: string;
  source?: string | null;
}) {
  if (recording.source !== "merged" || !env.audioFilesRoot) {
    return false;
  }

  const root = path.resolve(env.audioFilesRoot);
  const candidate = recording.audioPath ?? (recording.filename ? path.join(root, path.basename(recording.filename)) : null);
  const expectedPath = candidate ? path.resolve(candidate) : path.join(root, `${recording.id}.mp3`);
  if (!expectedPath.startsWith(`${root}${path.sep}`)) {
    return false;
  }
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
