export function isGenericSpeakerLabel(speaker: string | null): speaker is string {
  if (!speaker?.trim()) {
    return false;
  }

  return /^(?:speaker\s*)?[a-z]$/i.test(speaker.trim());
}

export function getMergedSpeakerLabel(speaker: string | null, sourceIndex: number) {
  if (!speaker?.trim()) {
    return speaker;
  }

  const trimmed = speaker.trim();
  const genericMatch = /^(?:speaker\s*)?([a-z])$/i.exec(trimmed);
  if (!genericMatch) {
    return trimmed;
  }

  return `${genericMatch[1]!.toUpperCase()}${sourceIndex + 1}`;
}
