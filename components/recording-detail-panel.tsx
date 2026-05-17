"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { formatDuration, formatSentenceOffset, formatTime } from "@/lib/time";
import type { RecordingDetail, ReviewStatus } from "@/lib/types";

const DATE_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

const LOG_DATE_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

type RecordingDetailPanelProps = {
  detail: RecordingDetail | null;
  isLoading: boolean;
  onReviewStatusUpdated: (detail: RecordingDetail) => void;
  onTitleUpdated: (detail: RecordingDetail) => void;
  onClose: () => void;
};

export function RecordingDetailPanel({
  detail,
  isLoading,
  onReviewStatusUpdated,
  onTitleUpdated,
  onClose
}: RecordingDetailPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPipelineExpanded, setIsPipelineExpanded] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [currentAudioMs, setCurrentAudioMs] = useState(0);
  const [durationAudioMs, setDurationAudioMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sentenceRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const sentenceListRef = useRef<HTMLDivElement | null>(null);
  const audioFrameRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);

  useEffect(() => {
    setIsExpanded(false);
    setIsPipelineExpanded(false);
    setIsEditingTitle(false);
    setTitleDraft(detail?.customTitle ?? "");
    setExportFeedback(null);
    setIsExportMenuOpen(false);
    setCurrentAudioMs(0);
    setDurationAudioMs(0);
    setIsPlaying(false);
    sentenceRefs.current = {};

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

      setCurrentAudioMs(audio.currentTime * 1000);
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

  const activeSentenceId = useMemo(() => {
    if (!detail || !isPlaying) {
      return null;
    }

    const syncedAudioMs = currentAudioMs + 120;
    const activeSentence = detail.sentences.find(
      (sentence) => syncedAudioMs >= sentence.startMs && syncedAudioMs <= sentence.endMs
    );

    return activeSentence?.id ?? null;
  }, [currentAudioMs, detail, isPlaying]);

  useEffect(() => {
    if (!activeSentenceId) {
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
  const transcriptionNextStatus = "pending";

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
    if (!detail) {
      return;
    }

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
  }

  async function savePipelineStatus(
    field:
      | "categoryStatus"
      | "locationStatus"
      | "titleProposalStatus"
      | "transcriptionStatus"
      | "calendarMatchStatus",
    value: string
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
      window.setTimeout(() => setExportFeedback(null), 1800);
    } catch {
      setExportFeedback("Copy failed");
      setIsExportMenuOpen(false);
      window.setTimeout(() => setExportFeedback(null), 1800);
    }
  }

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.paused) {
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

    const clampedMs = Math.max(0, Math.min(nextMs, durationAudioMs || nextMs));
    audio.currentTime = clampedMs / 1000;
    setCurrentAudioMs(clampedMs);
  }

  function skipBy(deltaMs: number) {
    seekTo(currentAudioMs + deltaMs);
  }

  return (
    <ModalFrame onClose={onClose}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Details</p>
        <div className="flex items-center gap-2">
          {exportFeedback ? <span className="text-xs font-semibold text-[var(--accent)]">{exportFeedback}</span> : null}
          <div className="relative">
            <button
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3 py-1.5 text-xs font-semibold text-[var(--text)] transition hover:bg-white"
              onClick={() => setIsExportMenuOpen((value) => !value)}
              type="button"
            >
              <ExportIcon />
              Export
            </button>
            {isExportMenuOpen ? (
              <div className="absolute right-0 top-[calc(100%+8px)] z-20 min-w-[180px] rounded-[18px] border border-white/80 bg-white/96 p-2 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur">
                <ExportMenuButton label="Copy transcript" onClick={() => void copyExport("transcript")} />
                <ExportMenuButton label="Copy sentences" onClick={() => void copyExport("sentences")} />
              </div>
            ) : null}
          </div>
          <button
            className="cursor-pointer rounded-full border border-white/80 bg-white/78 px-3 py-1.5 text-xs font-semibold text-[var(--muted)] transition hover:bg-white"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
      </div>
      {isEditingTitle ? (
        <div className="mt-3 flex max-w-3xl flex-wrap items-center gap-2">
          <input
            autoFocus
            className="min-w-[280px] flex-1 rounded-2xl border border-[var(--line-strong)] bg-white px-4 py-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--text)] outline-none"
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
          className="mt-3 max-w-3xl cursor-pointer rounded-2xl text-left text-2xl font-semibold tracking-[-0.04em] text-[var(--text)] transition hover:bg-white/50 hover:px-2 hover:py-1"
          onClick={() => setIsEditingTitle(true)}
          type="button"
        >
          {detail.title}
        </button>
      )}
      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
        {DATE_FORMATTER.format(new Date(detail.startedAt))} · {formatTime(detail.startedAt)} to{" "}
        {formatTime(detail.endedAt)} ·{" "}
        {formatDuration(detail.startedAt, detail.endedAt)}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetaCard label="Language" value={detail.transcriptLanguage ?? "--"} />
        <MetaCard label="Source" value={detail.source ?? "--"} />
        <MetaCard label="Status" value={detail.status ?? "--"} />
        <MetaCard label="Type" value={detail.category ?? "--"} />
      </div>

      <div className="mt-5 rounded-[24px] border border-white/80 bg-white/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Review Status</p>
            <p className="mt-2 text-sm font-semibold text-[var(--text)]">{detail.reviewStatus.replaceAll("_", " ")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ReviewActionButton active={detail.reviewStatus === "approved"} label="Approve" onClick={() => void saveReviewStatus("approved")} />
            <ReviewActionButton active={detail.reviewStatus === "pending_review"} label="Pending" onClick={() => void saveReviewStatus("pending_review")} />
            <ReviewActionButton active={detail.reviewStatus === "rejected"} label="Reject" onClick={() => void saveReviewStatus("rejected")} />
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-[18px] border border-[rgba(226,232,240,0.92)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.98)_100%)] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
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
                label="Calendar"
                onClick={() => void savePipelineStatus("calendarMatchStatus", "pending")}
                value={detail.calendarMatchStatus ?? "--"}
              />
              <InlineStatusChip
                label="Title"
                onClick={() => void savePipelineStatus("titleProposalStatus", "pending")}
                value={detail.titleProposalStatus ?? "--"}
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
              label="Calendar Match"
              onAction={() => void savePipelineStatus("calendarMatchStatus", "pending")}
              value={detail.calendarMatchStatus ?? "--"}
            />
            <PipelineStatusRow
              label="Title Proposal"
              onAction={() => void savePipelineStatus("titleProposalStatus", "pending")}
              value={detail.titleProposalStatus ?? "--"}
            />
            <PipelineStatusRow
              label="Category"
              onAction={() => void savePipelineStatus("categoryStatus", "pending")}
              value={detail.categoryStatus ?? "--"}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-5 rounded-[24px] border border-white/80 bg-white/80 p-4">
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

      <div className="mt-5 rounded-[24px] border border-white/80 bg-white/80 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Audio</p>
        {detail.audioUrl ? (
          <>
            <audio
              className="hidden"
              ref={audioRef}
              preload="none"
              src={detail.audioUrl}
              onLoadedMetadata={(event) => {
                const durationMs = Number.isFinite(event.currentTarget.duration)
                  ? event.currentTarget.duration * 1000
                  : 0;
                setDurationAudioMs(durationMs);
              }}
              onPause={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              onSeeked={(event) => setCurrentAudioMs(event.currentTarget.currentTime * 1000)}
              onTimeUpdate={(event) => setCurrentAudioMs(event.currentTarget.currentTime * 1000)}
            />
            <div className="mt-3 rounded-[22px] border border-[rgba(226,232,240,0.92)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.98)_100%)] p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-[0_12px_30px_rgba(37,99,235,0.18)] transition hover:bg-[#1d4ed8]"
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
                <div className="ml-auto text-right">
                  <p className="font-[family-name:var(--font-mono)] text-sm font-semibold text-[var(--text)]">
                    {formatSentenceOffset(currentAudioMs)} / {formatSentenceOffset(durationAudioMs)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {detail.source ?? "Audio stream"}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <input
                  className="audio-slider h-2 w-full cursor-pointer appearance-none rounded-full bg-[rgba(226,232,240,0.95)]"
                  max={Math.max(durationAudioMs, 1)}
                  min={0}
                  onChange={(event) => seekTo(Number(event.target.value))}
                  type="range"
                  value={Math.min(currentAudioMs, Math.max(durationAudioMs, 1))}
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

      <div className="mt-5 rounded-[24px] border border-white/80 bg-white/80 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Sentences</p>
          <p className="text-xs text-[var(--muted)]">{detail.sentences.length} segments</p>
        </div>
        <div ref={sentenceListRef} className="mt-3 flex max-h-[360px] flex-col gap-3 overflow-y-auto pr-1">
          {detail.sentences.length === 0 ? (
            <p className="text-sm leading-7 text-[var(--muted)]">
              No segmented sentences are available for this recording yet.
            </p>
          ) : (
            detail.sentences.map((sentence) => {
              const isActive = sentence.id === activeSentenceId;

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
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                        isActive
                          ? "bg-[rgba(59,130,246,0.14)] text-[rgba(30,64,175,0.92)]"
                          : "bg-[var(--accent-soft)] text-[var(--accent)]"
                      }`}
                    >
                      {sentence.speaker ?? "?"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6">{sentence.text}</p>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-5 rounded-[24px] border border-white/80 bg-white/80 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Logs</p>
          <p className="text-xs text-[var(--muted)]">{detail.logs.length} entries</p>
        </div>
        <div className="mt-3 flex max-h-[260px] flex-col gap-3 overflow-y-auto pr-1">
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

      <div className="mt-5 text-xs text-[var(--muted)]">
        <span className="font-semibold uppercase tracking-[0.16em]">ID</span>
        <span className="ml-2 font-[family-name:var(--font-mono)]">{detail.id}</span>
        <span className="ml-4 font-semibold uppercase tracking-[0.16em]">Source ID</span>
        <span className="ml-2 font-[family-name:var(--font-mono)]">{detail.assemblyAiTranscriptId ?? "--"}</span>
      </div>
    </ModalFrame>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-[var(--line)] bg-[rgba(248,250,252,0.92)] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-3 text-sm font-semibold">{value}</p>
    </div>
  );
}

function ExportMenuButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      className="flex w-full cursor-pointer items-center rounded-[12px] px-3 py-2 text-left text-xs font-semibold text-[var(--text)] transition hover:bg-[rgba(59,130,246,0.08)]"
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

function PlayIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 translate-x-[1px]" fill="currentColor" viewBox="0 0 16 16">
      <path d="M5 3.5v9l7-4.5-7-4.5Z" />
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
        className={`cursor-pointer rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
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
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-[var(--accent)] text-white"
          : "border border-[var(--line-strong)] bg-white text-[var(--muted)]"
      }`}
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
      <aside className="glass-panel relative z-10 max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[32px] border border-white/80 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.2)] md:p-8">
        {children}
      </aside>
    </div>
  );
}
