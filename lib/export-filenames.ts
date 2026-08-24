function sanitizeExportTitle(title: string) {
  return title
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[. -]+|[. -]+$/g, "")
    .slice(0, 72);
}

export function createRecordingMarkdownFilename(title: string | null | undefined, fallback = "export") {
  const safeTitle = sanitizeExportTitle(title ?? "") || sanitizeExportTitle(fallback) || "export";
  return `REC-${safeTitle}.md`;
}

export function createSelectionMarkdownFilename(titles: string[]) {
  const firstTitle = titles[0] ?? "selection";
  if (titles.length <= 1) {
    return createRecordingMarkdownFilename(firstTitle, "selection");
  }

  const suffix = `-plus-${titles.length - 1}-more`;
  const safeTitle = sanitizeExportTitle(firstTitle).slice(0, Math.max(24, 72 - suffix.length));
  return `REC-${safeTitle || "selection"}${suffix}.md`;
}

export function createPromptMarkdownFilename(title: string | null | undefined, fallback = "prompt") {
  const safeTitle = sanitizeExportTitle(title ?? "") || sanitizeExportTitle(fallback) || "prompt";
  return `PROMPT-${safeTitle}.md`;
}
