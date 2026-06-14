"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { AppNavigation } from "@/components/app-navigation";
import { MarkdownResponse } from "@/components/markdown-response";
import { RecordingDetailPanel } from "@/components/recording-detail-panel";
import { WeekCalendar } from "@/components/week-calendar";
import { addDays, addWeeks, formatDuration, formatSentenceOffset, formatTime, fromDateKey, startOfWeek, toDateKey } from "@/lib/time";
import type { GlobalSearchResult, PromptItem, RecordingDetail, RecordingListItem, ReviewStatus, SearchTagResult, TagItem } from "@/lib/types";

const SEARCH_RESULT_DATE_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Berlin"
});

type CalendarShellProps = {
  activeProfileEmail: string;
  buildSha: string;
  buildTime: string;
  initialCategoryFilter: "all" | "work" | "private" | "unknown";
  initialReviewFilter: "all" | ReviewStatus;
  initialTagFilter: string | null;
  initialWeekStart: string;
  recordings: RecordingListItem[];
};

export function CalendarShell({
  activeProfileEmail,
  buildSha,
  buildTime,
  initialCategoryFilter,
  initialReviewFilter,
  initialTagFilter,
  initialWeekStart,
  recordings
}: CalendarShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [recordingItems, setRecordingItems] = useState(recordings);
  const [detail, setDetail] = useState<RecordingDetail | null>(null);
  const [detailLoading, startDetailTransition] = useTransition();
  const [navPending, startNavTransition] = useTransition();
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(Date.now());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RecordingListItem[]>([]);
  const [searchTagResults, setSearchTagResults] = useState<SearchTagResult[]>([]);
  const [activeSearchTag, setActiveSearchTag] = useState<SearchTagResult | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedBucketItems, setSelectedBucketItems] = useState<RecordingListItem[]>([]);
  const [bucketFeedback, setBucketFeedback] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [isPromptActionOpen, setIsPromptActionOpen] = useState(false);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);
  const [isSendingPrompt, setIsSendingPrompt] = useState(false);
  const [promptRunResult, setPromptRunResult] = useState<string | null>(null);
  const [promptRunError, setPromptRunError] = useState<string | null>(null);
  const [promptAttachments, setPromptAttachments] = useState<File[]>([]);
  const [availableTags, setAvailableTags] = useState<TagItem[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const filtersRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const isDetailOverlayOpenRef = useRef(false);
  const categoryFilterRef = useRef<"all" | "work" | "private" | "unknown">(initialCategoryFilter);
  const reviewFilterRef = useRef<"all" | ReviewStatus>(initialReviewFilter);
  const tagFilterRef = useRef<string | null>(initialTagFilter);
  const [isMobile, setIsMobile] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<"all" | "work" | "private" | "unknown">(initialCategoryFilter);
  const [reviewFilter, setReviewFilter] = useState<"all" | ReviewStatus>(initialReviewFilter);
  const [tagFilter, setTagFilter] = useState<string | null>(initialTagFilter);

  const weekStart = useMemo(() => new Date(initialWeekStart), [initialWeekStart]);
  const weekStartRef = useRef<Date>(weekStart);
  const selectedId = searchParams.get("recordingId");
  const requestedDay = searchParams.get("day");
  const flatAvailableTags = useMemo(() => flattenFilterTags(availableTags), [availableTags]);
  const handleDetailOverlayStateChange = useCallback((isOpen: boolean) => {
    isDetailOverlayOpenRef.current = isOpen;
  }, []);

  useEffect(() => {
    setRecordingItems(recordings);
    setLastUpdatedAt(Date.now());
  }, [recordings]);

  useEffect(() => {
    setCategoryFilter(initialCategoryFilter);
    categoryFilterRef.current = initialCategoryFilter;
  }, [initialCategoryFilter]);

  useEffect(() => {
    setReviewFilter(initialReviewFilter);
    reviewFilterRef.current = initialReviewFilter;
  }, [initialReviewFilter]);

  useEffect(() => {
    setTagFilter(initialTagFilter);
    tagFilterRef.current = initialTagFilter;
  }, [initialTagFilter]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    weekStartRef.current = weekStart;
  }, [weekStart]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(media.matches);

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!filtersRef.current?.contains(event.target as Node)) {
        setFiltersOpen(false);
      }

      if (!searchRef.current?.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }

    if (!filtersOpen && !isSearchOpen) {
      return;
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [filtersOpen, isSearchOpen]);

  useEffect(() => {
    if (!filtersOpen || availableTags.length > 0) {
      return;
    }

    let isCancelled = false;
    setIsLoadingTags(true);

    async function loadTags() {
      try {
        const response = await fetch("/api/tags", { cache: "no-store" });
        if (!response.ok || isCancelled) {
          return;
        }

        const payload = (await response.json()) as TagItem[];
        if (!isCancelled) {
          setAvailableTags(payload);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingTags(false);
        }
      }
    }

    void loadTags();

    return () => {
      isCancelled = true;
    };
  }, [availableTags.length, filtersOpen]);

  async function refreshDetail(id: string, clearOnError: boolean) {
    const response = await fetch(`/api/recordings/${id}`, { cache: "no-store" });
    if (!response.ok) {
      if (clearOnError) {
        setDetail(null);
      }
      return false;
    }

    const payload = (await response.json()) as RecordingDetail;
    setDetail(payload);
    return true;
  }

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    startDetailTransition(async () => {
      const ok = await refreshDetail(selectedId, true);
      if (ok) {
        setLastUpdatedAt(Date.now());
      }
    });
  }, [selectedId]);

  function navigateToWeek(offset: number) {
    startNavTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("weekStart", toDateKey(addWeeks(weekStart, offset)));
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function navigateToCurrentWeek() {
    startNavTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      const today = new Date();
      params.set("weekStart", toDateKey(startOfWeek(today)));
      params.set("day", toDateKey(today));
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function updateUrlState(next: {
    categoryFilter?: "all" | "work" | "private" | "unknown";
    reviewFilter?: "all" | ReviewStatus;
    tagFilter?: string | null;
  }) {
    startNavTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      const resolvedCategoryFilter = next.categoryFilter ?? categoryFilter;
      const resolvedReviewFilter = next.reviewFilter ?? reviewFilter;
      const resolvedTagFilter = Object.hasOwn(next, "tagFilter") ? next.tagFilter ?? null : tagFilter;

      params.set("categoryFilter", resolvedCategoryFilter);
      params.set("reviewFilter", resolvedReviewFilter);
      if (resolvedTagFilter) {
        params.set("tagFilter", resolvedTagFilter);
      } else {
        params.delete("tagFilter");
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function setSelectedRecording(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());

    if (id) {
      params.set("recordingId", id);
    } else {
      params.delete("recordingId");
    }

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function toggleBucketItem(item: RecordingListItem) {
    setSelectedBucketItems((current) => {
      if (current.some((entry) => entry.id === item.id)) {
        return current.filter((entry) => entry.id !== item.id);
      }

      return [...current, item];
    });
    setPromptRunResult(null);
    setPromptRunError(null);
  }

  function addDayToBucket(items: RecordingListItem[]) {
    let addedCount = 0;
    setSelectedBucketItems((current) => {
      const existingIds = new Set(current.map((item) => item.id));
      const additions = items.filter((item) => !existingIds.has(item.id));
      addedCount = additions.length;
      return additions.length > 0 ? [...current, ...additions] : current;
    });
    setPromptRunResult(null);
    setPromptRunError(null);
    setBucketFeedback(addedCount > 0 ? `${addedCount} added` : "Already selected");
    window.setTimeout(() => setBucketFeedback(null), 1800);
  }

  function exitSelectionMode() {
    setIsSelectionMode(false);
    setSelectedBucketItems([]);
    setIsPromptActionOpen(false);
    setPromptRunResult(null);
    setPromptRunError(null);
    setPromptAttachments([]);
  }

  function handleRecordingActivate(item: RecordingListItem) {
    if (isSelectionMode) {
      toggleBucketItem(item);
      return;
    }

    setSelectedRecording(item.id);
  }

  function matchesActiveFilters(item: RecordingListItem) {
    if (categoryFilter !== "all") {
      if (categoryFilter === "unknown") {
        if (item.category && item.category !== "unknown") {
          return false;
        }
      } else if (item.category !== categoryFilter) {
        return false;
      }
    }

    if (reviewFilter !== "all") {
      if (item.reviewStatus !== reviewFilter) {
        return false;
      }
    } else if (item.reviewStatus === "rejected") {
      return false;
    }

    if (tagFilter) {
      return (item.tags ?? []).some((tag) => tag.tagId === tagFilter);
    }

    return true;
  }

  async function updateRecordingReviewStatus(id: string, reviewStatus: ReviewStatus) {
    const response = await fetch(`/api/recordings/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ reviewStatus })
    });

    if (!response.ok) {
      return;
    }

    const updated = (await response.json()) as RecordingDetail;
    setDetail((current) => (current?.id === updated.id ? updated : current));
    setRecordingItems((current) =>
      current
        .map((item) =>
          item.id === updated.id
            ? { ...item, category: updated.category, notes: updated.notes, reviewStatus: updated.reviewStatus }
            : item
        )
        .filter(matchesActiveFilters)
    );
  }

  const totalDurationMinutes = useMemo(
    () =>
      recordingItems.reduce((sum, item) => {
        const diffMs = new Date(item.endedAt).getTime() - new Date(item.startedAt).getTime();
        return sum + Math.max(Math.round(diffMs / 60000), 0);
      }, 0),
    [recordingItems]
  );
  const visibleWeekEnd = useMemo(() => {
    const saturdayKey = toDateKey(addWeeks(weekStart, 0));
    void saturdayKey;
    const saturday = new Date(weekStart);
    saturday.setDate(weekStart.getDate() + 5);
    const sunday = new Date(weekStart);
    sunday.setDate(weekStart.getDate() + 6);

    const hasWeekendRecordings = recordingItems.some((item) => {
      const itemKey = toDateKey(new Date(item.startedAt));
      return itemKey === toDateKey(saturday) || itemKey === toDateKey(sunday);
    });

    return hasWeekendRecordings ? sunday : new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 4);
  }, [recordingItems, weekStart]);
  const weekDays = useMemo(() => {
    const start = startOfWeek(weekStart);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [weekStart]);
  const currentMobileDay = useMemo(() => {
    const todayKey = toDateKey(new Date());
    const requested = requestedDay ?? null;
    const weekKeys = new Set(weekDays.map((day) => toDateKey(day)));

    if (requested && weekKeys.has(requested)) {
      return requested;
    }

    if (weekKeys.has(todayKey)) {
      return todayKey;
    }

    return weekDays[0] ? toDateKey(weekDays[0]) : null;
  }, [requestedDay, weekDays]);
  const weekRangeLabel = formatWeekRange(weekStart, visibleWeekEnd);
  const calendarHeaderLabel =
    isMobile && currentMobileDay && fromDateKey(currentMobileDay)
      ? formatMobileDayLabel(fromDateKey(currentMobileDay)!)
      : weekRangeLabel;
  const hasActiveFilters = categoryFilter !== "all" || reviewFilter !== "all" || Boolean(tagFilter);

  function pushCalendarState(nextDate: Date) {
    startNavTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("weekStart", toDateKey(startOfWeek(nextDate)));
      params.set("day", toDateKey(nextDate));
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function navigateCalendar(offset: number) {
    if (isMobile) {
      const base = currentMobileDay ? (fromDateKey(currentMobileDay) ?? weekStart) : weekStart;
      pushCalendarState(addDays(base, offset));
      return;
    }

    navigateToWeek(offset);
  }

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchTagResults([]);
      setActiveSearchTag(null);
      setIsSearchLoading(false);
      return;
    }

    let isCancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setIsSearchLoading(true);

      try {
        const params = new URLSearchParams();
        params.set("q", searchQuery.trim());
        params.set("limit", "24");
        params.set("categoryFilter", categoryFilterRef.current);
        params.set("reviewFilter", reviewFilterRef.current);
        if (tagFilterRef.current) {
          params.set("tagFilter", tagFilterRef.current);
        }

        const response = await fetch(`/api/search?${params.toString()}`, { cache: "no-store" });
        if (!response.ok || isCancelled) {
          return;
        }

        const payload = (await response.json()) as GlobalSearchResult;
        if (!isCancelled) {
          setSearchResults(payload.recordings);
          setSearchTagResults(payload.tags);
          setActiveSearchTag(null);
        }
      } finally {
        if (!isCancelled) {
          setIsSearchLoading(false);
        }
      }
    }, 180);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  useEffect(() => {
    async function autoRefresh() {
      if (document.hidden) {
        return;
      }

      setIsAutoRefreshing(true);

      try {
        const params = new URLSearchParams();
        params.set("categoryFilter", categoryFilterRef.current);
        params.set("reviewFilter", reviewFilterRef.current);
        if (tagFilterRef.current) {
          params.set("tagFilter", tagFilterRef.current);
        }
        params.set("weekStart", toDateKey(weekStartRef.current));

        const listResponse = await fetch(`/api/recordings?${params.toString()}`, { cache: "no-store" });
        if (!listResponse.ok) {
          return;
        }

        const nextItems = (await listResponse.json()) as RecordingListItem[];
        setRecordingItems(nextItems);

        if (selectedIdRef.current && !isDetailOverlayOpenRef.current) {
          await refreshDetail(selectedIdRef.current, false);
        }

        setLastUpdatedAt(Date.now());
      } finally {
        setIsAutoRefreshing(false);
      }
    }

    const intervalId = window.setInterval(() => {
      void autoRefresh();
    }, 15000);

    function handleVisible() {
      if (!document.hidden) {
        void autoRefresh();
      }
    }

    window.addEventListener("focus", handleVisible);
    document.addEventListener("visibilitychange", handleVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleVisible);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, []);

  async function fetchSelectedRecordingDetails() {
    if (selectedBucketItems.length === 0) {
      return [];
    }

    const details = await Promise.all(
      selectedBucketItems.map(async (item) => {
        const response = await fetch(`/api/recordings/${item.id}`, { cache: "no-store" });
        if (!response.ok) {
          return null;
        }

        return (await response.json()) as RecordingDetail;
      })
    );

    return details.filter((detail): detail is RecordingDetail => detail !== null);
  }

  function buildRecordingsMarkdown(details: RecordingDetail[]) {
    return [
      "# EchoTrace Recording Export",
      "",
      `Exported: ${new Date().toISOString()}`,
      `Recordings: ${details.length}`,
      "",
      ...details
      .map((detail) => {
        const sentenceBlock =
          detail.sentences.length > 0
            ? detail.sentences
                .map((sentence) => `**${formatSentenceOffset(sentence.startMs)} ${sentence.speaker ?? "Speaker"}**\n\n${sentence.text}`)
                .join("\n\n")
            : detail.transcript ?? detail.summary ?? "";
        const tagList = detail.tags.length > 0 ? detail.tags.map((tag) => tag.tagName).join(", ") : "--";

        return [
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
          "### Sentences",
          "",
          sentenceBlock || "_No transcript or sentences available._"
        ].join("\n");
      })
    ].join("\n\n---\n\n");
  }

  function buildMarkdownFilename() {
    return `echotrace-selection-${new Date().toISOString().slice(0, 10)}.md`;
  }

  async function downloadSelectedRecordingsMarkdown() {
    const details = await fetchSelectedRecordingDetails();
    if (details.length === 0) {
      return;
    }

    const payload = buildRecordingsMarkdown(details);

    downloadTextFile(payload, buildMarkdownFilename(), "text/markdown;charset=utf-8");
    setBucketFeedback("Downloaded");

    window.setTimeout(() => setBucketFeedback(null), 1800);
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

  async function showRecordingsForTag(tag: SearchTagResult) {
    if (!isSelectionMode) {
      setTagFilter(tag.id);
      tagFilterRef.current = tag.id;
      setActiveSearchTag(tag);
      setIsSearchOpen(false);
      setSearchQuery("");
      setSelectedRecording(null);
      setDetail(null);
      updateUrlState({ tagFilter: tag.id });
      return;
    }

    setIsSearchLoading(true);
    setActiveSearchTag(tag);

    try {
      const params = new URLSearchParams();
      params.set("tagId", tag.id);
      params.set("limit", "100");
      params.set("categoryFilter", categoryFilterRef.current);
      params.set("reviewFilter", reviewFilterRef.current);

      const response = await fetch(`/api/recordings?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as RecordingListItem[];
      setSearchResults(payload);
      setIsSearchOpen(true);

      if (isSelectionMode) {
        let addedCount = 0;
        setSelectedBucketItems((current) => {
          const existingIds = new Set(current.map((item) => item.id));
          const additions = payload.filter((item) => !existingIds.has(item.id));
          addedCount = additions.length;
          return additions.length > 0 ? [...current, ...additions] : current;
        });
        setBucketFeedback(addedCount > 0 ? `${addedCount} added` : "Already selected");
        window.setTimeout(() => setBucketFeedback(null), 1800);
      }
    } finally {
      setIsSearchLoading(false);
    }
  }

  async function sendSelectionToPrompt() {
    if (!selectedPromptId || selectedBucketItems.length === 0) {
      return;
    }

    setIsSendingPrompt(true);
    setPromptRunResult(null);
    setPromptRunError(null);

    try {
      const details = await fetchSelectedRecordingDetails();
      if (details.length === 0) {
        return;
      }

      const formData = new FormData();
      formData.append("filename", buildMarkdownFilename());
      formData.append("markdown", buildRecordingsMarkdown(details));
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
      setBucketFeedback("Prompt completed");
      window.setTimeout(() => setBucketFeedback(null), 1800);
    } catch (error) {
      setPromptRunError(error instanceof Error ? error.message : "Prompt run failed");
    } finally {
      setIsSendingPrompt(false);
    }
  }

  const selectedBucketIds = useMemo(() => selectedBucketItems.map((item) => item.id), [selectedBucketItems]);

  return (
    <main className="min-h-screen px-3 py-3 md:pl-[6.5rem] md:pr-8 md:py-8">
      <AppNavigation activeProfileEmail={activeProfileEmail} buildSha={buildSha} buildTime={buildTime} />
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 md:gap-6">
        <section className="glass-panel hidden overflow-hidden rounded-[28px] border border-white/70 shadow-[var(--shadow)] md:block md:rounded-[36px]">
          <div className="grid gap-4 px-4 py-4 md:grid-cols-[1.2fr_0.8fr] md:items-start md:px-8 md:py-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-white/80 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                  EchoTrace
                </span>
                <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                  Week View
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <BrandMark />
                  <div className="space-y-2">
                    <h1 className="max-w-3xl text-[28px] font-semibold tracking-[-0.05em] text-balance md:text-[42px]">
                      Your week listens in.
                    </h1>
                    <p className="max-w-xl text-[13px] leading-6 text-[var(--muted)] md:text-[15px]">
                      Recordings, transcripts, and timeline in a clear weekly view.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid content-start">
              <div className="rounded-[24px] border border-white/70 bg-white/72 p-3 md:rounded-[28px] md:p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                  Week Snapshot
                </p>
                <div className="mt-3 grid grid-cols-[0.8fr_0.7fr_minmax(9rem,1.25fr)] gap-2 md:gap-3">
                  <StatCard label="Recordings" value={String(recordingItems.length).padStart(2, "0")} />
                  <StatCard
                    label="Days"
                    value={String(new Set(recordingItems.map((item) => toDateKey(new Date(item.startedAt)))).size).padStart(2, "0")}
                  />
                  <StatCard label="Week Time" value={formatMinutesCompact(totalDurationMinutes)} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={`grid gap-4 ${isSelectionMode ? "xl:grid-cols-[minmax(0,1fr)_320px]" : ""}`}>
          <div className="glass-panel overflow-hidden rounded-[28px] border border-white/70 shadow-[var(--shadow)] md:rounded-[36px]">
            <div className="flex flex-col gap-4 border-b border-[rgba(226,232,240,0.9)] px-4 py-4 md:flex-row md:flex-wrap md:items-center md:justify-between md:px-8">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Calendar</p>
                  <LiveUpdateBadge
                    className="inline-flex md:hidden"
                    hasMounted={hasMounted}
                    isRefreshing={isAutoRefreshing}
                    lastUpdatedAt={lastUpdatedAt}
                  />
                </div>
                <div className="flex items-center gap-2 md:gap-3">
                  <RangeButton direction="left" onClick={() => navigateCalendar(-1)} />
                  <p className="min-w-0 flex-1 text-[18px] font-semibold tracking-[-0.04em] text-[var(--text)] md:min-w-[260px] md:flex-none md:text-[24px]">
                    {calendarHeaderLabel}
                  </p>
                  <RangeButton direction="right" onClick={() => navigateCalendar(1)} />
                </div>
              </div>
              <div className="flex w-full flex-col gap-2 md:ml-auto md:w-auto md:items-end">
                <div className="relative w-full md:min-w-[360px]" ref={searchRef}>
                  <div className="flex items-center gap-2 rounded-xl border border-[rgba(226,232,240,0.95)] bg-white px-3 py-2.5 shadow-[0_8px_24px_rgba(15,23,42,0.03)]">
                    <SearchIcon />
                    <input
                      className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text)] outline-none"
                      onChange={(event) => {
                        setSearchQuery(event.target.value);
                        setIsSearchOpen(true);
                      }}
                      onFocus={() => setIsSearchOpen(true)}
                      placeholder="Search recordings, sources, topics, text..."
                      value={searchQuery}
                    />
                  </div>
                  {isSearchOpen && searchQuery.trim() ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-30 rounded-[18px] border border-[rgba(226,232,240,0.92)] bg-white/98 p-2 shadow-[0_20px_44px_rgba(15,23,42,0.1)] backdrop-blur">
                      {isSearchLoading ? (
                        <p className="px-3 py-2 text-sm text-[var(--muted)]">Searching...</p>
                      ) : searchResults.length === 0 && searchTagResults.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-[var(--muted)]">No recordings found.</p>
                      ) : (
                        <>
                        {searchTagResults.length > 0 ? (
                          <div className="mb-2 rounded-[16px] border border-[rgba(37,99,235,0.14)] bg-[rgba(239,246,255,0.76)] p-2">
                            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Tags</p>
                            {searchTagResults.map((tag) => (
                              <button
                                key={tag.id}
                                className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-[12px] px-3 py-2 text-left transition hover:bg-white/80 ${
                                  activeSearchTag?.id === tag.id ? "bg-white text-[var(--accent)]" : "text-[var(--text)]"
                                }`}
                                onClick={() => void showRecordingsForTag(tag)}
                                type="button"
                              >
                                <span className="min-w-0">
                                  <span className="block text-sm font-semibold">#{tag.name}</span>
                                  <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">{tag.pathLabel}</span>
                                </span>
                                <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
                                  {isSelectionMode ? `Add ${tag.recordingCount}` : `${tag.recordingCount} recordings`}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {activeSearchTag ? (
                          <p className="px-3 pb-2 text-xs font-medium text-[var(--muted)]">
                            {isSelectionMode
                              ? `Selected recordings tagged with #${activeSearchTag.name}`
                              : `Showing recordings tagged with #${activeSearchTag.name}`}
                          </p>
                        ) : null}
                        {searchResults.map((item) => {
                          const isAdded = selectedBucketIds.includes(item.id);

                          return (
                            <button
                              key={item.id}
                              className="flex w-full cursor-pointer items-start justify-between gap-4 rounded-[16px] px-4 py-3 text-left transition hover:bg-[rgba(59,130,246,0.08)]"
                              onClick={() => {
                                handleRecordingActivate(item);
                                if (!isSelectionMode) {
                                  setIsSearchOpen(false);
                                }
                              }}
                              type="button"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-[var(--text)]">{item.title}</p>
                                <p className="mt-1 text-xs text-[var(--muted)]">
                                  {SEARCH_RESULT_DATE_FORMATTER.format(new Date(item.startedAt))} · {formatTime(item.startedAt)} - {formatTime(item.endedAt)} ·{" "}
                                  {formatDuration(item.startedAt, item.endedAt)}
                                </p>
                                {item.summary ? (
                                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--muted)]">{item.summary}</p>
                                ) : null}
                                {item.tags && item.tags.length > 0 ? (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {item.tags.slice(0, 6).map((tag) => (
                                      <span
                                        key={tag.id}
                                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getSearchTagChipClass(
                                          tag.source,
                                          tag.state
                                        )}`}
                                      >
                                        {tag.tagName}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                              {isSelectionMode ? (
                                <span
                                  className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                                    isAdded ? "bg-[rgba(15,23,42,0.92)] text-white" : "bg-[rgba(226,232,240,0.95)] text-[var(--muted)]"
                                  }`}
                                >
                                  {isAdded ? "Added" : "Add"}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="flex w-full items-center justify-end gap-2 md:w-auto md:flex-wrap">
                <LiveUpdateBadge
                  className="hidden md:inline-flex"
                  hasMounted={hasMounted}
                  isRefreshing={isAutoRefreshing}
                  lastUpdatedAt={lastUpdatedAt}
                />
                <button
                  className={`cursor-pointer rounded-xl border px-3 py-2 text-sm font-medium transition md:px-4 md:py-2.5 ${
                    isSelectionMode
                      ? "border-[rgba(15,23,42,0.92)] bg-[rgba(15,23,42,0.92)] text-white"
                      : "border-[rgba(226,232,240,0.95)] bg-white text-[var(--text)] hover:border-[rgba(148,163,184,0.55)]"
                  }`}
                  onClick={() => {
                    setDetail(null);
                    setSelectedRecording(null);
                    if (isSelectionMode) {
                      exitSelectionMode();
                    } else {
                      setIsSelectionMode(true);
                    }
                  }}
                  type="button"
                >
                  {isSelectionMode ? "Cancel selection" : "Select"}
                </button>
                <NavButton label="Today" onClick={navigateToCurrentWeek} disabled={navPending} />
                <div className="relative" ref={filtersRef}>
                  <button
                    className={`inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition ${
                      hasActiveFilters
                        ? "border-[rgba(37,99,235,0.28)] bg-[rgba(239,246,255,0.98)] text-[rgba(29,78,216,0.96)] shadow-[0_8px_18px_rgba(37,99,235,0.08)]"
                        : "border-[rgba(226,232,240,0.95)] bg-white text-[var(--text)] hover:border-[rgba(148,163,184,0.55)]"
                    }`}
                    onClick={() => setFiltersOpen((value) => !value)}
                    type="button"
                  >
                    <FilterIcon />
                    Filters
                    <ChevronDown />
                  </button>
                  {filtersOpen ? (
                    <div className="absolute right-0 top-[calc(100%+10px)] z-20 min-w-[240px] rounded-[18px] border border-[rgba(226,232,240,0.92)] bg-white/98 p-3 shadow-[0_20px_44px_rgba(15,23,42,0.1)] backdrop-blur md:min-w-[260px]">
                      <div className="space-y-3">
                        <div className="rounded-[14px] border border-[rgba(226,232,240,0.75)] bg-[rgba(248,250,252,0.92)] p-3">
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                            Type
                          </p>
                          <CategoryFilterSelect
                            onChange={(value) => {
                              setCategoryFilter(value);
                              categoryFilterRef.current = value;
                              updateUrlState({ categoryFilter: value });
                            }}
                            value={categoryFilter}
                          />
                        </div>
                        <div className="rounded-[14px] border border-[rgba(226,232,240,0.75)] bg-[rgba(248,250,252,0.92)] p-3">
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                            Review
                          </p>
                          <FilterSelect
                            onChange={(value) => {
                              setReviewFilter(value);
                              reviewFilterRef.current = value;
                              updateUrlState({ reviewFilter: value });
                            }}
                            value={reviewFilter}
                          />
                        </div>
                        <div className="rounded-[14px] border border-[rgba(226,232,240,0.75)] bg-[rgba(248,250,252,0.92)] p-3">
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                            Tags
                          </p>
                          <TagFilterSelect
                            isLoading={isLoadingTags}
                            onChange={(value) => {
                              const next = value || null;
                              setTagFilter(next);
                              tagFilterRef.current = next;
                              updateUrlState({ tagFilter: next });
                            }}
                            tags={flatAvailableTags}
                            value={tagFilter ?? ""}
                          />
                        </div>
                        {hasActiveFilters ? (
                          <button
                            className="w-full cursor-pointer rounded-xl border border-[rgba(226,232,240,0.95)] bg-white px-3 py-2.5 text-sm font-semibold text-[var(--text)] transition hover:bg-[rgba(59,130,246,0.08)]"
                            onClick={() => {
                              setCategoryFilter("all");
                              categoryFilterRef.current = "all";
                              setReviewFilter("all");
                              reviewFilterRef.current = "all";
                              setTagFilter(null);
                              tagFilterRef.current = null;
                              updateUrlState({ categoryFilter: "all", reviewFilter: "all", tagFilter: null });
                            }}
                            type="button"
                          >
                            Reset filters
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
                </div>
              </div>
            </div>
            <WeekCalendar
              isSelectionMode={isSelectionMode}
              mobileDayKey={isMobile ? currentMobileDay : null}
              recordings={recordingItems}
              selectedBucketIds={selectedBucketIds}
              selectedId={selectedId}
              onSelectDay={addDayToBucket}
              onSelect={(id) => {
                const item = recordingItems.find((entry) => entry.id === id);
                if (item) {
                  handleRecordingActivate(item);
                }
              }}
              weekStart={initialWeekStart}
              todayKey={toDateKey(new Date())}
            />
          </div>
          {isSelectionMode ? (
            <aside className="glass-panel flex h-fit flex-col rounded-[28px] border border-white/70 p-4 shadow-[var(--shadow)] md:sticky md:top-6 md:rounded-[32px] md:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Selection Bucket</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">{selectedBucketItems.length} recordings selected</p>
                </div>
                <button
                  className="shrink-0 cursor-pointer rounded-2xl border border-[rgba(248,113,113,0.28)] bg-[rgba(254,242,242,0.95)] px-3 py-2 text-xs font-semibold text-[rgba(185,28,28,0.95)] shadow-[0_8px_18px_rgba(185,28,28,0.08)] transition hover:border-[rgba(248,113,113,0.48)]"
                  onClick={exitSelectionMode}
                  type="button"
                >
                  Exit selection
                </button>
              </div>
              {bucketFeedback ? <span className="mt-3 text-xs font-semibold text-[var(--accent)]">{bucketFeedback}</span> : null}
              <div className="mt-4 flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
                {selectedBucketItems.length === 0 ? (
                  <p className="rounded-[18px] border border-dashed border-[rgba(203,213,225,0.95)] bg-white/68 px-4 py-4 text-sm text-[var(--muted)]">
                    Pick recordings from the calendar or search results.
                  </p>
                ) : (
                  selectedBucketItems.map((item) => (
                    <div key={item.id} className="rounded-[18px] border border-[rgba(226,232,240,0.95)] bg-white/84 px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-semibold text-[var(--text)]">{item.title}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {formatTime(item.startedAt)} - {formatTime(item.endedAt)} · {formatDuration(item.startedAt, item.endedAt)}
                          </p>
                        </div>
                        <button
                          className="cursor-pointer rounded-full border border-[rgba(226,232,240,0.95)] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]"
                          onClick={() => toggleBucketItem(item)}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 grid gap-2">
                <button
                  className="cursor-pointer rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={selectedBucketItems.length === 0}
                  onClick={() => void downloadSelectedRecordingsMarkdown()}
                  type="button"
                >
                  Download Markdown
                </button>
                <button
                  className="cursor-pointer rounded-2xl border border-[rgba(226,232,240,0.95)] bg-white px-4 py-3 text-sm font-semibold text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={selectedBucketItems.length === 0}
                  onClick={() => {
                    setIsPromptActionOpen(true);
                    setPromptRunResult(null);
                    setPromptRunError(null);
                    void loadPrompts();
                  }}
                  type="button"
                >
                  Send to Prompt
                </button>
                <button
                  className="cursor-pointer rounded-2xl border border-[rgba(248,113,113,0.28)] bg-[rgba(254,242,242,0.95)] px-4 py-3 text-sm font-semibold text-[rgba(185,28,28,0.95)]"
                  onClick={exitSelectionMode}
                  type="button"
                >
                  Exit selection mode
                </button>
              </div>
            </aside>
          ) : null}
        </section>
      </div>
      {selectedId ? (
        <RecordingDetailPanel
          detail={detail}
          isLoading={detailLoading}
          onOverlayStateChange={handleDetailOverlayStateChange}
          onReviewStatusUpdated={(updated) => {
            setDetail(updated);
            setLastUpdatedAt(Date.now());
            setRecordingItems((current) =>
              current
                .map((item) =>
                  item.id === updated.id
                    ? {
                        ...item,
                        title: updated.title,
                        customTitle: updated.customTitle,
                        category: updated.category,
                        notes: updated.notes,
                        reviewStatus: updated.reviewStatus
                      }
                    : item
                )
                .filter(matchesActiveFilters)
            );
          }}
          onTitleUpdated={(updated) => {
            setDetail(updated);
            setLastUpdatedAt(Date.now());
            setRecordingItems((current) =>
              current
                .map((item) =>
                  item.id === updated.id
                    ? {
                        ...item,
                        title: updated.title,
                        category: updated.category,
                        customTitle: updated.customTitle,
                        notes: updated.notes
                      }
                    : item
                )
                .filter(matchesActiveFilters)
            );
          }}
          onClose={() => {
            setDetail(null);
            setSelectedRecording(null);
          }}
        />
      ) : null}
      {isPromptActionOpen ? (
        <PromptRunDialog
          isLoadingPrompts={isLoadingPrompts}
          isSending={isSendingPrompt}
          onClose={() => setIsPromptActionOpen(false)}
          onCopyResult={async () => {
            if (promptRunResult) {
              await copyPromptRunResult(promptRunResult);
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
          onSend={() => void sendSelectionToPrompt()}
          promptAttachments={promptAttachments}
          prompts={prompts}
          result={promptRunResult}
          runError={promptRunError}
          selectedPromptId={selectedPromptId}
          setPromptAttachments={setPromptAttachments}
          setSelectedPromptId={setSelectedPromptId}
        />
      ) : null}
    </main>
  );
}

function FilterSelect({
  onChange,
  value
}: {
  onChange: (value: "all" | ReviewStatus) => void;
  value: "all" | ReviewStatus;
}) {
  return (
    <select
      className="w-full cursor-pointer rounded-xl border border-[rgba(226,232,240,0.95)] bg-white px-3 py-2.5 text-sm font-medium text-[var(--text)] outline-none transition hover:border-[rgba(148,163,184,0.55)]"
      onChange={(event) => onChange(event.target.value as "all" | ReviewStatus)}
      value={value}
    >
      <option value="all">All visible</option>
      <option value="pending_review">Pending only</option>
      <option value="approved">Approved only</option>
      <option value="rejected">Rejected only</option>
    </select>
  );
}

function CategoryFilterSelect({
  onChange,
  value
}: {
  onChange: (value: "all" | "work" | "private" | "unknown") => void;
  value: "all" | "work" | "private" | "unknown";
}) {
  return (
    <select
      className="w-full cursor-pointer rounded-xl border border-[rgba(226,232,240,0.95)] bg-white px-3 py-2.5 text-sm font-medium text-[var(--text)] outline-none transition hover:border-[rgba(148,163,184,0.55)]"
      onChange={(event) => onChange(event.target.value as "all" | "work" | "private" | "unknown")}
      value={value}
    >
      <option value="all">All types</option>
      <option value="work">Work</option>
      <option value="private">Private</option>
      <option value="unknown">Unknown</option>
    </select>
  );
}

function TagFilterSelect({
  isLoading,
  onChange,
  tags,
  value
}: {
  isLoading: boolean;
  onChange: (value: string) => void;
  tags: Array<TagItem & { pathLabel: string }>;
  value: string;
}) {
  return (
    <select
      className="w-full cursor-pointer rounded-xl border border-[rgba(226,232,240,0.95)] bg-white px-3 py-2.5 text-sm font-medium text-[var(--text)] outline-none transition hover:border-[rgba(148,163,184,0.55)]"
      disabled={isLoading}
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      <option value="">{isLoading ? "Loading tags..." : "All tags"}</option>
      {tags.map((tag) => (
        <option key={tag.id} value={tag.id}>
          {tag.pathLabel}
        </option>
      ))}
    </select>
  );
}

function BrandMark() {
  return (
    <div className="relative mt-1 hidden h-14 w-14 shrink-0 overflow-hidden rounded-[18px] bg-[linear-gradient(150deg,#0f172a_0%,#1d4ed8_100%)] shadow-[0_14px_26px_rgba(37,99,235,0.12)] md:block">
      <div className="absolute inset-[11px] rounded-[12px] bg-white/94" />
      <div className="absolute left-[18px] top-[18px] h-[6px] w-[18px] rounded-full bg-[#0f172a]" />
      <div className="absolute left-[18px] top-[30px] h-[6px] w-[28px] rounded-full bg-[#93c5fd]" />
      <div className="absolute left-[18px] top-[42px] h-[6px] w-[22px] rounded-full bg-[#dbeafe]" />
    </div>
  );
}

function NavButton({
  disabled,
  label,
  onClick
}: {
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="cursor-pointer rounded-xl border border-[rgba(226,232,240,0.95)] bg-white px-3 py-2 text-sm font-medium text-[var(--text)] transition hover:border-[rgba(148,163,184,0.55)] hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 md:px-4 md:py-2.5"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[16px] border border-white/80 bg-white/78 p-2.5 md:rounded-[18px] md:p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 whitespace-nowrap text-base font-semibold tracking-[-0.04em] md:text-[22px]">{value}</p>
    </div>
  );
}

function formatWeekRange(start: Date, end: Date) {
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = start.getMonth() === end.getMonth() && sameYear;
  const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "Europe/Berlin" });

  if (sameMonth) {
    return `${monthFormatter.format(start)} ${formatOrdinalDay(start.getDate())} – ${formatOrdinalDay(end.getDate())}, ${end.getFullYear()}`;
  }

  if (sameYear) {
    return `${monthFormatter.format(start)} ${formatOrdinalDay(start.getDate())} – ${monthFormatter.format(end)} ${formatOrdinalDay(end.getDate())}, ${end.getFullYear()}`;
  }

  return `${monthFormatter.format(start)} ${formatOrdinalDay(start.getDate())}, ${start.getFullYear()} – ${monthFormatter.format(end)} ${formatOrdinalDay(end.getDate())}, ${end.getFullYear()}`;
}

function formatMobileDayLabel(input: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "Europe/Berlin"
  }).format(input);
}

function formatOrdinalDay(day: number) {
  const mod10 = day % 10;
  const mod100 = day % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${day}st`;
  }
  if (mod10 === 2 && mod100 !== 12) {
    return `${day}nd`;
  }
  if (mod10 === 3 && mod100 !== 13) {
    return `${day}rd`;
  }

  return `${day}th`;
}

function ChevronLeft() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16">
      <path d="M9.5 3.5 5 8l4.5 4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16">
      <path d="M6.5 3.5 11 8l-4.5 4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg aria-hidden="true" className="h-4 w-4 text-[var(--muted)]" fill="none" viewBox="0 0 16 16">
      <path d="m4.5 6.5 3.5 3.5 3.5-3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  );
}

function RangeButton({
  direction,
  onClick
}: {
  direction: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[rgba(226,232,240,0.95)] bg-white text-[var(--muted)] transition hover:border-[rgba(148,163,184,0.55)] hover:text-[var(--text)] md:h-10 md:w-10"
      onClick={onClick}
      type="button"
    >
      {direction === "left" ? <ChevronLeft /> : <ChevronRight />}
    </button>
  );
}

function FilterIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16">
      <path d="M2.5 4h11M4.5 8h7M6.5 12h3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4 text-[var(--muted)]" fill="none" viewBox="0 0 16 16">
      <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="m10.5 10.5 3 3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

function getSearchTagChipClass(source: string, state: string) {
  if (state === "proposal") {
    return "border-[rgba(245,158,11,0.28)] bg-[rgba(255,251,235,0.98)] text-[rgba(180,83,9,0.95)]";
  }

  if (source === "automatic") {
    return "border-[rgba(34,197,94,0.24)] bg-[rgba(240,253,244,0.98)] text-[rgba(21,128,61,0.95)]";
  }

  return "border-[rgba(59,130,246,0.24)] bg-[rgba(239,246,255,0.98)] text-[rgba(30,64,175,0.96)]";
}

function flattenFilterTags(items: TagItem[], labels: string[] = []): Array<TagItem & { pathLabel: string }> {
  return items.flatMap((item) => {
    const pathLabel = [...labels, item.name].join(" / ");
    return [{ ...item, pathLabel }, ...flattenFilterTags(item.children, [...labels, item.name])];
  });
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
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text)] sm:text-2xl">Send selection to prompt</h2>
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

async function copyPromptRunResult(content: string) {
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

function formatMinutesCompact(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }

  return `${minutes}m`;
}

function LiveUpdateBadge({
  className = "",
  hasMounted,
  isRefreshing,
  lastUpdatedAt
}: {
  className?: string;
  hasMounted: boolean;
  isRefreshing: boolean;
  lastUpdatedAt: number;
}) {
  return (
    <div
      className={`h-8 items-center gap-2 rounded-xl border border-[rgba(226,232,240,0.95)] bg-white px-2.5 text-[11px] font-medium text-[var(--muted)] md:h-10 md:px-3 md:text-xs ${className}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${isRefreshing ? "animate-pulse bg-[var(--accent)]" : "bg-emerald-500"}`}
      />
      <span suppressHydrationWarning>{isRefreshing ? "Refreshing..." : hasMounted ? `Updated ${formatSyncTime(lastUpdatedAt)}` : "Updated --:--:--"}</span>
    </div>
  );
}

function formatSyncTime(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Berlin"
  }).format(new Date(timestamp));
}
