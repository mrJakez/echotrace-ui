"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { MarkdownResponse } from "@/components/markdown-response";
import { formatDuration, formatSentenceOffset, formatTime } from "@/lib/time";
import type { ProcessingStatus, PromptItem, RecordingCategory, RecordingDetail, ReviewStatus, TagItem } from "@/lib/types";

const DATE_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Berlin"
});

const LOG_DATE_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin"
});

type RecordingDetailPanelProps = {
  detail: RecordingDetail | null;
  isLoading: boolean;
  onOverlayStateChange?: (isOpen: boolean) => void;
  onReviewStatusUpdated: (detail: RecordingDetail) => void;
  onTitleUpdated: (detail: RecordingDetail) => void;
  onClose: () => void;
};

export function RecordingDetailPanel({
  detail,
  isLoading,
  onOverlayStateChange,
  onReviewStatusUpdated,
  onTitleUpdated,
  onClose
}: RecordingDetailPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPipelineExpanded, setIsPipelineExpanded] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isSavingReviewStatus, setIsSavingReviewStatus] = useState(false);
  const [isTypeMenuOpen, setIsTypeMenuOpen] = useState(false);
  const [isSavingType, setIsSavingType] = useState(false);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [actionsMenuPosition, setActionsMenuPosition] = useState<{ right: number; top: number } | null>(null);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [currentAudioMs, setCurrentAudioMs] = useState(0);
  const [durationAudioMs, setDurationAudioMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [availableTags, setAvailableTags] = useState<TagItem[]>([]);
  const [tagQuery, setTagQuery] = useState("");
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
  const [activeTagOptionIndex, setActiveTagOptionIndex] = useState(0);
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [isPromptDialogOpen, setIsPromptDialogOpen] = useState(false);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);
  const [isSendingPrompt, setIsSendingPrompt] = useState(false);
  const [promptRunResult, setPromptRunResult] = useState<string | null>(null);
  const [promptRunError, setPromptRunError] = useState<string | null>(null);
  const [promptAttachments, setPromptAttachments] = useState<File[]>([]);
  const [editingSpeakerSentenceId, setEditingSpeakerSentenceId] = useState<string | null>(null);
  const [speakerDraft, setSpeakerDraft] = useState("");
  const [savingSpeakerKey, setSavingSpeakerKey] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const actionsMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const sentenceRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const sentenceListRef = useRef<HTMLDivElement | null>(null);
  const audioFrameRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const isSeekingRef = useRef(false);
  const isEditingSpeakerRef = useRef(false);
  const pendingSeekMsRef = useRef<number | null>(null);
  const timingRef = useRef({
    durationAudioMs: 0,
    effectiveDurationMs: 0,
    timelineScale: 1
  });
  const transcriptDurationMs = detail?.durationMs && detail.durationMs > 0 ? detail.durationMs : null;
  const effectiveDurationMs =
    transcriptDurationMs !== null && durationAudioMs > 0 ? transcriptDurationMs : transcriptDurationMs ?? durationAudioMs;
  const timelineScale =
    transcriptDurationMs !== null && durationAudioMs > 0 ? transcriptDurationMs / durationAudioMs : 1;
  const playbackRate =
    transcriptDurationMs !== null && durationAudioMs > 0 && transcriptDurationMs < durationAudioMs
      ? durationAudioMs / transcriptDurationMs
      : 1;

  timingRef.current = {
    durationAudioMs,
    effectiveDurationMs,
    timelineScale
  };

  function syncCurrentAudioMs() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const nextMs = sourceAudioMsToTimelineMs(audio.currentTime * 1000);
    const effectiveDurationMs = timingRef.current.effectiveDurationMs;

    if (effectiveDurationMs > 0 && nextMs >= effectiveDurationMs) {
      audio.currentTime = timelineMsToSourceAudioMs(effectiveDurationMs) / 1000;
      if (!audio.paused) {
        audio.pause();
      }
      setCurrentAudioMs(effectiveDurationMs);
      return;
    }

    setCurrentAudioMs(nextMs);
  }

  useEffect(() => {
    setIsExpanded(false);
    setIsPipelineExpanded(false);
    setIsEditingTitle(false);
    setTitleDraft(detail?.customTitle ?? "");
    setIsSavingReviewStatus(false);
    setIsTypeMenuOpen(false);
    setIsSavingType(false);
    setIsActionsMenuOpen(false);
    setActionsMenuPosition(null);
    setIsNoteDialogOpen(false);
    setNoteDraft(detail?.notes ?? "");
    setIsSavingNote(false);
    setExportFeedback(null);
    setIsExportMenuOpen(false);
    setCurrentAudioMs(0);
    setDurationAudioMs(0);
    setIsPlaying(false);
    setTagQuery("");
    setIsTagPickerOpen(false);
    setActiveTagOptionIndex(0);
    setSelectedPromptId("");
    setIsPromptDialogOpen(false);
    setPromptRunResult(null);
    setPromptRunError(null);
    setPromptAttachments([]);
    setEditingSpeakerSentenceId(null);
    setSpeakerDraft("");
    setSavingSpeakerKey(null);
    sentenceRefs.current = {};
    isSeekingRef.current = false;
    isEditingSpeakerRef.current = false;
    pendingSeekMsRef.current = null;

    if (audioFrameRef.current !== null) {
      cancelAnimationFrame(audioFrameRef.current);
      audioFrameRef.current = null;
    }

    if (scrollFrameRef.current !== null) {
      cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = null;
    }
  }, [detail?.id]);

  useEffect(() => {
    const isOpen = isActionsMenuOpen || isExportMenuOpen || isNoteDialogOpen || isPromptDialogOpen || isTypeMenuOpen || isTagPickerOpen;
    onOverlayStateChange?.(isOpen);

    return () => {
      onOverlayStateChange?.(false);
    };
  }, [isActionsMenuOpen, isExportMenuOpen, isNoteDialogOpen, isPromptDialogOpen, isTypeMenuOpen, isTagPickerOpen, onOverlayStateChange]);

  useEffect(() => {
    let isMounted = true;

    async function loadTags() {
      const response = await fetch("/api/tags", { cache: "no-store" });
      if (!response.ok || !isMounted) {
        return;
      }

      const payload = (await response.json()) as TagItem[];
      if (isMounted) {
        setAvailableTags(payload);
      }
    }

    void loadTags();

    return () => {
      isMounted = false;
    };
  }, [detail?.id]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);

      if (audioFrameRef.current !== null) {
        cancelAnimationFrame(audioFrameRef.current);
        audioFrameRef.current = null;
      }

      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, [onClose]);

  useEffect(() => {
    if (!isPlaying) {
      if (audioFrameRef.current !== null) {
        cancelAnimationFrame(audioFrameRef.current);
        audioFrameRef.current = null;
      }
      return;
    }

    const syncAudioPosition = () => {
      const audio = audioRef.current;
      if (!audio) {
        audioFrameRef.current = null;
        return;
      }

      if (!isSeekingRef.current) {
        syncCurrentAudioMs();
      }
      audioFrameRef.current = requestAnimationFrame(syncAudioPosition);
    };

    syncAudioPosition();

    return () => {
      if (audioFrameRef.current !== null) {
        cancelAnimationFrame(audioFrameRef.current);
        audioFrameRef.current = null;
      }
    };
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.playbackRate = playbackRate;
  }, [playbackRate]);

  const activeSentenceId = useMemo(() => {
    if (!detail) {
      return null;
    }

    const audioMs = Math.max(currentAudioMs, 0);
    const sentences = detail.sentences;

    for (let index = sentences.length - 1; index >= 0; index -= 1) {
      const sentence = sentences[index];
      if (audioMs >= sentence.startMs) {
        return sentence.id;
      }
    }

    return null;
  }, [currentAudioMs, detail]);
  const speakerColorByKey = useMemo(() => {
    const colors = new Map<string, string>();
    if (!detail) {
      return colors;
    }

    for (const sentence of detail.sentences) {
      const speakerKey = getSpeakerKey(sentence.speaker);
      if (!colors.has(speakerKey)) {
        colors.set(speakerKey, SPEAKER_CHIP_CLASSES[colors.size % SPEAKER_CHIP_CLASSES.length]);
      }
    }

    return colors;
  }, [detail]);

  const flatAvailableTags = useMemo(() => flattenTags(availableTags), [availableTags]);
  const createTagCandidate = useMemo(
    () => getCreateTagCandidate(tagQuery, flatAvailableTags),
    [flatAvailableTags, tagQuery]
  );
  const matchingTags = useMemo(() => {
    const normalizedQuery = tagQuery.trim().toLowerCase();
    const assignedTagIds = new Set((detail?.tags ?? []).map((tag) => tag.tagId));

    return flatAvailableTags
      .filter((tag) => !assignedTagIds.has(tag.id))
      .filter((tag) => {
        if (!normalizedQuery) {
          return true;
        }

        return tag.name.toLowerCase().includes(normalizedQuery) || tag.pathLabel.toLowerCase().includes(normalizedQuery);
      })
      .slice(0, 8);
  }, [detail?.tags, flatAvailableTags, tagQuery]);
  const tagAutocompleteOptions = useMemo(
    () => [
      ...matchingTags.map((tag) => ({ id: tag.id, tag, type: "tag" as const })),
      ...(createTagCandidate ? [{ id: "create-new-tag", candidate: createTagCandidate, type: "create" as const }] : [])
    ],
    [createTagCandidate, matchingTags]
  );

  useEffect(() => {
    if (!isTagPickerOpen || tagAutocompleteOptions.length === 0) {
      setActiveTagOptionIndex(0);
      return;
    }

    setActiveTagOptionIndex((current) => Math.min(current, tagAutocompleteOptions.length - 1));
  }, [isTagPickerOpen, tagAutocompleteOptions.length]);

  useEffect(() => {
    if (!activeSentenceId || isEditingSpeakerRef.current) {
      return;
    }

    const node = sentenceRefs.current[activeSentenceId];
    const container = sentenceListRef.current;
    if (!node || !container) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    const currentScrollTop = container.scrollTop;
    const offsetWithinContainer = nodeRect.top - containerRect.top + currentScrollTop;
    const preferredTopOffset = container.clientHeight * 0.18;
    const minComfortTop = container.clientHeight * 0.1;
    const maxComfortTop = container.clientHeight * 0.32;
    const visibleTop = node.offsetTop - currentScrollTop;

    if (visibleTop >= minComfortTop && visibleTop <= maxComfortTop) {
      return;
    }

    const targetScrollTop = Math.max(offsetWithinContainer - preferredTopOffset, 0);

    if (scrollFrameRef.current !== null) {
      cancelAnimationFrame(scrollFrameRef.current);
    }

    scrollFrameRef.current = requestAnimationFrame(() => {
      container.scrollTo({
        top: targetScrollTop,
        behavior: "smooth"
      });
      scrollFrameRef.current = null;
    });
  }, [activeSentenceId]);

  if (isLoading || (!detail && isPlaying === false)) {
    return (
      <ModalFrame onClose={onClose}>
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-24 rounded bg-black/10" />
          <div className="h-8 w-3/4 rounded bg-black/10" />
          <div className="h-24 rounded-[24px] bg-black/10" />
          <div className="h-56 rounded-[24px] bg-black/10" />
        </div>
      </ModalFrame>
    );
  }

  if (!detail) {
    return null;
  }

  const transcriptText = detail.transcript ?? detail.summary ?? "No transcript available yet.";
  const shouldClamp = transcriptText.length > 240;
  const normalizedTranscriptionStatus = (detail.transcriptionStatus ?? "").trim().toLowerCase();
  const transcriptionActionLabel = normalizedTranscriptionStatus === "open" ? "Start" : "Reset";
  const transcriptionNextStatus: ProcessingStatus = "pending";

  function sourceAudioMsToTimelineMs(sourceMs: number) {
    const scale = timingRef.current.timelineScale;
    return scale > 0 ? sourceMs * scale : sourceMs;
  }

  function timelineMsToSourceAudioMs(timelineMs: number) {
    const scale = timingRef.current.timelineScale;
    return scale > 0 ? timelineMs / scale : timelineMs;
  }

  async function saveTitle() {
    if (!detail) {
      return;
    }

    const currentTitle = detail.customTitle ?? "";
    const nextTitle = titleDraft.trim();
    if (nextTitle === currentTitle) {
      setIsEditingTitle(false);
      setTitleDraft(currentTitle);
      return;
    }

    setIsSavingTitle(true);

    try {
      const response = await fetch(`/api/recordings/${detail.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ title: nextTitle.length > 0 ? nextTitle : null })
      });

      if (!response.ok) {
        throw new Error("Failed to update title");
      }

      const updated = (await response.json()) as RecordingDetail;
      onTitleUpdated(updated);
      setIsEditingTitle(false);
      setTitleDraft(updated.customTitle ?? "");
    } finally {
      setIsSavingTitle(false);
    }
  }

  async function saveReviewStatus(reviewStatus: ReviewStatus) {
    if (!detail || isSavingReviewStatus) {
      return;
    }

    setIsSavingReviewStatus(true);

    try {
      const shouldKickoffTranscription =
        reviewStatus === "approved" && (detail.transcriptionStatus ?? "").trim().toLowerCase() === "open";

      const reviewResponse = await fetch(`/api/recordings/${detail.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ reviewStatus })
      });

      if (!reviewResponse.ok) {
        return;
      }

      let updated = (await reviewResponse.json()) as RecordingDetail;

      if (shouldKickoffTranscription) {
        const transcriptionResponse = await fetch(`/api/recordings/${detail.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ transcriptionStatus: "pending" })
        });

        if (transcriptionResponse.ok) {
          updated = (await transcriptionResponse.json()) as RecordingDetail;
        }
      }

      onReviewStatusUpdated(updated);
      if (reviewStatus === "rejected") {
        onClose();
      }
    } finally {
      setIsSavingReviewStatus(false);
    }
  }

  async function savePipelineStatus(
    field:
      | "categoryStatus"
      | "locationStatus"
      | "tagProposalStatus"
      | "titleProposalStatus"
      | "transcriptionStatus",
    value: ProcessingStatus
  ) {
    if (!detail) {
      return;
    }

    const response = await fetch(`/api/recordings/${detail.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ [field]: value })
    });

    if (!response.ok) {
      return;
    }

    const updated = (await response.json()) as RecordingDetail;
    onTitleUpdated(updated);
    onReviewStatusUpdated(updated);
  }

  async function saveRecordingType(category: RecordingCategory) {
    if (!detail || isSavingType || detail.category === category) {
      setIsTypeMenuOpen(false);
      return;
    }

    setIsSavingType(true);

    try {
      const response = await fetch(`/api/recordings/${detail.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ category })
      });

      if (!response.ok) {
        return;
      }

      const updated = (await response.json()) as RecordingDetail;
      onTitleUpdated(updated);
      onReviewStatusUpdated(updated);
      setIsTypeMenuOpen(false);
    } finally {
      setIsSavingType(false);
    }
  }

  async function assignManualTag(tagId: string) {
    if (!detail || !tagId) {
      return;
    }

    const response = await fetch(`/api/recordings/${detail.id}/tags`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ tagId })
    });

    if (!response.ok) {
      return;
    }

    const updated = (await response.json()) as RecordingDetail;
    onTitleUpdated(updated);
    setTagQuery("");
    setIsTagPickerOpen(false);
    setActiveTagOptionIndex(0);
  }

  async function createAndAssignTag() {
    if (!detail || !createTagCandidate) {
      return;
    }

    const response = await fetch("/api/tags", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        description: null,
        name: createTagCandidate.name,
        parentId: createTagCandidate.parent?.id ?? null
      })
    });

    if (!response.ok) {
      return;
    }

    const updatedTags = (await response.json()) as TagItem[];
    setAvailableTags(updatedTags);
    const created = flattenTags(updatedTags).find(
      (tag) =>
        tag.name.toLowerCase() === createTagCandidate.name.toLowerCase() &&
        (tag.parentId ?? null) === (createTagCandidate.parent?.id ?? null)
    );

    if (created) {
      await assignManualTag(created.id);
    }
  }

  function confirmActiveTagOption(index = activeTagOptionIndex) {
    const option = tagAutocompleteOptions[index];
    if (!option) {
      return;
    }

    if (option.type === "tag") {
      void assignManualTag(option.tag.id);
      return;
    }

    void createAndAssignTag();
  }

  async function updateTagAssignment(assignmentId: string, action: "accept" | "reject" | "remove") {
    if (!detail) {
      return;
    }

    const response =
      action === "remove"
        ? await fetch(`/api/recordings/${detail.id}/tags`, {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ assignmentId })
          })
        : await fetch(`/api/recordings/${detail.id}/tags`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ assignmentId, action })
          });

    if (!response.ok) {
      return;
    }

    const updated = (await response.json()) as RecordingDetail;
    onTitleUpdated(updated);
  }

  function startEditingSpeaker(sentenceId: string, speaker: string | null) {
    isEditingSpeakerRef.current = true;
    if (scrollFrameRef.current !== null) {
      cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = null;
    }
    setEditingSpeakerSentenceId(sentenceId);
    setSpeakerDraft(normalizeSpeakerLabel(speaker));
  }

  async function saveSpeakerName(oldSpeaker: string | null) {
    if (!detail) {
      return;
    }

    const nextSpeaker = speakerDraft.trim();
    if (!nextSpeaker || nextSpeaker === normalizeSpeakerLabel(oldSpeaker)) {
      setEditingSpeakerSentenceId(null);
      setSpeakerDraft("");
      isEditingSpeakerRef.current = false;
      return;
    }

    const speakerKey = getSpeakerKey(oldSpeaker);
    setSavingSpeakerKey(speakerKey);

    try {
      const response = await fetch(`/api/recordings/${detail.id}/speakers`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          newSpeaker: nextSpeaker,
          oldSpeaker
        })
      });

      if (!response.ok) {
        return;
      }

      const updated = (await response.json()) as RecordingDetail;
      onTitleUpdated(updated);
      setEditingSpeakerSentenceId(null);
      setSpeakerDraft("");
      isEditingSpeakerRef.current = false;
    } finally {
      setSavingSpeakerKey(null);
    }
  }

  async function copyExport(kind: "transcript" | "sentences") {
    if (!detail || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    const payload =
      kind === "transcript"
        ? transcriptText
        : detail.sentences.length > 0
          ? detail.sentences
              .map(
                (sentence) =>
                  `${formatSentenceOffset(sentence.startMs)} ${normalizeSpeakerLabel(sentence.speaker)}\n${sentence.text}`
              )
              .join("\n\n")
          : transcriptText;

    try {
      await navigator.clipboard.writeText(payload);
      setExportFeedback(kind === "transcript" ? "Transcript copied" : "Sentences copied");
      setIsExportMenuOpen(false);
      setIsActionsMenuOpen(false);
      window.setTimeout(() => setExportFeedback(null), 1800);
    } catch {
      setExportFeedback("Copy failed");
      setIsExportMenuOpen(false);
      setIsActionsMenuOpen(false);
      window.setTimeout(() => setExportFeedback(null), 1800);
    }
  }

  function buildRecordingMarkdown() {
    if (!detail) {
      return "";
    }

    const sentenceBlock =
      detail.sentences.length > 0
        ? detail.sentences
            .map((sentence) => `**${formatSentenceOffset(sentence.startMs)} ${sentence.speaker ?? "Speaker"}**\n\n${sentence.text}`)
            .join("\n\n")
        : detail.transcript ?? detail.summary ?? "";
    const tagList = detail.tags.length > 0 ? detail.tags.map((tag) => tag.tagName).join(", ") : "--";

    return [
      "# EchoTrace Recording Export",
      "",
      `Exported: ${new Date().toISOString()}`,
      "",
      `## ${detail.title}`,
      "",
      `- ID: \`${detail.id}\``,
      `- Source: ${detail.source ?? "--"}`,
      `- Category: ${detail.category ?? "--"}`,
      `- Location: ${detail.locationName ?? "--"}`,
      `- Started: ${detail.startedAt}`,
      `- Ended: ${detail.endedAt}`,
      `- Duration: ${formatDuration(detail.startedAt, detail.endedAt)}`,
      `- Language: ${detail.transcriptLanguage ?? "--"}`,
      `- Review Status: ${detail.reviewStatus}`,
      `- AssemblyAI Transcript ID: ${detail.assemblyAiTranscriptId ?? "--"}`,
      `- Tags: ${tagList}`,
      "",
      "### Notes",
      "",
      detail.notes?.trim() || "_No notes available._",
      "",
      "### Sentences",
      "",
      sentenceBlock || "_No transcript or sentences available._"
    ].join("\n");
  }

  function buildRecordingMarkdownFilename() {
    const safeTitle = detail?.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48);
    return `echotrace-recording-${safeTitle || detail?.id || "export"}.md`;
  }

  function buildRecordingAudioFilename() {
    return `${detail?.id || "recording"}.mp3`;
  }

  function downloadRecordingMarkdown() {
    const payload = buildRecordingMarkdown();
    if (!payload) {
      return;
    }

    downloadTextFile(payload, buildRecordingMarkdownFilename(), "text/markdown;charset=utf-8");
    setExportFeedback("Markdown downloaded");
    setIsExportMenuOpen(false);
    setIsActionsMenuOpen(false);
    window.setTimeout(() => setExportFeedback(null), 1800);
  }

  function downloadRecordingAudio() {
    if (!detail?.audioUrl) {
      return;
    }

    const url = detail.audioUrl.startsWith("/api/audio/") ? `${detail.audioUrl}?download=1` : detail.audioUrl;
    const link = document.createElement("a");
    link.href = url;
    link.download = buildRecordingAudioFilename();
    document.body.append(link);
    link.click();
    link.remove();
    setExportFeedback("Audio download started");
    setIsExportMenuOpen(false);
    setIsActionsMenuOpen(false);
    window.setTimeout(() => setExportFeedback(null), 1800);
  }

  async function loadPrompts() {
    if (prompts.length > 0 || isLoadingPrompts) {
      return;
    }

    setIsLoadingPrompts(true);
    try {
      const response = await fetch("/api/prompts", { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as PromptItem[];
      setPrompts(payload);
      setSelectedPromptId((current) => current || payload[0]?.id || "");
    } finally {
      setIsLoadingPrompts(false);
    }
  }

  function openPromptDialog() {
    setIsPromptDialogOpen(true);
    setIsActionsMenuOpen(false);
    setPromptRunResult(null);
    setPromptRunError(null);
    void loadPrompts();
  }

  function openNoteDialog() {
    setNoteDraft(detail?.notes ?? "");
    setIsNoteDialogOpen(true);
    setIsActionsMenuOpen(false);
  }

  async function saveNote() {
    if (!detail || isSavingNote) {
      return;
    }

    setIsSavingNote(true);

    try {
      const response = await fetch(`/api/recordings/${detail.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ notes: noteDraft.trim().length > 0 ? noteDraft : null })
      });

      if (!response.ok) {
        return;
      }

      const updated = (await response.json()) as RecordingDetail;
      onTitleUpdated(updated);
      onReviewStatusUpdated(updated);
      setNoteDraft(updated.notes ?? "");
      setIsNoteDialogOpen(false);
    } finally {
      setIsSavingNote(false);
    }
  }

  async function sendRecordingToPrompt() {
    if (!detail || !selectedPromptId) {
      return;
    }

    setIsSendingPrompt(true);
    setPromptRunResult(null);
    setPromptRunError(null);

    try {
      const formData = new FormData();
      formData.append("filename", buildRecordingMarkdownFilename());
      formData.append("markdown", buildRecordingMarkdown());
      formData.append("promptId", selectedPromptId);
      for (const attachment of promptAttachments) {
        formData.append("attachments", attachment, attachment.name);
      }

      const response = await fetch("/api/prompt-runs", {
        method: "POST",
        body: formData
      });

      const payload = (await response.json()) as { message?: string; response?: unknown; status?: number };
      if (!response.ok) {
        setPromptRunError(payload.message ?? "Prompt run failed");
        setPromptRunResult(extractPromptRunMessage(payload.response ?? payload));
        return;
      }

      setPromptRunResult(extractPromptRunMessage(payload.response ?? payload));
    } catch (error) {
      setPromptRunError(error instanceof Error ? error.message : "Prompt run failed");
    } finally {
      setIsSendingPrompt(false);
    }
  }

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.paused) {
      isEditingSpeakerRef.current = false;
      void audio.play();
      return;
    }

    audio.pause();
  }

  function seekTo(nextMs: number) {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const { durationAudioMs, effectiveDurationMs } = timingRef.current;
    const maxDuration = effectiveDurationMs || durationAudioMs || nextMs;
    const clampedMs = Math.max(0, Math.min(nextMs, maxDuration));
    isSeekingRef.current = true;
    isEditingSpeakerRef.current = false;
    setCurrentAudioMs(clampedMs);

    if (audio.readyState < HTMLMediaElement.HAVE_METADATA || durationAudioMs <= 0) {
      pendingSeekMsRef.current = clampedMs;
      return;
    }

    audio.currentTime = timelineMsToSourceAudioMs(clampedMs) / 1000;
  }

  function skipBy(deltaMs: number) {
    seekTo(currentAudioMs + deltaMs);
  }

  function toggleActionsMenu() {
    if (isActionsMenuOpen) {
      setIsActionsMenuOpen(false);
      return;
    }

    const rect = actionsMenuButtonRef.current?.getBoundingClientRect();
    if (rect) {
      setActionsMenuPosition({
        right: Math.max(12, window.innerWidth - rect.right),
        top: rect.bottom + 8
      });
    }
    setIsActionsMenuOpen(true);
  }

  const hasNote = Boolean(detail.notes?.trim());

  return (
    <ModalFrame onClose={onClose}>
      <div className="sticky top-[calc(-1rem-1px)] z-40 -mx-4 -mt-4 border-y border-white/70 bg-[rgba(248,250,252,0.94)] px-4 pb-3 pt-1 shadow-[0_16px_34px_rgba(15,23,42,0.08)] backdrop-blur md:top-[calc(-2rem-1px)] md:-mx-8 md:-mt-8 md:px-8 md:pb-4 md:pt-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {isEditingTitle ? (
              <div className="flex min-w-0 max-w-3xl flex-1 flex-wrap items-center gap-2">
                <input
                  autoFocus
                  className="min-w-0 w-full flex-1 rounded-2xl border border-[var(--line-strong)] bg-white px-4 py-3 text-[24px] font-semibold tracking-[-0.04em] text-[var(--text)] outline-none sm:text-[34px] md:text-[52px]"
                  disabled={isSavingTitle}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void saveTitle();
                    }

                    if (event.key === "Escape") {
                      setIsEditingTitle(false);
                      setTitleDraft(detail.customTitle ?? "");
                    }
                  }}
                  placeholder={detail.title}
                  value={titleDraft}
                />
                <button
                  className="cursor-pointer rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={isSavingTitle}
                  onClick={() => void saveTitle()}
                  type="button"
                >
                  {isSavingTitle ? "Saving..." : "Save"}
                </button>
                <button
                  className="cursor-pointer rounded-full border border-[var(--line-strong)] bg-white px-4 py-2 text-sm font-semibold text-[var(--muted)]"
                  disabled={isSavingTitle}
                  onClick={() => {
                    setIsEditingTitle(false);
                    setTitleDraft(detail.customTitle ?? "");
                  }}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className="block min-w-0 max-w-4xl cursor-pointer truncate rounded-2xl text-left text-[22px] font-semibold leading-tight tracking-[-0.035em] text-[var(--text)] transition hover:bg-white/50 sm:text-[42px] sm:leading-[1.02] sm:tracking-[-0.06em] sm:hover:px-2 sm:hover:py-1 md:text-[64px]"
                onClick={() => setIsEditingTitle(true)}
                type="button"
              >
                {detail.title}
              </button>
            )}
            <p className="mt-1 truncate text-xs leading-5 text-[var(--muted)] sm:text-sm">
              {DATE_FORMATTER.format(new Date(detail.startedAt))} · {formatTime(detail.startedAt)} to{" "}
              {formatTime(detail.endedAt)} ·{" "}
              {formatDuration(detail.startedAt, detail.endedAt)}
            </p>
          </div>
          <div className="flex shrink-0 items-start justify-end gap-2">
            {exportFeedback ? <span className="text-xs font-semibold text-[var(--accent)]">{exportFeedback}</span> : null}
            <button
              className="hidden cursor-pointer items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3 py-1.5 text-xs font-semibold text-[var(--text)] transition hover:bg-white sm:inline-flex"
              onClick={openPromptDialog}
              type="button"
            >
              <PromptIcon />
              Send to Prompt
            </button>
            {!hasNote ? (
              <button
                className="hidden cursor-pointer items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3 py-1.5 text-xs font-semibold text-[var(--text)] transition hover:bg-white sm:inline-flex"
                onClick={openNoteDialog}
                type="button"
              >
                <NoteIcon />
                Add Note
              </button>
            ) : null}
            <div className="relative hidden sm:block">
              <button
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3 py-1.5 text-xs font-semibold text-[var(--text)] transition hover:bg-white"
                onClick={() => setIsExportMenuOpen((value) => !value)}
                type="button"
              >
                <ExportIcon />
                Export
              </button>
              {isExportMenuOpen ? (
                <div className="absolute right-0 top-[calc(100%+8px)] z-20 min-w-[230px] rounded-[18px] border border-white/80 bg-white/96 p-2 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur">
                  <ExportMenuButton label="Copy transcript" onClick={() => void copyExport("transcript")} />
                  <ExportMenuButton label="Copy sentences" onClick={() => void copyExport("sentences")} />
                  <ExportMenuButton label="Download Markdown" onClick={downloadRecordingMarkdown} />
                  <ExportMenuButton disabled={!detail.audioUrl} label="Download Audiofile" onClick={downloadRecordingAudio} />
                </div>
              ) : null}
            </div>
            <div className="relative sm:hidden">
              <button
                aria-label="Open recording actions"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white bg-white text-[var(--text)] shadow-[0_10px_22px_rgba(15,23,42,0.08)] transition hover:bg-white"
                onClick={toggleActionsMenu}
                ref={actionsMenuButtonRef}
                type="button"
              >
                <MenuIcon />
              </button>
            </div>
            <button
              aria-label="Close details"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[rgba(248,113,113,0.35)] bg-[rgba(254,242,242,0.98)] text-[rgba(185,28,28,0.98)] shadow-[0_10px_22px_rgba(185,28,28,0.1)] transition hover:border-[rgba(248,113,113,0.55)] hover:bg-[rgba(254,226,226,0.98)]"
              onClick={onClose}
              type="button"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      </div>

      {detail.reviewStatus === "pending_review" ? (
        <div className="mt-4 rounded-[18px] border border-[rgba(245,158,11,0.28)] bg-[rgba(255,251,235,0.96)] p-3 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur md:rounded-[22px] md:px-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(180,83,9,0.95)]">Pending review</p>
              <p className="mt-1 text-xs text-[var(--muted)]">Approve or reject this recording.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <ReviewActionButton
                active={false}
                disabled={isSavingReviewStatus}
                label="Approve"
                onClick={() => void saveReviewStatus("approved")}
              />
              <ReviewActionButton
                active={false}
                disabled={isSavingReviewStatus}
                label="Reject"
                onClick={() => void saveReviewStatus("rejected")}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <MetaCard label="Language" value={detail.transcriptLanguage ?? "--"} />
        <MetaCard label="Source" value={detail.source ?? "--"} />
        <MetaCard label="Status" value={detail.status ?? "--"} />
        <TypeMetaCard
          isOpen={isTypeMenuOpen}
          isSaving={isSavingType}
          onChange={(category) => void saveRecordingType(category)}
          onToggle={() => setIsTypeMenuOpen((current) => !current)}
          value={detail.category}
        />
      </div>

      {hasNote ? (
        <div className="mt-5 rounded-[20px] border border-[rgba(226,232,240,0.95)] bg-white/88 p-3 md:rounded-[24px] md:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Notes</p>
            <button
              className="cursor-pointer rounded-full border border-[var(--line-strong)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text)] transition hover:bg-[rgba(59,130,246,0.08)]"
              onClick={openNoteDialog}
              type="button"
            >
              Edit
            </button>
          </div>
          <div className="mt-4 rounded-[18px] bg-[rgba(248,250,252,0.9)] p-4">
            <MarkdownResponse content={detail.notes ?? ""} />
          </div>
        </div>
      ) : null}

      <div className="mt-5 rounded-[20px] border border-white/80 bg-white/80 p-3 md:rounded-[24px] md:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Tags</p>
          </div>
        </div>
        <div className="relative mt-4">
          <div className="flex items-center gap-2 rounded-[18px] border border-[rgba(226,232,240,0.95)] bg-white px-3 py-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
              <PlusIcon />
            </span>
            <input
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text)] outline-none"
              onChange={(event) => {
                setTagQuery(event.target.value);
                setIsTagPickerOpen(true);
                setActiveTagOptionIndex(0);
              }}
              onFocus={() => {
                setIsTagPickerOpen(true);
                setActiveTagOptionIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setIsTagPickerOpen(true);
                  setActiveTagOptionIndex((current) =>
                    tagAutocompleteOptions.length === 0 ? 0 : (current + 1) % tagAutocompleteOptions.length
                  );
                  return;
                }

                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setIsTagPickerOpen(true);
                  setActiveTagOptionIndex((current) =>
                    tagAutocompleteOptions.length === 0
                      ? 0
                      : (current - 1 + tagAutocompleteOptions.length) % tagAutocompleteOptions.length
                  );
                  return;
                }

                if (event.key === "Enter") {
                  event.preventDefault();
                  confirmActiveTagOption();
                  return;
                }

                if (event.key === "Escape") {
                  setIsTagPickerOpen(false);
                }
              }}
              placeholder="Add tag…"
              value={tagQuery}
            />
          </div>
          {isTagPickerOpen && (matchingTags.length > 0 || createTagCandidate) ? (
            <div
              className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 rounded-[18px] border border-[rgba(226,232,240,0.92)] bg-white/98 p-2 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur"
              role="listbox"
            >
              {matchingTags.map((tag, index) => (
                <button
                  key={tag.id}
                  className={`flex w-full cursor-pointer items-start rounded-[14px] px-3 py-2 text-left transition ${
                    activeTagOptionIndex === index ? "bg-[rgba(59,130,246,0.1)] ring-1 ring-[rgba(59,130,246,0.22)]" : "hover:bg-[rgba(59,130,246,0.08)]"
                  }`}
                  onClick={() => void assignManualTag(tag.id)}
                  onMouseEnter={() => setActiveTagOptionIndex(index)}
                  role="option"
                  aria-selected={activeTagOptionIndex === index}
                  type="button"
                >
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">{tag.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{tag.pathLabel}</p>
                  </div>
                </button>
              ))}
              {createTagCandidate ? (
                <button
                  className={`mt-1 flex w-full cursor-pointer items-start rounded-[14px] border border-dashed px-3 py-2 text-left transition ${
                    activeTagOptionIndex === matchingTags.length
                      ? "border-[rgba(37,99,235,0.42)] bg-[rgba(219,234,254,0.9)] ring-1 ring-[rgba(37,99,235,0.22)]"
                      : "border-[rgba(37,99,235,0.28)] bg-[rgba(239,246,255,0.72)] hover:bg-[rgba(219,234,254,0.84)]"
                  }`}
                  onClick={() => void createAndAssignTag()}
                  onMouseEnter={() => setActiveTagOptionIndex(matchingTags.length)}
                  role="option"
                  aria-selected={activeTagOptionIndex === matchingTags.length}
                  type="button"
                >
                  <div>
                    <p className="text-sm font-semibold text-[var(--accent)]">
                      {createTagCandidate.parent
                        ? `Create new tag ${createTagCandidate.name} in ${createTagCandidate.parent.name}`
                        : `Create new tag ${createTagCandidate.name}`}
                    </p>
                    {createTagCandidate.pathLabel ? (
                      <p className="mt-0.5 text-xs text-[var(--muted)]">{createTagCandidate.pathLabel}</p>
                    ) : null}
                  </div>
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {detail.tags.length === 0 ? (
            <p className="text-sm leading-7 text-[var(--muted)]">No tags are currently assigned to this recording.</p>
          ) : (
            detail.tags.map((tag) => (
              <span
                key={tag.id}
                className={`group inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${getTagChipClass(
                  tag.source,
                  tag.state
                )}`}
                title={`${tag.tagName} · ${tag.source} · ${tag.state.replaceAll("_", " ")}`}
              >
                <span>{tag.tagName}</span>
                {tag.state === "proposal" ? (
                  <span className="inline-flex items-center gap-1">
                    <button
                      className="rounded-full bg-[rgba(21,128,61,0.9)] px-2 py-0.5 text-[10px] font-semibold text-white"
                      onClick={() => void updateTagAssignment(tag.id, "accept")}
                      type="button"
                    >
                      Accept
                    </button>
                    <button
                      className="rounded-full bg-[rgba(185,28,28,0.9)] px-2 py-0.5 text-[10px] font-semibold text-white"
                      onClick={() => void updateTagAssignment(tag.id, "reject")}
                      type="button"
                    >
                      Reject
                    </button>
                  </span>
                ) : (
                  <button
                    className="text-xs leading-none opacity-60 transition hover:opacity-100"
                    onClick={() => void updateTagAssignment(tag.id, "remove")}
                    type="button"
                  >
                    ×
                  </button>
                )}
              </span>
            ))
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--muted)]">
          <TagLegendSwatch label="Manual" className="border-[rgba(59,130,246,0.24)] bg-[rgba(239,246,255,0.98)] text-[rgba(30,64,175,0.96)]" />
          <TagLegendSwatch label="Automatic" className="border-[rgba(34,197,94,0.24)] bg-[rgba(240,253,244,0.98)] text-[rgba(21,128,61,0.95)]" />
          <TagLegendSwatch label="Proposal" className="border-[rgba(245,158,11,0.28)] bg-[rgba(255,251,235,0.98)] text-[rgba(180,83,9,0.95)]" />
        </div>
      </div>

      <div className="mt-5 rounded-[20px] border border-white/80 bg-white/80 p-3 md:rounded-[24px] md:p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Audio</p>
        {detail.audioUrl ? (
          <>
            <audio
              className="hidden"
              ref={audioRef}
              preload="metadata"
              src={detail.audioUrl}
              onLoadedMetadata={(event) => {
                const durationMs = Number.isFinite(event.currentTarget.duration)
                  ? event.currentTarget.duration * 1000
                  : 0;
                const nextEffectiveDurationMs =
                  transcriptDurationMs !== null && durationMs > 0 ? transcriptDurationMs : transcriptDurationMs ?? durationMs;
                const nextTimelineScale =
                  transcriptDurationMs !== null && durationMs > 0 ? transcriptDurationMs / durationMs : 1;
                const nextPlaybackRate =
                  transcriptDurationMs !== null && durationMs > 0 && transcriptDurationMs < durationMs
                    ? durationMs / transcriptDurationMs
                    : 1;

                timingRef.current = {
                  durationAudioMs: durationMs,
                  effectiveDurationMs: nextEffectiveDurationMs,
                  timelineScale: nextTimelineScale
                };
                setDurationAudioMs(durationMs);
                event.currentTarget.playbackRate = nextPlaybackRate;

                if (pendingSeekMsRef.current !== null) {
                  const pendingSeekMs = Math.max(
                    0,
                    Math.min(pendingSeekMsRef.current, nextEffectiveDurationMs || pendingSeekMsRef.current)
                  );
                  event.currentTarget.currentTime =
                    (nextTimelineScale > 0 ? pendingSeekMs / nextTimelineScale : pendingSeekMs) / 1000;
                  setCurrentAudioMs(pendingSeekMs);
                  pendingSeekMsRef.current = null;
                  return;
                }

                syncCurrentAudioMs();
              }}
              onPause={() => setIsPlaying(false)}
              onPlay={() => {
                setIsPlaying(true);
                syncCurrentAudioMs();
              }}
              onSeeked={() => {
                isSeekingRef.current = false;
                syncCurrentAudioMs();
              }}
              onSeeking={() => {
                isSeekingRef.current = true;
              }}
              onTimeUpdate={() => {
                if (!isSeekingRef.current) {
                  syncCurrentAudioMs();
                }
              }}
            />
            <div className="mt-3 rounded-[20px] border border-[rgba(226,232,240,0.92)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.98)_100%)] p-3 shadow-[0_12px_28px_rgba(15,23,42,0.05)] md:rounded-[22px] md:p-4">
              <div className="flex flex-wrap items-center gap-2 md:gap-3">
                <button
                  className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-[0_12px_30px_rgba(37,99,235,0.18)] transition hover:bg-[#1d4ed8] md:h-14 md:w-14"
                  onClick={togglePlayback}
                  type="button"
                >
                  {isPlaying ? <PauseIcon /> : <PlayIcon />}
                </button>
                <button
                  className="cursor-pointer rounded-full border border-[rgba(226,232,240,0.95)] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)] transition hover:border-[rgba(148,163,184,0.55)]"
                  onClick={() => skipBy(-10000)}
                  type="button"
                >
                  -10s
                </button>
                <button
                  className="cursor-pointer rounded-full border border-[rgba(226,232,240,0.95)] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)] transition hover:border-[rgba(148,163,184,0.55)]"
                  onClick={() => skipBy(10000)}
                  type="button"
                >
                  +10s
                </button>
                <div className="w-full text-left sm:ml-auto sm:w-auto sm:text-right">
                  <p className="font-[family-name:var(--font-mono)] text-sm font-semibold text-[var(--text)]">
                    {formatSentenceOffset(currentAudioMs)} / {formatSentenceOffset(effectiveDurationMs)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {detail.source ?? "Audio stream"}
                    {playbackRate > 1.001 ? ` · ${playbackRate.toFixed(3)}x` : ""}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <input
                  className="audio-slider h-2 w-full cursor-pointer appearance-none rounded-full bg-[rgba(226,232,240,0.95)]"
                  max={Math.max(effectiveDurationMs, 1)}
                  min={0}
                  onChange={(event) => seekTo(Number(event.target.value))}
                  onInput={(event) => setCurrentAudioMs(Number(event.currentTarget.value))}
                  type="range"
                  value={Math.min(currentAudioMs, Math.max(effectiveDurationMs, 1))}
                />
              </div>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            No public audio link is configured. For production, add `AUDIO_PUBLIC_MODE` and
            `AUDIO_PUBLIC_BASE_URL` or provide a proxy endpoint.
          </p>
        )}
      </div>

      <div className="mt-5 rounded-[20px] border border-white/80 bg-white/80 p-3 md:rounded-[24px] md:p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Sentences</p>
          <p className="text-xs text-[var(--muted)]">{detail.sentences.length} segments</p>
        </div>
        <div ref={sentenceListRef} className="mt-3 flex max-h-[320px] flex-col gap-3 overflow-y-auto pr-1 md:max-h-[360px]">
          {detail.sentences.length === 0 ? (
            <p className="text-sm leading-7 text-[var(--muted)]">
              No segmented sentences are available for this recording yet.
            </p>
          ) : (
            detail.sentences.map((sentence) => {
              const isActive = sentence.id === activeSentenceId;
              const speakerKey = getSpeakerKey(sentence.speaker);
              const isEditingSpeaker = editingSpeakerSentenceId === sentence.id;

              return (
                <div
                  key={sentence.id}
                  ref={(node) => {
                    sentenceRefs.current[sentence.id] = node;
                  }}
                  className={`rounded-[18px] border p-3 transition ${
                    isActive
                      ? "border-[rgba(59,130,246,0.36)] bg-[linear-gradient(180deg,rgba(239,246,255,0.98)_0%,rgba(219,234,254,0.98)_100%)] shadow-[0_10px_24px_rgba(59,130,246,0.14)]"
                      : "border-[var(--line)] bg-[rgba(248,250,252,0.96)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--muted)]">
                      {formatSentenceOffset(sentence.startMs)} - {formatSentenceOffset(sentence.endMs)}
                    </span>
                    {isEditingSpeaker ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(15,23,42,0.12)] bg-white px-2 py-1 shadow-[0_8px_18px_rgba(15,23,42,0.08)]">
                        <input
                          autoFocus
                          className="w-28 bg-transparent text-[11px] font-semibold text-[var(--text)] outline-none"
                          disabled={savingSpeakerKey === speakerKey}
                          onChange={(event) => setSpeakerDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void saveSpeakerName(sentence.speaker);
                            }

                            if (event.key === "Escape") {
                              setEditingSpeakerSentenceId(null);
                              setSpeakerDraft("");
                              isEditingSpeakerRef.current = false;
                            }
                          }}
                          value={speakerDraft}
                        />
                        <button
                          className="cursor-pointer rounded-full bg-[rgba(15,23,42,0.92)] px-2 py-0.5 text-[10px] font-semibold text-white disabled:opacity-60"
                          disabled={savingSpeakerKey === speakerKey}
                          onClick={() => void saveSpeakerName(sentence.speaker)}
                          type="button"
                        >
                          Save
                        </button>
                      </span>
                    ) : (
                      <button
                        className={`group/speaker inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold shadow-[0_8px_18px_rgba(15,23,42,0.08)] transition hover:scale-[1.02] ${getSpeakerChipClass(
                          speakerKey,
                          speakerColorByKey
                        )}`}
                        onClick={() => startEditingSpeaker(sentence.id, sentence.speaker)}
                        title="Edit speaker name"
                        type="button"
                      >
                        <span>{normalizeSpeakerLabel(sentence.speaker)}</span>
                        <span className="hidden text-[9px] opacity-80 group-hover/speaker:inline">Edit</span>
                      </button>
                    )}
                  </div>
                  <p className="mt-3 text-sm leading-6">{sentence.text}</p>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-5 rounded-[20px] border border-white/80 bg-white/80 p-3 md:rounded-[24px] md:p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Transcript</p>
          {shouldClamp ? (
            <button
              className="cursor-pointer rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]"
              onClick={() => setIsExpanded((value) => !value)}
              type="button"
            >
              {isExpanded ? "Less" : "Read more"}
            </button>
          ) : null}
        </div>
        <p className={`mt-3 text-sm leading-7 text-[var(--text)] ${!isExpanded ? "line-clamp-5" : ""}`}>
          {transcriptText}
        </p>
      </div>

      {detail.reviewStatus !== "pending_review" ? (
        <div className="mt-5 rounded-[18px] border border-[rgba(226,232,240,0.92)] bg-white/80 p-3 md:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Review</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text)]">{formatReviewStatus(detail.reviewStatus)}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:flex">
              <ReviewActionButton
                compact
                active={detail.reviewStatus === "approved"}
                disabled={isSavingReviewStatus}
                label="Approve"
                onClick={() => void saveReviewStatus("approved")}
              />
              <ReviewActionButton
                compact
                active={false}
                disabled={isSavingReviewStatus}
                label="Pending"
                onClick={() => void saveReviewStatus("pending_review")}
              />
              <ReviewActionButton
                compact
                active={detail.reviewStatus === "rejected"}
                disabled={isSavingReviewStatus}
                label="Reject"
                onClick={() => void saveReviewStatus("rejected")}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-5 rounded-[18px] border border-[rgba(226,232,240,0.92)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.98)_100%)] p-3 shadow-[0_12px_30px_rgba(15,23,42,0.04)] md:p-4">
        <button
          className="flex w-full cursor-pointer items-center justify-between gap-3 text-left"
          onClick={() => setIsPipelineExpanded((value) => !value)}
          type="button"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Pipeline Status</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <InlineStatusChip
                label="Location"
                onClick={() => void savePipelineStatus("locationStatus", "pending")}
                value={detail.locationStatus ?? "--"}
              />
              <InlineStatusChip
                label="Transcription"
                onClick={() => void savePipelineStatus("transcriptionStatus", transcriptionNextStatus)}
                value={detail.transcriptionStatus ?? "--"}
              />
              <InlineStatusChip
                label="Title"
                onClick={() => void savePipelineStatus("titleProposalStatus", "pending")}
                value={detail.titleProposalStatus ?? "--"}
              />
              <InlineStatusChip
                label="Tags"
                onClick={() => void savePipelineStatus("tagProposalStatus", "pending")}
                value={detail.tagProposalStatus ?? "--"}
              />
              <InlineStatusChip
                label="Category"
                onClick={() => void savePipelineStatus("categoryStatus", "pending")}
                value={detail.categoryStatus ?? "--"}
              />
            </div>
          </div>
          <span className="rounded-full border border-[rgba(59,130,246,0.12)] bg-[rgba(59,130,246,0.08)] px-3 py-1 text-[11px] font-semibold text-[var(--accent)]">
            {isPipelineExpanded ? "Less" : "Expand"}
          </span>
        </button>

        {isPipelineExpanded ? (
          <div className="mt-4 grid gap-2">
            <PipelineStatusRow
              label="Location"
              onAction={() => void savePipelineStatus("locationStatus", "pending")}
              value={detail.locationStatus ?? "--"}
            />
            <PipelineStatusRow
              label="Transcription"
              actionLabel={transcriptionActionLabel}
              onAction={() => void savePipelineStatus("transcriptionStatus", transcriptionNextStatus)}
              value={detail.transcriptionStatus ?? "--"}
            />
            <PipelineStatusRow
              label="Title Proposal"
              onAction={() => void savePipelineStatus("titleProposalStatus", "pending")}
              value={detail.titleProposalStatus ?? "--"}
            />
            <PipelineStatusRow
              label="Tag Proposal"
              onAction={() => void savePipelineStatus("tagProposalStatus", "pending")}
              value={detail.tagProposalStatus ?? "--"}
            />
            <PipelineStatusRow
              label="Category"
              onAction={() => void savePipelineStatus("categoryStatus", "pending")}
              value={detail.categoryStatus ?? "--"}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-5 rounded-[20px] border border-white/80 bg-white/80 p-3 md:rounded-[24px] md:p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Logs</p>
          <p className="text-xs text-[var(--muted)]">{detail.logs.length} entries</p>
        </div>
        <div className="mt-3 flex max-h-[240px] flex-col gap-3 overflow-y-auto pr-1 md:max-h-[260px]">
          {detail.logs.length === 0 ? (
            <p className="text-sm leading-7 text-[var(--muted)]">
              There are currently no log entries for this recording.
            </p>
          ) : (
            detail.logs.map((log) => (
              <div key={log.id} className="rounded-[18px] border border-[var(--line)] bg-[rgba(248,250,252,0.96)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[rgba(15,23,42,0.06)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                      {log.logger}
                    </span>
                    {log.level ? (
                      <span className="rounded-full bg-[rgba(37,99,235,0.08)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
                        {log.level}
                      </span>
                    ) : null}
                  </div>
                  <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--muted)]">
                    {LOG_DATE_FORMATTER.format(new Date(log.createdAt))}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--text)]">{log.message}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-3 text-xs text-[var(--muted)] sm:grid-cols-3">
        <IdField label="ID" value={detail.id} />
        <IdField label="Source Recording ID" value={detail.source ?? "--"} />
        <IdField label="AssemblyAI Transcript ID" value={detail.assemblyAiTranscriptId ?? "--"} />
      </div>
      {isActionsMenuOpen && actionsMenuPosition && typeof document !== "undefined"
        ? createPortal(
            <>
              <button
                aria-label="Close recording actions"
                className="fixed inset-0 z-[80] cursor-default"
                onClick={() => setIsActionsMenuOpen(false)}
                type="button"
              />
              <div
                className="fixed z-[90] min-w-[230px] overflow-hidden rounded-[18px] border border-[rgba(226,232,240,0.95)] bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.18)] sm:hidden"
                style={{
                  right: actionsMenuPosition.right,
                  top: actionsMenuPosition.top
                }}
              >
                {!hasNote ? <ExportMenuButton label="Add Note" onClick={openNoteDialog} /> : null}
                <ExportMenuButton label="Send to Prompt" onClick={openPromptDialog} />
                <ExportMenuButton label="Copy transcript" onClick={() => void copyExport("transcript")} />
                <ExportMenuButton label="Copy sentences" onClick={() => void copyExport("sentences")} />
                <ExportMenuButton label="Download Markdown" onClick={downloadRecordingMarkdown} />
                <ExportMenuButton disabled={!detail.audioUrl} label="Download Audiofile" onClick={downloadRecordingAudio} />
              </div>
            </>,
            document.body
          )
        : null}
      {isPromptDialogOpen ? (
        <PromptRunDialog
          isLoadingPrompts={isLoadingPrompts}
          isSending={isSendingPrompt}
          onClose={() => setIsPromptDialogOpen(false)}
          onCopyResult={async () => {
            if (promptRunResult) {
              await copyTextToClipboard(promptRunResult);
            }
          }}
          onDownloadResult={() =>
            promptRunResult
              ? downloadTextFile(
                  promptRunResult,
                  `echotrace-prompt-response-${new Date().toISOString().slice(0, 10)}.md`,
                  "text/markdown;charset=utf-8"
                )
              : undefined
          }
          onSend={() => void sendRecordingToPrompt()}
          promptAttachments={promptAttachments}
          prompts={prompts}
          result={promptRunResult}
          runError={promptRunError}
          selectedPromptId={selectedPromptId}
          setPromptAttachments={setPromptAttachments}
          setSelectedPromptId={setSelectedPromptId}
        />
      ) : null}
      {isNoteDialogOpen ? (
        <NoteDialog
          draft={noteDraft}
          isSaving={isSavingNote}
          onChange={setNoteDraft}
          onClose={() => setIsNoteDialogOpen(false)}
          onSave={() => void saveNote()}
        />
      ) : null}
    </ModalFrame>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[var(--line)] bg-[rgba(248,250,252,0.92)] p-3 md:rounded-[20px] md:p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-3 text-sm font-semibold">{value}</p>
    </div>
  );
}

function IdField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[16px] border border-[rgba(226,232,240,0.72)] bg-white/60 px-3 py-2">
      <p className="font-semibold uppercase tracking-[0.16em]">{label}</p>
      <p className="mt-1 break-all font-[family-name:var(--font-mono)] leading-5">{value}</p>
    </div>
  );
}

function TypeMetaCard({
  isOpen,
  isSaving,
  onChange,
  onToggle,
  value
}: {
  isOpen: boolean;
  isSaving: boolean;
  onChange: (category: RecordingCategory) => void;
  onToggle: () => void;
  value: string | null;
}) {
  const options: RecordingCategory[] = ["work", "private"];

  return (
    <div className="relative rounded-[18px] border border-[var(--line)] bg-[rgba(248,250,252,0.92)] p-3 md:rounded-[20px] md:p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Type</p>
      <button
        aria-expanded={isOpen}
        className="mt-3 flex w-full cursor-pointer items-center justify-between gap-2 rounded-[12px] text-left text-sm font-semibold text-[var(--text)] outline-none transition hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSaving}
        onClick={onToggle}
        type="button"
      >
        <span>{formatRecordingCategory(value)}</span>
      </button>
      {isOpen ? (
        <div className="absolute left-3 right-3 top-[calc(100%-6px)] z-20 rounded-[14px] border border-white/80 bg-white/98 p-1.5 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur">
          {options.map((option) => (
            <button
              className={`flex w-full cursor-pointer items-center justify-between rounded-[10px] px-2.5 py-2 text-left text-xs font-semibold transition ${
                value === option
                  ? "bg-[rgba(59,130,246,0.1)] text-[var(--accent)]"
                  : "text-[var(--text)] hover:bg-[rgba(59,130,246,0.08)]"
              }`}
              disabled={isSaving}
              key={option}
              onClick={() => onChange(option)}
              type="button"
            >
              <span>{formatRecordingCategory(option)}</span>
              {value === option ? <span className="text-[10px] uppercase tracking-[0.12em]">Selected</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function formatRecordingCategory(category: string | null) {
  if (category === "work") {
    return "Work";
  }

  if (category === "private") {
    return "Private";
  }

  return "--";
}

function ExportMenuButton({ disabled = false, label, onClick }: { disabled?: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className="flex w-full cursor-pointer items-center whitespace-nowrap rounded-[12px] bg-[rgb(255,255,255)] px-3 py-2 text-left text-xs font-semibold text-[var(--text)] transition hover:bg-[rgba(59,130,246,0.08)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-[rgb(255,255,255)]"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function ExportIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16">
      <path d="M8 2.5v7m0 0 2.5-2.5M8 9.5 5.5 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" />
      <path d="M3 11.5v.75c0 .966.784 1.75 1.75 1.75h6.5c.966 0 1.75-.784 1.75-1.75v-.75" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16">
      <path d="M4.25 2.5h5.1L12.5 5.65v6.1c0 .966-.784 1.75-1.75 1.75h-6.5c-.966 0-1.75-.784-1.75-1.75v-7.5c0-.966.784-1.75 1.75-1.75Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.35" />
      <path d="M9.25 2.75V5.2c0 .828.672 1.5 1.5 1.5h1.5M5 9h6M5 11h4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.35" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16">
      <path d="M3 4.5h10M3 8h10M3 11.5h10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

function NoteDialog({
  draft,
  isSaving,
  onChange,
  onClose,
  onSave
}: {
  draft: string;
  isSaving: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-[rgba(15,23,42,0.2)] px-3 py-10 backdrop-blur-sm sm:items-center sm:px-4 sm:py-3">
      <button aria-label="Close note dialog" className="absolute inset-0 cursor-pointer" onClick={onClose} type="button" />
      <div className="relative z-10 max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-[24px] border border-white/80 bg-white/96 p-4 shadow-[0_28px_80px_rgba(15,23,42,0.22)] sm:rounded-[28px] sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Notes</p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text)] sm:text-2xl">Recording note</h2>
          </div>
          <button className="shrink-0 cursor-pointer rounded-full bg-[rgba(15,23,42,0.06)] px-3 py-1.5 text-sm font-semibold" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Markdown</span>
            <textarea
              autoFocus
              className="min-h-[220px] resize-y rounded-[18px] border border-[rgba(226,232,240,0.95)] bg-white px-4 py-3 text-sm leading-7 text-[var(--text)] outline-none transition focus:border-[rgba(37,99,235,0.42)]"
              disabled={isSaving}
              onChange={(event) => onChange(event.target.value)}
              placeholder="Add a note..."
              value={draft}
            />
          </label>

          {draft.trim().length > 0 ? (
            <div className="rounded-[18px] border border-[rgba(226,232,240,0.92)] bg-[rgba(248,250,252,0.86)] p-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Preview</p>
              <MarkdownResponse content={draft} />
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <button
              className="cursor-pointer rounded-full border border-[var(--line-strong)] bg-white px-4 py-2 text-sm font-semibold text-[var(--muted)]"
              disabled={isSaving}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="cursor-pointer rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSaving}
              onClick={onSave}
              type="button"
            >
              {isSaving ? "Saving..." : "Save note"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PromptRunDialog({
  isLoadingPrompts,
  isSending,
  onClose,
  onCopyResult,
  onDownloadResult,
  onSend,
  promptAttachments,
  prompts,
  result,
  runError,
  selectedPromptId,
  setPromptAttachments,
  setSelectedPromptId
}: {
  isLoadingPrompts: boolean;
  isSending: boolean;
  onClose: () => void;
  onCopyResult: () => Promise<void> | void;
  onDownloadResult: () => void;
  onSend: () => void;
  promptAttachments: File[];
  prompts: PromptItem[];
  result: string | null;
  runError: string | null;
  selectedPromptId: string;
  setPromptAttachments: (files: File[]) => void;
  setSelectedPromptId: (id: string) => void;
}) {
  const hasResult = Boolean(result);
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied" | "error">("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isSending) {
      setElapsedSeconds(0);
      return;
    }

    setElapsedSeconds(0);
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);

    return () => window.clearInterval(timer);
  }, [isSending]);

  async function handleCopyResult() {
    setCopyState("copying");
    try {
      await onCopyResult();
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 2200);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[rgba(15,23,42,0.2)] px-3 py-3 backdrop-blur-sm sm:items-center sm:px-4">
      <button aria-label="Close prompt dialog" className="absolute inset-0 cursor-pointer" onClick={onClose} type="button" />
      <div className="relative z-10 max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-[24px] border border-white/80 bg-white/96 p-4 shadow-[0_28px_80px_rgba(15,23,42,0.22)] sm:rounded-[28px] sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Prompt Run</p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text)] sm:text-2xl">Send recording to prompt</h2>
          </div>
          <button className="shrink-0 cursor-pointer rounded-full bg-[rgba(15,23,42,0.06)] px-3 py-1.5 text-sm font-semibold" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          {!hasResult ? (
            <>
              <label className="grid gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Prompt</span>
                <select
                  className="h-12 min-w-0 max-w-full cursor-pointer rounded-2xl border border-[rgba(226,232,240,0.95)] bg-white px-3 text-sm font-semibold text-[var(--text)] shadow-[0_10px_24px_rgba(15,23,42,0.04)] outline-none transition hover:border-[rgba(148,163,184,0.55)] focus:border-[rgba(37,99,235,0.42)] sm:px-4 sm:text-base"
                  disabled={isLoadingPrompts || prompts.length === 0}
                  onChange={(event) => setSelectedPromptId(event.target.value)}
                  value={selectedPromptId}
                >
                  {isLoadingPrompts ? <option>Loading prompts...</option> : null}
                  {!isLoadingPrompts && prompts.length === 0 ? <option>No prompts configured</option> : null}
                  {prompts.map((prompt) => (
                    <option key={prompt.id} value={prompt.id}>
                      {prompt.title}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-[16px] border border-[rgba(226,232,240,0.92)] bg-white/80 p-3">
                <label className="grid cursor-pointer gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Optional files</span>
                  <input
                    className="block w-full min-w-0 max-w-full text-[11px] text-[var(--muted)] file:mb-2 file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-[var(--accent-soft)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[var(--accent)] sm:text-xs sm:file:mb-0"
                    multiple
                    onChange={(event) => setPromptAttachments(Array.from(event.target.files ?? []))}
                    type="file"
                  />
                </label>
                {promptAttachments.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {promptAttachments.map((file) => (
                      <span
                        key={`${file.name}-${file.size}-${file.lastModified}`}
                        className="rounded-full border border-[rgba(226,232,240,0.95)] bg-white px-2.5 py-1 text-[10px] font-semibold text-[var(--muted)]"
                      >
                        {file.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <button
                className="cursor-pointer rounded-2xl bg-[rgba(15,23,42,0.92)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSending || !selectedPromptId}
                onClick={onSend}
                type="button"
              >
                {isSending ? "Sending..." : "Send"}
              </button>
            </>
          ) : null}

          {isSending ? (
            <div className="flex items-center gap-3 rounded-[18px] border border-[rgba(37,99,235,0.2)] bg-[rgba(239,246,255,0.94)] px-4 py-3 text-sm font-medium text-[rgba(29,78,216,0.96)]">
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
                <span className="absolute h-9 w-9 animate-ping rounded-full bg-[rgba(37,99,235,0.18)]" />
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[rgba(37,99,235,0.22)] border-t-[rgba(37,99,235,0.98)]" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">Waiting for n8n response</span>
                <span className="mt-0.5 block text-xs text-[rgba(29,78,216,0.72)]" suppressHydrationWarning>
                  Running for {elapsedSeconds}s
                </span>
              </span>
            </div>
          ) : null}

          {runError ? (
            <div className="rounded-[16px] border border-[rgba(248,113,113,0.3)] bg-[rgba(254,242,242,0.94)] px-3 py-2 text-xs font-medium text-[rgba(185,28,28,0.95)]">
              {runError}
            </div>
          ) : null}

          {result ? (
            <div className="rounded-[18px] border border-[rgba(226,232,240,0.92)] bg-white/92 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Response</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    className={`cursor-pointer rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
                      copyState === "copied"
                        ? "border-[rgba(34,197,94,0.28)] bg-[rgba(220,252,231,0.95)] text-[rgba(21,128,61,0.98)]"
                        : copyState === "error"
                          ? "border-[rgba(248,113,113,0.3)] bg-[rgba(254,242,242,0.95)] text-[rgba(185,28,28,0.95)]"
                          : "border-[rgba(226,232,240,0.95)] bg-white text-[var(--text)]"
                    }`}
                    disabled={copyState === "copying"}
                    onClick={() => void handleCopyResult()}
                    type="button"
                  >
                    {copyState === "copying" ? "Copying..." : copyState === "copied" ? "Copied" : copyState === "error" ? "Copy failed" : "Send to Clipboard"}
                  </button>
                  <button
                    className="cursor-pointer rounded-full border border-[rgba(226,232,240,0.95)] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text)]"
                    onClick={onDownloadResult}
                    type="button"
                  >
                    Download MD
                  </button>
                </div>
              </div>
              <div className="mt-4 max-h-[62vh] overflow-y-auto rounded-[18px] bg-[rgba(248,250,252,0.86)] p-4">
                <MarkdownResponse content={result} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PromptIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16">
      <path d="M3 8.25 13 3 8.25 13l-1.4-4.1L3 8.25Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.4" />
      <path d="m7 8.8 2.15-2.15" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16">
      <path d="m4.5 4.5 7 7m0-7-7 7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 translate-x-[1px]" fill="currentColor" viewBox="0 0 16 16">
      <path d="M5 3.5v9l7-4.5-7-4.5Z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="currentColor" viewBox="0 0 16 16">
      <path d="M4.5 3.5h2.5v9H4.5zM9 3.5h2.5v9H9z" />
    </svg>
  );
}

function normalizeSpeakerLabel(speaker: string | null) {
  if (!speaker || speaker.trim().length === 0) {
    return "Speaker";
  }

  const trimmed = speaker.trim();
  return /^speaker\b/i.test(trimmed) ? trimmed : trimmed;
}

function getSpeakerKey(speaker: string | null) {
  return speaker && speaker.trim().length > 0 ? speaker.trim().toLowerCase() : "__unknown__";
}

const SPEAKER_CHIP_CLASSES = [
  "border-pink-300 bg-pink-100 text-pink-950",
  "border-cyan-300 bg-cyan-100 text-cyan-950",
  "border-amber-300 bg-amber-100 text-amber-950",
  "border-lime-300 bg-lime-100 text-lime-950",
  "border-violet-300 bg-violet-100 text-violet-950",
  "border-orange-300 bg-orange-100 text-orange-950",
  "border-fuchsia-300 bg-fuchsia-100 text-fuchsia-950",
  "border-emerald-300 bg-emerald-100 text-emerald-950"
];

function getSpeakerChipClass(speakerKey: string, speakerColorByKey: Map<string, string>) {
  return speakerColorByKey.get(speakerKey) ?? SPEAKER_CHIP_CLASSES[0];
}

function downloadTextFile(content: string, filename: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function copyTextToClipboard(content: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return;
  }

  await navigator.clipboard.writeText(content);
}

function extractPromptRunMessage(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (isPromptMessageObject(value)) {
    return value.message;
  }

  if (Array.isArray(value)) {
    const messages = value.map(extractPromptRunMessage).filter(Boolean);
    if (messages.length > 0) {
      return messages.join("\n\n");
    }
  }

  return JSON.stringify(value, null, 2);
}

function isPromptMessageObject(value: unknown): value is { message: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "message" in value &&
      typeof (value as { message?: unknown }).message === "string"
  );
}

function getTagChipClass(source: string, state: string) {
  if (state === "proposal") {
    return "border-[rgba(245,158,11,0.28)] bg-[rgba(255,251,235,0.98)] text-[rgba(180,83,9,0.95)] hover:border-[rgba(217,119,6,0.4)]";
  }

  if (source === "automatic") {
    return "border-[rgba(34,197,94,0.24)] bg-[rgba(240,253,244,0.98)] text-[rgba(21,128,61,0.95)] hover:border-[rgba(22,163,74,0.4)]";
  }

  return "border-[rgba(59,130,246,0.24)] bg-[rgba(239,246,255,0.98)] text-[rgba(30,64,175,0.96)] hover:border-[rgba(37,99,235,0.42)]";
}

function formatReviewStatus(status: ReviewStatus) {
  if (status === "approved") {
    return "Approved";
  }

  if (status === "rejected") {
    return "Rejected";
  }

  return "Pending review";
}

function TagLegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`inline-flex h-3 w-3 rounded-full border ${className}`} />
      <span>{label}</span>
    </span>
  );
}

function flattenTags(items: TagItem[], labels: string[] = []): Array<TagItem & { pathLabel: string }> {
  return items.flatMap((item) => {
    const pathLabel = [...labels, item.name].join(" / ");
    return [{ ...item, pathLabel }, ...flattenTags(item.children, [...labels, item.name])];
  });
}

function getCreateTagCandidate(query: string, tags: Array<TagItem & { pathLabel: string }>) {
  const parts = query
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  const name = parts.at(-1);
  if (!name) {
    return null;
  }

  const existingSamePath = tags.some((tag) => tag.pathLabel.toLowerCase() === parts.join(" / ").toLowerCase());
  if (existingSamePath) {
    return null;
  }

  const parentPath = parts.slice(0, -1).join(" / ");
  const parent = parentPath
    ? tags.find((tag) => tag.pathLabel.toLowerCase() === parentPath.toLowerCase())
    : null;

  if (parentPath && !parent) {
    return null;
  }

  return {
    name,
    parent,
    pathLabel: parent ? `${parent.pathLabel} / ${name}` : name
  };
}

function PipelineStatusRow({
  actionLabel = "Reset",
  label,
  onAction,
  value
}: {
  actionLabel?: string;
  label: string;
  onAction: () => void;
  value: string;
}) {
  const isPrimaryAction = actionLabel.toLowerCase() === "start";

  return (
    <div className="flex items-center justify-between gap-3 rounded-[16px] border border-[var(--line)] bg-[rgba(248,250,252,0.92)] px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</p>
        <p className="mt-1 truncate text-xs font-semibold text-[var(--text)]">{value}</p>
      </div>
      <button
        className={`shrink-0 cursor-pointer rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
          isPrimaryAction
            ? "bg-[var(--accent)] text-white shadow-[0_8px_18px_rgba(37,99,235,0.18)]"
            : "border border-[var(--line-strong)] bg-white text-[var(--muted)]"
        }`}
        onClick={onAction}
        type="button"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function InlineStatusChip({
  label,
  onClick,
  value
}: {
  label: string;
  onClick: () => void;
  value: string;
}) {
  const normalized = value.toLowerCase();
  const tone =
    normalized === "done"
      ? "bg-[rgba(34,197,94,0.12)] text-[rgba(21,128,61,0.95)]"
      : normalized === "pending"
        ? "bg-[rgba(245,158,11,0.12)] text-[rgba(180,83,9,0.95)]"
        : normalized === "open"
          ? "bg-[rgba(59,130,246,0.12)] text-[rgba(30,64,175,0.92)]"
        : "bg-[rgba(148,163,184,0.14)] text-[rgba(71,85,105,0.95)]";

  return (
    <button
      className={`cursor-pointer whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] ${tone}`}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      type="button"
    >
      {label}: {value}
    </button>
  );
}

function ReviewActionButton({
  active,
  compact = false,
  disabled = false,
  label,
  onClick
}: {
  active: boolean;
  compact?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`cursor-pointer rounded-full font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        compact ? "px-2 py-1 text-[10px]" : "px-3 py-2 text-sm md:px-4"
      } ${
        active
          ? "bg-[var(--accent)] text-white"
          : "border border-[var(--line-strong)] bg-white text-[var(--muted)]"
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function ModalFrame({
  children,
  onClose
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(15,23,42,0.28)] px-3 py-3 backdrop-blur-sm md:items-center md:px-6 md:py-6">
      <button aria-label="Close modal" className="absolute inset-0 cursor-pointer" onClick={onClose} type="button" />
      <aside className="glass-panel relative z-10 mt-1.5 max-h-[calc(94vh-6px)] w-full max-w-5xl overflow-y-auto rounded-[24px] border border-white/80 p-4 shadow-[0_30px_90px_rgba(15,23,42,0.2)] md:mt-0 md:max-h-[92vh] md:rounded-[32px] md:p-8">
        {children}
      </aside>
    </div>
  );
}
