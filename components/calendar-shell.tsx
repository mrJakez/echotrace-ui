"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { AppNavigation, BrandMark } from "@/components/app-navigation";
import { MarkdownResponse } from "@/components/markdown-response";
import { RecordingDetailPanel } from "@/components/recording-detail-panel";
import { RecordingListView } from "@/components/recording-list-view";
import { RecordingTagFilter, type RecordingListTagFilter } from "@/components/recording-tag-filter";
import { WeekCalendar } from "@/components/week-calendar";
import { getMergedSpeakerLabel, isGenericSpeakerLabel } from "@/lib/merge-speakers";
import { addDays, addWeeks, formatDuration, formatSentenceOffset, formatTime, fromDateKey, startOfWeek, toDateKey } from "@/lib/time";
import type { GlobalSearchResult, PromptItem, RecordingDetail, RecordingListItem, ReviewStatus, SearchTagResult } from "@/lib/types";

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

type CalendarViewMode = "list" | "week";
type CategoryFilterOption = "work" | "private" | "unknown";

const DEFAULT_CATEGORY_FILTERS: CategoryFilterOption[] = ["work"];

function getClientErrorDetails(error: unknown) {
  return error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { name: "UnknownError", message: String(error), stack: undefined };
}

async function reportMergeClientError(stage: string, error: unknown, context: Record<string, unknown>) {
  const details = getClientErrorDetails(error);
  console.error("[merge-client] failed", { stage, ...details, context });

  try {
    await fetch("/api/client-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "recording-merge", stage, ...details, context })
    });
  } catch (reportError) {
    console.error("[merge-client] error report failed", getClientErrorDetails(reportError));
  }
}

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
  const [isApprovingPendingSelection, setIsApprovingPendingSelection] = useState(false);
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [isPromptActionOpen, setIsPromptActionOpen] = useState(false);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);
  const [isSendingPrompt, setIsSendingPrompt] = useState(false);
  const [promptRunResult, setPromptRunResult] = useState<string | null>(null);
  const [promptRunError, setPromptRunError] = useState<string | null>(null);
  const [promptAttachments, setPromptAttachments] = useState<File[]>([]);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [mergeDetails, setMergeDetails] = useState<RecordingDetail[]>([]);
  const [mergeTitle, setMergeTitle] = useState("");
  const [mergeAudio, setMergeAudio] = useState(true);
  const [isLoadingMerge, setIsLoadingMerge] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const filtersRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const isDetailOverlayOpenRef = useRef(false);
  const categoryFilterRef = useRef<"all" | "work" | "private" | "unknown">(initialCategoryFilter);
  const reviewFilterRef = useRef<"all" | ReviewStatus>(initialReviewFilter);
  const tagFilterRef = useRef<string | null>(initialTagFilter);
  const [isMobile, setIsMobile] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const calendarViewMode: CalendarViewMode = pathname === "/list" ? "list" : "week";
  const [sharedCategoryFilters, setSharedCategoryFilters] = useState<CategoryFilterOption[]>(
    initialCategoryFilter === "all" ? [...DEFAULT_CATEGORY_FILTERS] : [initialCategoryFilter]
  );
  const categoryFilter: "all" | CategoryFilterOption =
    sharedCategoryFilters.length === 1 ? sharedCategoryFilters[0] : "all";
  const [reviewFilter, setReviewFilter] = useState<"all" | ReviewStatus>(initialReviewFilter);
  const [tagFilter, setTagFilter] = useState<string | null>(initialTagFilter);
  const [sharedReviewStatuses, setSharedReviewStatuses] = useState<ReviewStatus[]>(
    initialReviewFilter === "all" ? ["approved", "pending_review"] : [initialReviewFilter]
  );
  const [sharedTagFilters, setSharedTagFilters] = useState<RecordingListTagFilter[]>(
    initialTagFilter
      ? [{ descendantIds: [], id: initialTagFilter, includeDescendants: false, name: initialTagFilter, pathLabel: initialTagFilter }]
      : []
  );

  const weekStart = useMemo(() => new Date(initialWeekStart), [initialWeekStart]);
  const weekStartRef = useRef<Date>(weekStart);
  const selectedId = searchParams.get("recordingId");
  const requestedDay = searchParams.get("day");
  const handleDetailOverlayStateChange = useCallback((isOpen: boolean) => {
    isDetailOverlayOpenRef.current = isOpen;
  }, []);

  useEffect(() => {
    setRecordingItems(recordings);
    setLastUpdatedAt(Date.now());
  }, [recordings]);

  useEffect(() => {
    setReviewFilter(initialReviewFilter);
    reviewFilterRef.current = initialReviewFilter;
  }, [initialReviewFilter]);

  useEffect(() => {
    setTagFilter(initialTagFilter);
    tagFilterRef.current = initialTagFilter;
  }, [initialTagFilter]);

  useEffect(() => {
    categoryFilterRef.current = categoryFilter;
  }, [categoryFilter]);

  useEffect(() => {
    reviewFilterRef.current = sharedReviewStatuses.length === 1 ? sharedReviewStatuses[0] : "all";
  }, [sharedReviewStatuses]);

  useEffect(() => {
    tagFilterRef.current =
      sharedTagFilters.length === 1 && !sharedTagFilters[0].includeDescendants ? sharedTagFilters[0].id : null;
  }, [sharedTagFilters]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    setIsSelectionMode(selectedBucketItems.length > 0);
  }, [selectedBucketItems.length]);

  useEffect(() => {
    weekStartRef.current = weekStart;
  }, [weekStart]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!hasMounted) {
      return;
    }
    const timeout = window.setTimeout(() => {
      try {
        const stored = JSON.parse(window.sessionStorage.getItem("echotrace-recording-list-filters") ?? "{}") as Record<string, unknown>;
        window.sessionStorage.setItem(
          "echotrace-recording-list-filters",
          JSON.stringify({
            ...stored,
            categoryFilter,
            categoryFilters: sharedCategoryFilters,
            reviewStatuses: sharedReviewStatuses,
            tags: sharedTagFilters
          })
        );
      } catch {
        // A blocked session store must not prevent filtering in the current view.
      }
    }, 100);
    return () => window.clearTimeout(timeout);
  }, [categoryFilter, hasMounted, sharedCategoryFilters, sharedReviewStatuses, sharedTagFilters]);

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
      return current.some((entry) => entry.id === item.id)
        ? current.filter((entry) => entry.id !== item.id)
        : [...current, item];
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
    setIsMergeDialogOpen(false);
    setMergeDetails([]);
    setMergeError(null);
  }

  function handleRecordingActivate(item: RecordingListItem) {
    if (isSelectionMode) {
      toggleBucketItem(item);
      return;
    }

    setSelectedRecording(item.id);
  }

  function matchesActiveFilters(item: RecordingListItem) {
    if (
      sharedCategoryFilters.length > 0 &&
      !sharedCategoryFilters.includes((item.category ?? "unknown") as CategoryFilterOption)
    ) {
      return false;
    }

    if (sharedReviewStatuses.length > 0 && !sharedReviewStatuses.includes(item.reviewStatus)) {
      return false;
    }

    const selectedTagIds = new Set(
      sharedTagFilters.flatMap((tag) => [tag.id, ...(tag.includeDescendants ? tag.descendantIds : [])])
    );
    if (selectedTagIds.size > 0) {
      return (item.tags ?? []).some((tag) => selectedTagIds.has(tag.tagId));
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

  async function approvePendingSelection() {
    const pendingItems = selectedBucketItems.filter((item) => item.reviewStatus === "pending_review");
    if (pendingItems.length === 0 || isApprovingPendingSelection) {
      return;
    }

    setIsApprovingPendingSelection(true);
    setBucketFeedback(null);

    try {
      const results = await Promise.all(
        pendingItems.map(async (item) => {
          try {
            const reviewResponse = await fetch(`/api/recordings/${item.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reviewStatus: "approved" })
            });

            if (!reviewResponse.ok) {
              return null;
            }

            let updated = (await reviewResponse.json()) as RecordingDetail;
            if ((updated.transcriptionStatus ?? "").trim().toLowerCase() === "open") {
              const transcriptionResponse = await fetch(`/api/recordings/${item.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ transcriptionStatus: "pending" })
              });

              if (transcriptionResponse.ok) {
                updated = (await transcriptionResponse.json()) as RecordingDetail;
              }
            }

            return updated;
          } catch {
            return null;
          }
        })
      );
      const approved = results.filter((result): result is RecordingDetail => result !== null);
      const approvedById = new Map(approved.map((item) => [item.id, item]));
      const applyApprovedStatus = (item: RecordingListItem) => {
        const updated = approvedById.get(item.id);
        return updated
          ? { ...item, category: updated.category, notes: updated.notes, reviewStatus: updated.reviewStatus }
          : item;
      };

      setSelectedBucketItems((current) => current.map(applyApprovedStatus));
      setSearchResults((current) => current.map(applyApprovedStatus));
      setRecordingItems((current) => current.map(applyApprovedStatus).filter(matchesActiveFilters));
      setDetail((current) => (current && approvedById.has(current.id) ? approvedById.get(current.id)! : current));
      setLastUpdatedAt(Date.now());

      const failedCount = pendingItems.length - approved.length;
      setBucketFeedback(
        failedCount === 0
          ? `${approved.length} pending ${approved.length === 1 ? "recording" : "recordings"} approved`
          : `${approved.length} approved · ${failedCount} failed`
      );
      window.setTimeout(() => setBucketFeedback(null), 2400);
    } finally {
      setIsApprovingPendingSelection(false);
    }
  }

  const filteredWeekRecordingItems = useMemo(() => {
    const selectedTagIds = new Set(
      sharedTagFilters.flatMap((tag) => [tag.id, ...(tag.includeDescendants ? tag.descendantIds : [])])
    );
    return recordingItems.filter((item) => {
      const matchesCategory =
        sharedCategoryFilters.length === 0 ||
        sharedCategoryFilters.includes((item.category ?? "unknown") as CategoryFilterOption);
      const matchesReview = sharedReviewStatuses.length === 0 || sharedReviewStatuses.includes(item.reviewStatus);
      const matchesTags =
        selectedTagIds.size === 0 || (item.tags ?? []).some((tag) => selectedTagIds.has(tag.tagId));
      return matchesCategory && matchesReview && matchesTags;
    });
  }, [recordingItems, sharedCategoryFilters, sharedReviewStatuses, sharedTagFilters]);

  const totalDurationMinutes = useMemo(
    () =>
      filteredWeekRecordingItems.reduce((sum, item) => {
        const diffMs = new Date(item.endedAt).getTime() - new Date(item.startedAt).getTime();
        return sum + Math.max(Math.round(diffMs / 60000), 0);
      }, 0),
    [filteredWeekRecordingItems]
  );
  const visibleWeekEnd = useMemo(() => {
    const saturdayKey = toDateKey(addWeeks(weekStart, 0));
    void saturdayKey;
    const saturday = new Date(weekStart);
    saturday.setDate(weekStart.getDate() + 5);
    const sunday = new Date(weekStart);
    sunday.setDate(weekStart.getDate() + 6);

    const hasWeekendRecordings = filteredWeekRecordingItems.some((item) => {
      const itemKey = toDateKey(new Date(item.startedAt));
      return itemKey === toDateKey(saturday) || itemKey === toDateKey(sunday);
    });

    return hasWeekendRecordings ? sunday : new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 4);
  }, [filteredWeekRecordingItems, weekStart]);
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
  const hasDefaultReviewFilters =
    sharedReviewStatuses.length === 2 &&
    sharedReviewStatuses.includes("approved") &&
    sharedReviewStatuses.includes("pending_review");
  const hasDefaultCategoryFilters =
    sharedCategoryFilters.length === DEFAULT_CATEGORY_FILTERS.length &&
    DEFAULT_CATEGORY_FILTERS.every((category) => sharedCategoryFilters.includes(category));
  const hasActiveFilters = !hasDefaultCategoryFilters || !hasDefaultReviewFilters || sharedTagFilters.length > 0;
  const todayKey = toDateKey(new Date());
  const isViewingToday = isMobile
    ? currentMobileDay === todayKey
    : toDateKey(startOfWeek(weekStart)) === toDateKey(startOfWeek(new Date()));

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
          setSearchResults(payload.recordings.filter(matchesActiveFilters));
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
  }, [searchQuery, sharedCategoryFilters, sharedReviewStatuses, sharedTagFilters]);

  useEffect(() => {
    async function autoRefresh() {
      if (document.hidden) {
        return;
      }

      setIsAutoRefreshing(true);

      try {
        const params = new URLSearchParams();
        params.set("categoryFilter", "all");
        params.set("includeRejected", "true");
        params.set("reviewFilter", "all");
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

  async function openMergeDialog() {
    if (selectedBucketItems.length < 2) {
      return;
    }

    setIsMergeDialogOpen(true);
    setIsLoadingMerge(true);
    setMergeError(null);
    try {
      const details = await fetchSelectedRecordingDetails();
      if (details.length < 2) {
        setMergeError("At least two recordings must still be available.");
        return;
      }
      setMergeDetails(details);
      setMergeTitle(buildMergeTitleSuggestions(details)[0] ?? "Combined recording");
      setMergeAudio(details.every((detail) => Boolean(detail.audioUrl)));
    } finally {
      setIsLoadingMerge(false);
    }
  }

  function moveMergeRecording(index: number, direction: -1 | 1) {
    setMergeDetails((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) {
        return current;
      }
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  async function mergeSelectedRecordings() {
    if (mergeDetails.length < 2 || !mergeTitle.trim()) {
      return;
    }

    setIsMerging(true);
    setMergeError(null);
    const requestPayload = {
      recordingIds: mergeDetails.map((recording) => recording.id),
      title: mergeTitle.trim(),
      mergeAudio
    };
    let stage = "prepare-request";

    try {
      console.info("[merge-client] starting", {
        mergeAudio,
        recordingCount: requestPayload.recordingIds.length,
        recordingIds: requestPayload.recordingIds
      });
      stage = "fetch";
      const response = await fetch("/api/recordings/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload)
      });

      stage = "read-response";
      const responseText = await response.text();
      console.info("[merge-client] response received", {
        contentType: response.headers.get("content-type"),
        responseLength: responseText.length,
        status: response.status
      });

      stage = "parse-response";
      let payload: { recording?: RecordingDetail; warning?: string | null; message?: string };
      try {
        payload = JSON.parse(responseText) as { recording?: RecordingDetail; warning?: string | null; message?: string };
      } catch (error) {
        await reportMergeClientError(stage, error, {
          contentType: response.headers.get("content-type"),
          responsePreview: responseText.slice(0, 1000),
          status: response.status,
          ...requestPayload
        });
        setMergeError(
          response.status === 504
            ? "The audio merge exceeded the gateway time limit. It may still finish on the server; refresh before trying again."
            : `Invalid server response (${response.status}). See server logs for details.`
        );
        return;
      }

      if (!response.ok || !payload.recording) {
        console.error("[merge-client] server rejected merge", { payload, status: response.status });
        setMergeError(payload.message ?? "The recordings could not be combined.");
        return;
      }

      stage = "update-client-state";
      const merged = payload.recording;
      const mergedSourceIds = new Set(mergeDetails.map((item) => item.id));
      setRecordingItems((current) =>
        [
          ...current
            .filter((item) => item.id !== merged.id)
            .map((item) => (mergedSourceIds.has(item.id) ? { ...item, reviewStatus: "rejected" as const } : item)),
          merged
        ]
          .filter(matchesActiveFilters)
          .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
      );
      setSearchResults((current) =>
        current.map((item) => (mergedSourceIds.has(item.id) ? { ...item, reviewStatus: "rejected" } : item))
      );
      setDetail(merged);
      setBucketFeedback(payload.warning ?? "Recordings combined");
      window.setTimeout(() => setBucketFeedback(null), payload.warning ? 6000 : 2400);
      setIsMergeDialogOpen(false);
      setIsSelectionMode(false);
      setSelectedBucketItems([]);
      setMergeDetails([]);
      stage = "open-merged-recording";
      setSelectedRecording(merged.id);
      console.info("[merge-client] completed", { id: merged.id, warning: payload.warning ?? null });
    } catch (error) {
      await reportMergeClientError(stage, error, requestPayload);
      const details = getClientErrorDetails(error);
      setMergeError(`${details.message} · stage: ${stage}`);
    } finally {
      setIsMerging(false);
    }
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
      const filteredPayload = payload.filter(matchesActiveFilters);
      setSearchResults(filteredPayload);
      setIsSearchOpen(true);

      if (isSelectionMode) {
        let addedCount = 0;
        setSelectedBucketItems((current) => {
          const existingIds = new Set(current.map((item) => item.id));
          const additions = filteredPayload.filter((item) => !existingIds.has(item.id));
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
  const pendingReviewSelectionCount = useMemo(
    () => selectedBucketItems.filter((item) => item.reviewStatus === "pending_review").length,
    [selectedBucketItems]
  );

  function toggleCalendarViewMode() {
    const params = searchParams.toString();
    const targetPath = calendarViewMode === "week" ? "/list" : "/week";
    router.push(`${targetPath}${params ? `?${params}` : ""}`, { scroll: false });
  }

  function renderSelectionActions() {
    return (
      <>
        {pendingReviewSelectionCount > 0 ? (
          <button
            className="inline-flex h-7 cursor-pointer items-center rounded bg-emerald-600 px-3 text-[9px] font-medium leading-none text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isApprovingPendingSelection}
            onClick={() => void approvePendingSelection()}
            type="button"
          >
            {isApprovingPendingSelection ? "Approving…" : `Approve ${pendingReviewSelectionCount} pending`}
          </button>
        ) : null}
        <button
          className="inline-flex h-7 cursor-pointer items-center rounded border border-[var(--line-strong)] bg-[var(--surface-strong)] px-3 text-[9px] font-medium leading-none text-[var(--text)] transition hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={selectedBucketItems.length < 2}
          onClick={() => void openMergeDialog()}
          type="button"
        >
          Combine recordings
        </button>
        <button
          className="inline-flex h-7 cursor-pointer items-center rounded bg-blue-600 px-3 text-[9px] font-medium leading-none text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={selectedBucketItems.length === 0}
          onClick={() => void downloadSelectedRecordingsMarkdown()}
          type="button"
        >
          Download Markdown
        </button>
        <button
          className="inline-flex h-7 cursor-pointer items-center rounded border border-[var(--line)] bg-[var(--surface)] px-3 text-[9px] font-medium leading-none text-[var(--text)] transition hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-50"
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
      </>
    );
  }

  return (
    <main className="min-h-screen px-3 pb-4 pt-[3.75rem] md:pl-[6.5rem] md:pr-8 md:py-8">
      <AppNavigation activeProfileEmail={activeProfileEmail} buildSha={buildSha} buildTime={buildTime} />
      <div className={`mx-auto flex w-full flex-col gap-6 md:gap-8 ${calendarViewMode === "list" ? "max-w-none" : "max-w-[1400px]"}`}>
        <section className="hidden md:block">
          <div
            className={`grid gap-6 py-1 md:items-center ${
              calendarViewMode === "week" ? "md:grid-cols-[1.2fr_0.8fr]" : ""
            }`}
          >
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  EchoTrace
                </span>
                <button
                  aria-label={`Switch to ${calendarViewMode === "week" ? "list" : "week"} view`}
                  className="cursor-pointer appearance-none border-0 bg-transparent p-0"
                  onClick={toggleCalendarViewMode}
                  title={`Switch to ${calendarViewMode === "week" ? "List View" : "Week View"}`}
                  type="button"
                >
                  <span className="block rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-400 transition hover:border-blue-400/50 hover:bg-blue-500/20">
                    {calendarViewMode === "week" ? "Week View" : "List View"}
                  </span>
                </button>
              </div>
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <BrandMark />
                  <div className="space-y-2">
                    <h1 className="max-w-3xl text-[24px] font-semibold tracking-[-0.035em] text-balance md:text-[30px]">
                      Your week listens in.
                    </h1>
                    <p className="max-w-xl text-[13px] leading-6 text-[var(--muted)] md:text-[15px]">
                      {calendarViewMode === "week"
                        ? "Recordings, transcripts, and timeline in a clear weekly view."
                        : "All recordings in a filterable table, loaded as you scroll."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {calendarViewMode === "week" ? <div className="grid content-start">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
                  Week Snapshot
                </p>
                <div className="mt-2 grid grid-cols-[0.8fr_0.7fr_minmax(9rem,1.25fr)] gap-2 md:gap-3">
                  <StatCard label="Recordings" value={String(filteredWeekRecordingItems.length).padStart(2, "0")} />
                  <StatCard
                    label="Days"
                    value={String(new Set(filteredWeekRecordingItems.map((item) => toDateKey(new Date(item.startedAt)))).size).padStart(2, "0")}
                  />
                  <StatCard label="Week Time" value={formatMinutesCompact(totalDurationMinutes)} />
                </div>
              </div>
            </div> : null}
          </div>
        </section>

        <section className="grid gap-4">
          <div className={`glass-panel border border-zinc-800 ${calendarViewMode === "list" ? "overflow-hidden" : "overflow-visible"}`}>
            <div
              className={`flex flex-col gap-3 border-b border-zinc-800 px-4 py-3 md:flex-row md:flex-nowrap md:items-center md:px-4 ${
                calendarViewMode === "list" ? "md:hidden" : ""
              }`}
            >
              {calendarViewMode === "week" ? <div className="flex shrink-0 items-center gap-2">
                  <RangeButton direction="left" onClick={() => navigateCalendar(-1)} />
                  <p className="min-w-0 flex-1 text-[16px] font-semibold tracking-[-0.025em] text-[var(--text)] md:min-w-[220px] md:flex-none md:text-[18px]">
                    {calendarHeaderLabel}
                  </p>
                  <RangeButton direction="right" onClick={() => navigateCalendar(1)} />
                  {!isViewingToday ? (
                    <TodayButton disabled={navPending} onClick={navigateToCurrentWeek} />
                  ) : null}
              </div> : null}
              <div className="flex min-w-0 w-full flex-col gap-2 md:flex-1 md:flex-row md:items-center">
                {calendarViewMode === "week" ? <div className="relative w-full md:min-w-[240px] md:flex-1" ref={searchRef}>
                  <div className="flex h-10 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 transition focus-within:border-zinc-600">
                    <SearchIcon />
                    <input
                      className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text)] outline-none"
                      onChange={(event) => {
                        setSearchQuery(event.target.value);
                        setIsSearchOpen(true);
                      }}
                      onFocus={() => setIsSearchOpen(true)}
                      placeholder="Search recordings, sources, topics, text..."
                      ref={searchInputRef}
                      value={searchQuery}
                    />
                    {searchQuery ? (
                      <button
                        aria-label="Clear search"
                        className="-mr-1 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
                        onClick={() => {
                          setSearchQuery("");
                          setSearchResults([]);
                          setSearchTagResults([]);
                          setActiveSearchTag(null);
                          setIsSearchOpen(false);
                          searchInputRef.current?.focus();
                        }}
                        title="Clear search"
                        type="button"
                      >
                        <ClearSearchIcon />
                      </button>
                    ) : null}
                  </div>
                  {isSearchOpen && searchQuery.trim() ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-30 max-h-[50dvh] touch-pan-y overflow-y-auto overscroll-contain rounded-[18px] border border-[rgba(226,232,240,0.92)] bg-white/98 p-2 shadow-[0_20px_44px_rgba(15,23,42,0.1)] backdrop-blur [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch] md:max-h-[min(60dvh,36rem)]">
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
                </div> : null}
                <div className="flex shrink-0 items-center justify-end gap-2">
                  <button
                    className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-blue-400 transition hover:bg-blue-500/20 md:hidden"
                    onClick={toggleCalendarViewMode}
                    type="button"
                  >
                    {calendarViewMode === "week" ? "List View" : "Week View"}
                  </button>
                  {calendarViewMode === "week" ? (
                    <button
                      className={`inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border px-3 text-xs font-semibold transition ${
                        isSelectionMode
                          ? "border-blue-500/50 bg-blue-500/15 text-blue-400"
                          : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700"
                      }`}
                      onClick={() => {
                        if (isSelectionMode) {
                          exitSelectionMode();
                        } else {
                          setDetail(null);
                          setSelectedRecording(null);
                          setIsSelectionMode(true);
                        }
                      }}
                      type="button"
                    >
                      {isSelectionMode ? "Exit selection" : "Selection Bucket"}
                    </button>
                  ) : null}
                  {calendarViewMode === "week" ? <div className="relative" ref={filtersRef}>
                    <button
                      className={`inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition ${
                        hasActiveFilters
                          ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                          : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700"
                      }`}
                      onClick={() => setFiltersOpen((value) => !value)}
                      type="button"
                    >
                      <FilterIcon />
                      Filters
                      <ChevronDown />
                    </button>
                  {filtersOpen ? (
                    <div className="absolute right-0 top-[calc(100%+10px)] z-20 w-[min(92vw,380px)] rounded-[18px] border border-[rgba(226,232,240,0.92)] bg-white/98 p-3 shadow-[0_20px_44px_rgba(15,23,42,0.1)] backdrop-blur md:w-[400px]">
                      <div className="space-y-3">
                        <div className="rounded-[14px] border border-[rgba(226,232,240,0.75)] bg-[rgba(248,250,252,0.92)] p-3">
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                            Type
                          </p>
                          <CategoryMultiFilter
                            onChange={setSharedCategoryFilters}
                            value={sharedCategoryFilters}
                          />
                        </div>
                        <div className="rounded-[14px] border border-[rgba(226,232,240,0.75)] bg-[rgba(248,250,252,0.92)] p-3">
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                            Review
                          </p>
                          <ReviewMultiFilter
                            onChange={(values) => {
                              setSharedReviewStatuses(values);
                              const legacyValue = values.length === 1 ? values[0] : "all";
                              setReviewFilter(legacyValue);
                              reviewFilterRef.current = legacyValue;
                              updateUrlState({ reviewFilter: legacyValue });
                            }}
                            value={sharedReviewStatuses}
                          />
                        </div>
                        <div className="rounded-[14px] border border-[rgba(226,232,240,0.75)] bg-[rgba(248,250,252,0.92)] p-3">
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                            Tags
                          </p>
                          <RecordingTagFilter selectedTags={sharedTagFilters} setSelectedTags={setSharedTagFilters} />
                        </div>
                        {hasActiveFilters ? (
                          <button
                            className="w-full cursor-pointer rounded-xl border border-[rgba(226,232,240,0.95)] bg-white px-3 py-2.5 text-sm font-semibold text-[var(--text)] transition hover:bg-[rgba(59,130,246,0.08)]"
                            onClick={() => {
                              setSharedCategoryFilters([...DEFAULT_CATEGORY_FILTERS]);
                              categoryFilterRef.current = "work";
                              setReviewFilter("all");
                              reviewFilterRef.current = "all";
                              setSharedReviewStatuses(["approved", "pending_review"]);
                              setTagFilter(null);
                              tagFilterRef.current = null;
                              setSharedTagFilters([]);
                              updateUrlState({ categoryFilter: "work", reviewFilter: "all", tagFilter: null });
                            }}
                            type="button"
                          >
                            Reset filters
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div> : null}
                </div>
              </div>
            </div>
            {calendarViewMode === "week" && isSelectionMode ? (
              <div className="border-b border-[var(--line)] bg-[var(--accent-soft)] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text)]">Selection Bucket</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{selectedBucketItems.length} recordings selected</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {renderSelectionActions()}
                    <button
                      className="inline-flex h-7 cursor-pointer items-center rounded border border-[var(--line)] bg-[var(--surface)] px-3 text-[9px] font-medium leading-none text-[var(--muted)] transition hover:text-[var(--text)]"
                      onClick={exitSelectionMode}
                      type="button"
                    >
                      Clear selection
                    </button>
                  </div>
                </div>
                {bucketFeedback ? <p className="mt-2 text-xs font-semibold text-[var(--accent)]">{bucketFeedback}</p> : null}
                {selectedBucketItems.length > 0 ? (
                  <div className="mt-3 flex max-h-28 flex-wrap gap-2 overflow-y-auto">
                    {selectedBucketItems.map((item) => (
                      <div className="inline-flex max-w-full items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5" key={item.id}>
                        <span className="max-w-[240px] truncate text-xs font-semibold text-[var(--text)]">{item.title}</span>
                        <button
                          aria-label={`Remove ${item.title} from selection`}
                          className="cursor-pointer text-xs text-[var(--muted)] transition hover:text-[var(--text)]"
                          onClick={() => toggleBucketItem(item)}
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-[var(--muted)]">Select individual recordings or add an entire day from the calendar.</p>
                )}
              </div>
            ) : null}
            {calendarViewMode === "week" ? (
              <WeekCalendar
                isSelectionMode={isSelectionMode}
                mobileDayKey={isMobile ? currentMobileDay : null}
                recordings={filteredWeekRecordingItems}
                selectedBucketIds={selectedBucketIds}
                selectedId={selectedId}
                onSelectDay={addDayToBucket}
                onSelect={(id) => {
                  const item = filteredWeekRecordingItems.find((entry) => entry.id === id);
                  if (item) {
                    handleRecordingActivate(item);
                  }
                }}
                weekStart={initialWeekStart}
                todayKey={todayKey}
              />
            ) : (
              <RecordingListView
                selectedCategoryFilters={sharedCategoryFilters}
                onClearSelection={exitSelectionMode}
                selectedBucketIds={selectedBucketIds}
                selectedBucketItems={selectedBucketItems}
                selectedId={selectedId}
                selectedReviewStatuses={sharedReviewStatuses}
                selectedTags={sharedTagFilters}
                setSelectedCategoryFilters={setSharedCategoryFilters}
                setSelectedReviewStatuses={setSharedReviewStatuses}
                setSelectedTags={setSharedTagFilters}
                onSelect={(item) => setSelectedRecording(item.id)}
                onToggleSelection={toggleBucketItem}
                selectionFeedback={bucketFeedback}
                selectionActions={renderSelectionActions()}
              />
            )}
            <div className="flex justify-end border-t border-zinc-800 px-3 py-1.5">
              <LiveUpdateBadge
                className="inline-flex"
                hasMounted={hasMounted}
                isRefreshing={isAutoRefreshing}
                lastUpdatedAt={lastUpdatedAt}
              />
            </div>
          </div>
        </section>
      </div>
      {selectedId ? (
        <RecordingDetailPanel
          detail={detail}
          isLoading={detailLoading}
          onDeleted={(id) => {
            setDetail(null);
            setSelectedRecording(null);
            setRecordingItems((current) => current.filter((item) => item.id !== id));
            setSearchResults((current) => current.filter((item) => item.id !== id));
            setSelectedBucketItems((current) => current.filter((item) => item.id !== id));
            setLastUpdatedAt(Date.now());
          }}
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
      {isMergeDialogOpen ? (
        <MergeRecordingsDialog
          details={mergeDetails}
          error={mergeError}
          isLoading={isLoadingMerge}
          isMerging={isMerging}
          mergeAudio={mergeAudio}
          onClose={() => !isMerging && setIsMergeDialogOpen(false)}
          onMerge={() => void mergeSelectedRecordings()}
          onMove={moveMergeRecording}
          setMergeAudio={setMergeAudio}
          setTitle={setMergeTitle}
          title={mergeTitle}
        />
      ) : null}
      {!isSelectionMode && bucketFeedback ? (
        <div className="fixed bottom-5 left-1/2 z-[90] -translate-x-1/2 rounded-full border border-white/80 bg-[rgba(15,23,42,0.94)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(15,23,42,0.24)]">
          {bucketFeedback}
        </div>
      ) : null}
    </main>
  );
}

function MergeRecordingsDialog({
  details,
  error,
  isLoading,
  isMerging,
  mergeAudio,
  onClose,
  onMerge,
  onMove,
  setMergeAudio,
  setTitle,
  title
}: {
  details: RecordingDetail[];
  error: string | null;
  isLoading: boolean;
  isMerging: boolean;
  mergeAudio: boolean;
  onClose: () => void;
  onMerge: () => void;
  onMove: (index: number, direction: -1 | 1) => void;
  setMergeAudio: (value: boolean) => void;
  setTitle: (value: string) => void;
  title: string;
}) {
  const titleSuggestions = buildMergeTitleSuggestions(details);
  const availableAudioCount = details.filter((detail) => Boolean(detail.audioUrl)).length;
  const canMergeAudio = details.length > 0 && availableAudioCount === details.length;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(15,23,42,0.36)] p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section aria-labelledby="merge-dialog-title" aria-modal="true" className="max-h-[94vh] w-full overflow-hidden rounded-t-[28px] border border-white/80 bg-[rgba(248,250,252,0.98)] p-1.5 shadow-[0_32px_80px_rgba(15,23,42,0.24)] sm:max-w-2xl sm:rounded-[30px]" role="dialog">
        <div className="merge-dialog-scroll max-h-[calc(94vh-12px)] overflow-y-auto rounded-t-[22px] p-[14px] sm:rounded-[24px] sm:p-[22px]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Merge process</p>
            <h2 id="merge-dialog-title" className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text)]">Combine recordings</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">All transcript text is retained. The order below defines the synchronized timeline and the divider positions.</p>
          </div>
          <button className="cursor-pointer rounded-full border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-[var(--muted)]" disabled={isMerging} onClick={onClose} type="button">Close</button>
        </div>

        {isLoading ? <p className="mt-6 rounded-2xl bg-white p-4 text-sm text-[var(--muted)]">Loading transcripts…</p> : (
          <>
            <div className="mt-6">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]" htmlFor="merge-title">Combined title</label>
              <input id="merge-title" className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-[rgba(59,130,246,0.5)]" maxLength={255} onChange={(event) => setTitle(event.target.value)} value={title} />
              <div className="mt-2 flex flex-wrap gap-2">
                {titleSuggestions.map((suggestion) => (
                  <button key={suggestion} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition ${title === suggestion ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] bg-white text-[var(--muted)]"}`} onClick={() => setTitle(suggestion)} type="button">{suggestion}</button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Timeline order</p>
                <span className="text-xs text-[var(--muted)]">{details.length} transcripts</span>
              </div>
              <p className="mt-1 text-[10px] leading-4 text-zinc-600">
                Generic labels are namespaced by source order: A/B become A1/B1, then A2/B2. Named speakers stay unchanged.
              </p>
              <div className="mt-3 space-y-2">
                {details.map((detail, index) => (
                  <div key={detail.id}>
                    {index > 0 ? <div className="my-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]"><span className="h-px flex-1 bg-[var(--line)]" />Divider at {formatSentenceOffset(details.slice(0, index).reduce((sum, item) => sum + getRecordingDurationMs(item), 0))}<span className="h-px flex-1 bg-[var(--line)]" /></div> : null}
                    <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white p-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(15,23,42,0.92)] text-xs font-semibold text-white">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--text)]">{detail.title}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{formatSentenceOffset(getRecordingDurationMs(detail))} · {detail.sentences.length} segments · {detail.audioUrl ? "Audio available" : "No audio"}</p>
                        <SpeakerMergePreview detail={detail} sourceIndex={index} />
                      </div>
                      <div className="flex gap-1">
                        <button aria-label={`Move ${detail.title} up`} className="cursor-pointer rounded-lg border border-[var(--line)] px-2 py-1 text-xs disabled:opacity-30" disabled={index === 0} onClick={() => onMove(index, -1)} type="button">↑</button>
                        <button aria-label={`Move ${detail.title} down`} className="cursor-pointer rounded-lg border border-[var(--line)] px-2 py-1 text-xs disabled:opacity-30" disabled={index === details.length - 1} onClick={() => onMove(index, 1)} type="button">↓</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--line)] bg-white p-4">
              <input checked={mergeAudio} className="mt-1 h-4 w-4 accent-[var(--accent)]" disabled={!canMergeAudio} onChange={(event) => setMergeAudio(event.target.checked)} type="checkbox" />
              <span>
                <span className="block text-sm font-semibold text-[var(--text)]">Combine audio files</span>
                <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">{availableAudioCount}/{details.length} audio streams are advertised. Audio is created only when every source file is available; the transcript merge still succeeds otherwise.</span>
              </span>
            </label>
          </>
        )}

        {error ? <p className="mt-4 rounded-2xl border border-[rgba(248,113,113,0.3)] bg-[rgba(254,242,242,0.96)] px-4 py-3 text-sm text-[rgba(185,28,28,0.95)]">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <button className="cursor-pointer rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--text)]" disabled={isMerging} onClick={onClose} type="button">Cancel</button>
          <button className="cursor-pointer rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={isLoading || isMerging || details.length < 2 || !title.trim()} onClick={onMerge} type="button">{isMerging ? "Combining…" : "Create combined recording"}</button>
        </div>
        </div>
      </section>
    </div>
  );
}

function SpeakerMergePreview({ detail, sourceIndex }: { detail: RecordingDetail; sourceIndex: number }) {
  const labels = [
    ...new Set(
      detail.sentences
        .map((sentence) => sentence.speaker?.trim())
        .filter((speaker): speaker is string => Boolean(speaker))
    )
  ];

  if (labels.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-zinc-600">Speakers</span>
      {labels.map((label) => {
        const isRenamed = isGenericSpeakerLabel(label);

        return (
          <span
            className={`rounded-md border px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[9px] ${
              isRenamed
                ? "border-zinc-700 bg-zinc-800 text-zinc-300"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
            key={label}
          >
            {isRenamed ? `${label} → ${getMergedSpeakerLabel(label, sourceIndex)}` : `${label} · unchanged`}
          </span>
        );
      })}
    </div>
  );
}

function getRecordingDurationMs(detail: RecordingDetail) {
  return Math.max(detail.durationMs ?? 0, ...detail.sentences.map((sentence) => sentence.endMs), new Date(detail.endedAt).getTime() - new Date(detail.startedAt).getTime(), 1);
}

function buildMergeTitleSuggestions(details: RecordingDetail[]) {
  if (details.length === 0) {
    return [];
  }
  const titles = details.map((detail) => detail.title.trim()).filter(Boolean);
  const sharedTitle = titles[0] ?? "Combined recording";
  const allTitlesMatch = titles.length === details.length && titles.every((title) => title.toLocaleLowerCase() === sharedTitle.toLocaleLowerCase());
  const joined = titles.join(" + ");
  const date = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(details[0]!.startedAt));
  return [...new Set([
    (allTitlesMatch ? sharedTitle : joined).slice(0, 255),
    `${sharedTitle} – combined`.slice(0, 255),
    `Combined recordings · ${date}`
  ])];
}

function ReviewMultiFilter({
  onChange,
  value
}: {
  onChange: (value: ReviewStatus[]) => void;
  value: ReviewStatus[];
}) {
  return (
    <div className="flex flex-wrap justify-center gap-1 rounded-xl border border-[var(--line)] bg-white p-1.5">
      {([
        ["approved", "Approved"],
        ["pending_review", "Pending"],
        ["rejected", "Rejected"]
      ] as const).map(([status, label]) => {
        const active = value.includes(status);
        return (
          <button
            aria-pressed={active}
            className={`cursor-pointer rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition ${
              active
                ? getReviewFilterStatusClass(status)
                : "border-transparent text-[var(--muted)] hover:bg-[var(--surface-strong)] hover:text-[var(--text)]"
            }`}
            key={status}
            onClick={() => onChange(active ? value.filter((item) => item !== status) : [...value, status])}
            type="button"
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function getReviewFilterStatusClass(status: ReviewStatus) {
  if (status === "approved") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600";
  }
  if (status === "rejected") {
    return "border-red-500/30 bg-red-500/10 text-red-600";
  }
  return "border-amber-500/30 bg-amber-500/10 text-amber-600";
}

function CategoryMultiFilter({
  onChange,
  value
}: {
  onChange: (value: CategoryFilterOption[]) => void;
  value: CategoryFilterOption[];
}) {
  return (
    <div className="flex flex-wrap justify-center gap-1 rounded-xl border border-[var(--line)] bg-white p-1.5">
      {([
        ["work", "Work"],
        ["private", "Private"],
        ["unknown", "Unknown"]
      ] as const).map(([category, label]) => {
        const active = value.includes(category);
        return (
          <button
            aria-pressed={active}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition ${
              active ? getCategoryFilterClass(category) : "border-transparent text-[var(--muted)] hover:bg-[var(--surface-strong)] hover:text-[var(--text)]"
            }`}
            key={category}
            onClick={() => onChange(active ? value.filter((item) => item !== category) : [...value, category])}
            type="button"
          >
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${getCategoryDotClass(category)}`} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function getCategoryFilterClass(category: CategoryFilterOption) {
  if (category === "work") {
    return "border-blue-500/40 bg-blue-500/10 text-blue-600";
  }
  if (category === "private") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-600";
  }
  return "border-zinc-500 bg-zinc-700 text-white";
}

function getCategoryDotClass(category: CategoryFilterOption) {
  if (category === "work") {
    return "bg-blue-500";
  }
  if (category === "private") {
    return "bg-emerald-500";
  }
  return "border border-zinc-400 bg-white";
}

function TodayButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button
      aria-label="Jump to today"
      className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 transition hover:border-blue-500/50 hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60 md:h-10 md:w-10"
      disabled={disabled}
      onClick={onClick}
      title="Jump to today"
      type="button"
    >
      <span className="flex size-7 items-center justify-center rounded-full border-[3px] border-blue-400/80 text-zinc-300">
        <TodayCalendarIcon />
      </span>
    </button>
  );
}

function TodayCalendarIcon() {
  return (
    <svg aria-hidden="true" className="size-3.5" fill="none" viewBox="0 0 16 16">
      <rect height="10" rx="2" stroke="currentColor" strokeWidth="1.3" width="11" x="2.5" y="3.5" />
      <path d="M5 2.5v2M11 2.5v2M2.5 6.5h11" stroke="currentColor" strokeLinecap="round" strokeWidth="1.3" />
      <circle cx="8" cy="10" fill="currentColor" r="1.15" />
    </svg>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-center">
      <p className="whitespace-nowrap text-lg font-bold tracking-[-0.03em] text-zinc-100 md:text-[22px]">{value}</p>
      <p className="mt-1 text-[10px] text-zinc-500">{label}</p>
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
      className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-500 transition hover:border-zinc-600 hover:bg-zinc-700 hover:text-zinc-100 md:h-10 md:w-10"
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

function ClearSearchIcon() {
  return (
    <svg aria-hidden="true" className="size-3.5" fill="none" viewBox="0 0 24 24">
      <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
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
      className={`items-center gap-1.5 whitespace-nowrap px-1 text-[9px] font-medium text-zinc-600 ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isRefreshing ? "animate-pulse bg-[var(--accent)]" : "bg-emerald-500"}`}
      />
      <span suppressHydrationWarning>{isRefreshing ? "Refreshing..." : hasMounted ? `Updated ${formatSyncTime(lastUpdatedAt)}` : "Updated --:--:--"}</span>
    </div>
  );
}

function formatSyncTime(timestamp: number) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Berlin"
  }).format(new Date(timestamp));
}
