"use client";

import { type Dispatch, type ReactNode, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { RecordingTagFilter, type RecordingListTagFilter } from "@/components/recording-tag-filter";
import { formatDuration, formatTime } from "@/lib/time";
import type { RecordingListItem, ReviewStatus } from "@/lib/types";

const PAGE_SIZE = 50;
const FILTER_STORAGE_KEY = "echotrace-recording-list-filters";
const DEFAULT_CATEGORY_FILTERS: CategoryFilterOption[] = ["work", "unknown"];
const DEFAULT_REVIEW_STATUSES: ReviewStatus[] = ["approved", "pending_review"];
const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "short",
  weekday: "short",
  year: "numeric",
  timeZone: "Europe/Berlin"
});

type SortColumn = "category" | "date" | "duration" | "review" | "text" | "title";
type SortDirection = "asc" | "desc";
type CategoryFilterOption = "work" | "private" | "unknown";

type RecordingListViewProps = {
  onClearSelection: () => void;
  onSelect: (recording: RecordingListItem) => void;
  onToggleSelection: (recording: RecordingListItem) => void;
  selectedBucketItems: RecordingListItem[];
  selectedBucketIds: string[];
  selectedCategoryFilters: CategoryFilterOption[];
  selectedId: string | null;
  selectedReviewStatuses: ReviewStatus[];
  selectedTags: RecordingListTagFilter[];
  setSelectedCategoryFilters: Dispatch<SetStateAction<CategoryFilterOption[]>>;
  setSelectedReviewStatuses: Dispatch<SetStateAction<ReviewStatus[]>>;
  setSelectedTags: Dispatch<SetStateAction<RecordingListTagFilter[]>>;
  selectionActions: ReactNode;
  selectionFeedback: string | null;
};

type RecordingPage = {
  hasMore: boolean;
  items: RecordingListItem[];
  total: number;
};

function getDurationMs(recording: RecordingListItem) {
  return Math.max(new Date(recording.endedAt).getTime() - new Date(recording.startedAt).getTime(), 0);
}

export function RecordingListView({
  onClearSelection,
  onSelect,
  onToggleSelection,
  selectedBucketItems,
  selectedBucketIds,
  selectedCategoryFilters,
  selectedId,
  selectedReviewStatuses,
  selectedTags,
  setSelectedCategoryFilters,
  setSelectedReviewStatuses,
  setSelectedTags,
  selectionActions,
  selectionFeedback
}: RecordingListViewProps) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [hasRestoredFilters, setHasRestoredFilters] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [recordings, setRecordings] = useState<RecordingListItem[]>([]);
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [titleQuery, setTitleQuery] = useState("");
  const [totalRecordings, setTotalRecordings] = useState(0);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const requestVersionRef = useRef(0);
  const selectedBucketIdSet = useMemo(() => new Set(selectedBucketIds), [selectedBucketIds]);
  const selectedTagIds = useMemo(
    () => [...new Set(selectedTags.flatMap((tag) => [tag.id, ...(tag.includeDescendants ? tag.descendantIds : [])]))].join(","),
    [selectedTags]
  );
  const hasDefaultReviewStatuses =
    selectedReviewStatuses.length === DEFAULT_REVIEW_STATUSES.length &&
    DEFAULT_REVIEW_STATUSES.every((status) => selectedReviewStatuses.includes(status));
  const hasDefaultCategoryFilters =
    selectedCategoryFilters.length === DEFAULT_CATEGORY_FILTERS.length &&
    DEFAULT_CATEGORY_FILTERS.every((category) => selectedCategoryFilters.includes(category));
  const hasActiveFilters = Boolean(
    !hasDefaultCategoryFilters ||
      dateFrom ||
      dateTo ||
      query.trim() ||
      !hasDefaultReviewStatuses ||
      selectedTags.length > 0 ||
      titleQuery.trim()
  );

  const buildPageUrl = useCallback(
    (offset: number) => {
      const params = new URLSearchParams({
        categories: selectedCategoryFilters.join(","),
        dateFrom,
        dateTo,
        includeRejected: "true",
        limit: String(PAGE_SIZE),
        offset: String(offset),
        q: query.trim(),
        reviewStatuses: selectedReviewStatuses.join(","),
        scope: "all",
        tagIds: selectedTagIds,
        titleQuery: titleQuery.trim()
      });
      return `/api/recordings?${params.toString()}`;
    },
    [dateFrom, dateTo, query, selectedCategoryFilters, selectedReviewStatuses, selectedTagIds, titleQuery]
  );

  function clearAllFilters() {
    setSelectedCategoryFilters([...DEFAULT_CATEGORY_FILTERS]);
    setDateFrom("");
    setDateTo("");
    setQuery("");
    setSelectedReviewStatuses([...DEFAULT_REVIEW_STATUSES]);
    setSelectedTags([]);
    setTitleQuery("");
  }

  useEffect(() => {
    try {
      const storedValue = window.sessionStorage.getItem(FILTER_STORAGE_KEY);
      if (storedValue) {
        const stored = JSON.parse(storedValue) as Partial<{
          categoryFilter: "all" | "work" | "private" | "unknown";
          categoryFilters: CategoryFilterOption[];
          dateFrom: string;
          dateTo: string;
          query: string;
          reviewStatuses: ReviewStatus[];
          tags: RecordingListTagFilter[];
          titleQuery: string;
        }>;
        const storedCategories = Array.isArray(stored.categoryFilters)
          ? stored.categoryFilters.filter(isCategoryFilterOption)
          : isCategoryFilterOption(stored.categoryFilter)
            ? [stored.categoryFilter]
            : [...DEFAULT_CATEGORY_FILTERS];
        setSelectedCategoryFilters(storedCategories);
        setDateFrom(isDateInputValue(stored.dateFrom) ? stored.dateFrom : "");
        setDateTo(isDateInputValue(stored.dateTo) ? stored.dateTo : "");
        setQuery(typeof stored.query === "string" ? stored.query : "");
        setSelectedReviewStatuses(
          Array.isArray(stored.reviewStatuses)
            ? stored.reviewStatuses.filter(isReviewStatus)
            : [...DEFAULT_REVIEW_STATUSES]
        );
        setSelectedTags(Array.isArray(stored.tags) ? stored.tags.filter(isSelectedTagFilter) : []);
        setTitleQuery(typeof stored.titleQuery === "string" ? stored.titleQuery : "");
      }
    } catch {
      window.sessionStorage.removeItem(FILTER_STORAGE_KEY);
    } finally {
      setHasRestoredFilters(true);
    }
  }, []);

  useEffect(() => {
    if (!hasRestoredFilters) {
      return;
    }
    window.sessionStorage.setItem(
      FILTER_STORAGE_KEY,
      JSON.stringify({
        categoryFilter: selectedCategoryFilters.length === 1 ? selectedCategoryFilters[0] : "all",
        categoryFilters: selectedCategoryFilters,
        dateFrom,
        dateTo,
        query,
        reviewStatuses: selectedReviewStatuses,
        tags: selectedTags,
        titleQuery
      })
    );
  }, [dateFrom, dateTo, hasRestoredFilters, query, selectedCategoryFilters, selectedReviewStatuses, selectedTags, titleQuery]);

  useEffect(() => {
    if (!hasRestoredFilters) {
      return;
    }
    const controller = new AbortController();
    const requestVersion = ++requestVersionRef.current;
    setIsInitialLoading(true);
    setRecordings([]);
    setTotalRecordings(0);
    setHasMore(false);
    setLoadError(null);
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(buildPageUrl(0), { cache: "no-store", signal: controller.signal });
        if (!response.ok) {
          throw new Error("The recordings could not be loaded.");
        }
        const page = (await response.json()) as RecordingPage;
        if (requestVersion === requestVersionRef.current) {
          setRecordings(page.items);
          setHasMore(page.hasMore);
          setTotalRecordings(page.total);
        }
      } catch (error) {
        if (!controller.signal.aborted && requestVersion === requestVersionRef.current) {
          setRecordings([]);
          setHasMore(false);
          setLoadError(error instanceof Error ? error.message : "The recordings could not be loaded.");
        }
      } finally {
        if (requestVersion === requestVersionRef.current) {
          setIsInitialLoading(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [buildPageUrl, hasRestoredFilters]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isInitialLoading || isLoadingMore) {
      return;
    }
    const requestVersion = requestVersionRef.current;
    setIsLoadingMore(true);
    try {
      const response = await fetch(buildPageUrl(recordings.length), { cache: "no-store" });
      if (!response.ok) {
        throw new Error("More recordings could not be loaded.");
      }
      const page = (await response.json()) as RecordingPage;
      if (requestVersion === requestVersionRef.current) {
        setRecordings((current) => [...current, ...page.items]);
        setHasMore(page.hasMore);
        setTotalRecordings(page.total);
      }
    } catch (error) {
      if (requestVersion === requestVersionRef.current) {
        setLoadError(error instanceof Error ? error.message : "More recordings could not be loaded.");
        setHasMore(false);
      }
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setIsLoadingMore(false);
      }
    }
  }, [buildPageUrl, hasMore, isInitialLoading, isLoadingMore, recordings.length]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMore) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMore();
        }
      },
      { rootMargin: "320px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const sortedRecordings = useMemo(() => {
    return [...recordings].sort((left, right) => {
      let comparison = 0;
      if (sortColumn === "title") {
        comparison = left.title.localeCompare(right.title);
      } else if (sortColumn === "text") {
        comparison = (left.summary ?? "").localeCompare(right.summary ?? "");
      } else if (sortColumn === "category") {
        comparison = (left.category ?? "unknown").localeCompare(right.category ?? "unknown");
      } else if (sortColumn === "duration") {
        comparison = getDurationMs(left) - getDurationMs(right);
      } else if (sortColumn === "review") {
        comparison = left.reviewStatus.localeCompare(right.reviewStatus);
      } else {
        comparison = left.startedAt.localeCompare(right.startedAt);
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [recordings, sortColumn, sortDirection]);

  function changeSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortColumn(column);
    setSortDirection(column === "date" ? "desc" : "asc");
  }

  return (
    <div className="bg-[var(--surface)]">
      <div className="overflow-x-auto">
        <table aria-busy={isInitialLoading || isLoadingMore} className="w-full min-w-[1180px] border-collapse text-left">
          <thead className="border-b border-[var(--line)] bg-[var(--surface-strong)] text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            <tr>
              <th className="w-12 px-4 pb-2 pt-3 text-center">
                <span className="sr-only">Select</span>
              </th>
              <SortableHeader className="w-[230px] px-2" column="date" direction={sortDirection} label="Date & time" onSort={changeSort} selected={sortColumn} />
              <SortableHeader column="title" direction={sortDirection} label="Title" onSort={changeSort} selected={sortColumn} />
              <SortableHeader column="text" direction={sortDirection} label="Text" onSort={changeSort} selected={sortColumn} />
              <SortableHeader className="w-[130px] px-2" column="category" direction={sortDirection} label="Type" onSort={changeSort} selected={sortColumn} />
              <SortableHeader className="w-[145px] px-2" column="review" direction={sortDirection} label="Review" onSort={changeSort} selected={sortColumn} />
              <th className="px-4 pb-2 pt-3">Tags</th>
              <SortableHeader column="duration" direction={sortDirection} label="Duration" onSort={changeSort} selected={sortColumn} />
            </tr>
            <tr className="border-t border-[var(--line)] normal-case tracking-normal">
              <th className="px-4 pb-3 pt-2" />
              <th className="px-2 pb-3 pt-2">
                <div className="grid min-w-[220px] grid-cols-2 gap-1">
                  <input
                    aria-label="Start date"
                    className="h-8 min-w-0 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-xs font-normal text-[var(--text)] outline-none focus:border-[var(--line-strong)]"
                    max={dateTo || undefined}
                    onChange={(event) => setDateFrom(event.target.value)}
                    title="From date"
                    type="date"
                    value={dateFrom}
                  />
                  <input
                    aria-label="End date"
                    className="h-8 min-w-0 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-xs font-normal text-[var(--text)] outline-none focus:border-[var(--line-strong)]"
                    min={dateFrom || undefined}
                    onChange={(event) => setDateTo(event.target.value)}
                    title="To date"
                    type="date"
                    value={dateTo}
                  />
                </div>
              </th>
              <th className="px-2 pb-3 pt-2">
                <input
                  aria-label="Filter by title"
                  className="h-8 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs font-normal text-[var(--text)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--line-strong)]"
                  onChange={(event) => setTitleQuery(event.target.value)}
                  placeholder="Filter title..."
                  type="search"
                  value={titleQuery}
                />
              </th>
              <th className="px-2 pb-3 pt-2">
                <input
                  className="h-8 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs font-normal text-[var(--text)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--line-strong)]"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter text..."
                  type="search"
                  value={query}
                />
              </th>
              <th className="px-2 pb-3 pt-2">
                <TypeFilterSelect
                  selected={selectedCategoryFilters}
                  setSelected={setSelectedCategoryFilters}
                />
              </th>
              <th className="px-2 pb-3 pt-2">
                <ReviewFilterSelect
                  selected={selectedReviewStatuses}
                  setSelected={setSelectedReviewStatuses}
                />
              </th>
              <th className="px-4 pb-3 pt-2">
                <RecordingTagFilter selectedTags={selectedTags} setSelectedTags={setSelectedTags} />
              </th>
              <th className="px-4 pb-3 pt-2">
                {hasActiveFilters ? (
                  <button
                    className="inline-flex h-8 w-full min-w-[118px] cursor-pointer items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[10px] font-semibold normal-case tracking-normal text-[var(--muted)] transition hover:border-[var(--line-strong)] hover:text-[var(--text)]"
                    onClick={clearAllFilters}
                    type="button"
                  >
                    Reset all
                  </button>
                ) : null}
              </th>
            </tr>
          </thead>
          {selectedBucketItems.length > 0 ? (
            <tbody className="divide-y divide-[var(--line)] border-b-4 border-[var(--line-strong)]">
              <tr>
                <td className="bg-[var(--accent-soft)] px-4 py-3" colSpan={8}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text)]">Selection Bucket</p>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">{selectedBucketItems.length} recordings selected</p>
                      </div>
                      {selectionFeedback ? <span className="text-xs font-semibold text-[var(--accent)]">{selectionFeedback}</span> : null}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {selectionActions}
                      <button
                        className="inline-flex h-7 cursor-pointer items-center rounded border border-[var(--line)] bg-[var(--surface)] px-3 text-[8px] font-medium leading-none text-[var(--muted)] transition hover:text-[var(--text)]"
                        onClick={onClearSelection}
                        type="button"
                      >
                        Clear selection
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
              {selectedBucketItems.map((recording) => (
                <RecordingRow
                  isSelected
                  key={`selected-${recording.id}`}
                  onSelect={onSelect}
                  onToggleSelection={onToggleSelection}
                  recording={recording}
                  selectedId={selectedId}
                />
              ))}
            </tbody>
          ) : null}
          <tbody className="divide-y divide-[var(--line)]">
            <tr>
              <td className="bg-[var(--surface-strong)] px-4 py-2.5" colSpan={8}>
                <div className="flex items-baseline gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Entries</p>
                  {!isInitialLoading ? (
                    <span className="text-[10px] font-medium normal-case tracking-normal text-[var(--muted)]">
                      {recordings.length} shown · {totalRecordings} total
                    </span>
                  ) : null}
                </div>
              </td>
            </tr>
            {isInitialLoading ? <RecordingTableSkeleton /> : null}
            {sortedRecordings.map((recording) => (
              <RecordingRow
                isSelected={selectedBucketIdSet.has(recording.id)}
                key={recording.id}
                onSelect={onSelect}
                onToggleSelection={onToggleSelection}
                recording={recording}
                selectedId={selectedId}
              />
            ))}
          </tbody>
        </table>
      </div>

      {!isInitialLoading && recordings.length === 0 && !loadError ? (
        <p className="px-4 py-12 text-center text-sm text-[var(--muted)]">No recordings match the table filters.</p>
      ) : null}
      {loadError ? <p className="px-4 py-4 text-center text-sm text-red-500">{loadError}</p> : null}
      <div className="border-t border-[var(--line)] px-4 py-3 text-center" ref={loadMoreRef}>
        {isLoadingMore ? (
          <span className="inline-flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
            <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-[var(--line-strong)] border-t-blue-500" />
            Loading more recordings…
          </span>
        ) : null}
        {!hasMore && recordings.length > 0 ? (
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            All {recordings.length} recordings loaded
          </span>
        ) : null}
      </div>
    </div>
  );
}

function RecordingTableSkeleton() {
  return (
    <>
      <tr className="sr-only">
        <td colSpan={8}>Loading recordings…</td>
      </tr>
      {Array.from({ length: 6 }, (_, index) => (
        <tr className="animate-pulse" key={index}>
          <td className="px-4 py-4"><span className="mx-auto block size-4 rounded bg-[var(--line)]" /></td>
          <td className="px-4 py-4"><SkeletonLines widths={["w-24", "w-28"]} /></td>
          <td className="px-4 py-4"><SkeletonLines widths={[index % 2 ? "w-36" : "w-48"]} /></td>
          <td className="px-4 py-4"><SkeletonLines widths={[index % 2 ? "w-64" : "w-80", "w-52"]} /></td>
          <td className="px-4 py-4"><span className="block h-5 w-16 rounded-full bg-[var(--line)]" /></td>
          <td className="px-4 py-4"><span className="block h-5 w-20 rounded-full bg-[var(--line)]" /></td>
          <td className="px-4 py-4"><div className="flex gap-1"><span className="block h-4 w-14 rounded-full bg-[var(--line)]" /><span className="block h-4 w-12 rounded-full bg-[var(--line)]" /></div></td>
          <td className="px-4 py-4"><span className="block h-3 w-12 rounded bg-[var(--line)]" /></td>
        </tr>
      ))}
    </>
  );
}

function SkeletonLines({ widths }: { widths: string[] }) {
  return (
    <div className="space-y-2">
      {widths.map((width, index) => <span className={`block h-3 max-w-full rounded bg-[var(--line)] ${width}`} key={`${width}-${index}`} />)}
    </div>
  );
}

function RecordingRow({
  isSelected,
  onSelect,
  onToggleSelection,
  recording,
  selectedId
}: {
  isSelected: boolean;
  onSelect: (recording: RecordingListItem) => void;
  onToggleSelection: (recording: RecordingListItem) => void;
  recording: RecordingListItem;
  selectedId: string | null;
}) {
  const visibleTags = recording.tags ?? [];

  return (
    <tr
      className={`cursor-pointer transition hover:bg-[var(--accent-soft)] ${
        recording.reviewStatus === "pending_review" ? "recording-card-review-pending" : ""
      } ${recording.id === selectedId ? "bg-[var(--accent-soft)] ring-1 ring-inset ring-blue-500/40" : ""}`}
      onClick={() => onSelect(recording)}
    >
      <td className="w-12 px-4 py-3 text-center align-top">
        <input
          aria-label={`${isSelected ? "Deselect" : "Select"} ${recording.title}`}
          checked={isSelected}
          className="mt-0.5 size-4 cursor-pointer accent-blue-600"
          onChange={() => onToggleSelection(recording)}
          onClick={(event) => event.stopPropagation()}
          type="checkbox"
        />
      </td>
      <td className="whitespace-nowrap px-4 py-3 align-top">
        <p className="text-xs font-semibold text-[var(--text)]">{DATE_FORMATTER.format(new Date(recording.startedAt))}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {formatTime(recording.startedAt)} – {formatTime(recording.endedAt)}
        </p>
      </td>
      <td className="max-w-[300px] px-4 py-3 align-top">
        <p className="truncate text-sm font-semibold text-[var(--text)]">{recording.title}</p>
      </td>
      <td className="max-w-[420px] px-4 py-3 align-top">
        <p className="line-clamp-2 text-xs leading-5 text-[var(--muted)]">{recording.summary || "—"}</p>
      </td>
      <td className="px-4 py-3 align-top">
        <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold capitalize ${getCategoryChipClass(recording.category)}`}>
          {recording.category ?? "unknown"}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 align-top">
        <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${getReviewStatusClass(recording.reviewStatus)}`}>
          {formatReviewStatus(recording.reviewStatus)}
        </span>
      </td>
      <td className="max-w-[260px] px-4 py-3 align-top">
        <div className="flex flex-wrap gap-1">
          {visibleTags.slice(0, 3).map((tag) => (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] ${
                tag.state === "proposal"
                  ? "border-dashed border-amber-500/50 bg-amber-500/10 text-amber-700"
                  : "border-[var(--line)] bg-[var(--surface-strong)] text-[var(--muted)]"
              }`}
              key={tag.id}
              title={tag.state === "proposal" ? `Proposed tag: ${tag.tagName}` : tag.tagName}
            >
              <span>{tag.tagName}</span>
              {tag.state === "proposal" ? <span className="text-[8px] font-semibold uppercase tracking-wide">Proposal</span> : null}
            </span>
          ))}
          {visibleTags.length > 3 ? <span className="text-[10px] text-[var(--muted)]">+{visibleTags.length - 3}</span> : null}
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-[var(--muted)]">
        {formatDuration(recording.startedAt, recording.endedAt)}
      </td>
    </tr>
  );
}

function formatReviewStatus(status: ReviewStatus) {
  if (status === "pending_review") {
    return "Pending";
  }
  return status === "approved" ? "Approved" : "Rejected";
}

function getReviewStatusClass(status: ReviewStatus) {
  if (status === "approved") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600";
  }
  if (status === "rejected") {
    return "border-red-500/30 bg-red-500/10 text-red-600";
  }
  return "border-amber-500/30 bg-amber-500/10 text-amber-600";
}

function getCategoryChipClass(category: RecordingListItem["category"]) {
  if (category === "work") {
    return "border-blue-500/30 bg-blue-500/10 text-blue-600";
  }
  if (category === "private") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600";
  }
  return "border-zinc-300 bg-white text-zinc-600";
}

function ReviewFilterSelect({
  selected,
  setSelected
}: {
  selected: ReviewStatus[];
  setSelected: Dispatch<SetStateAction<ReviewStatus[]>>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const label =
    selected.length === 0
      ? "All reviews"
      : selected.length === 1
        ? formatReviewStatus(selected[0]!)
        : `${selected.length} statuses`;

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  return (
    <div className="relative min-w-[132px] normal-case tracking-normal" ref={containerRef}>
      <button
        aria-expanded={isOpen}
        className="flex h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs font-normal text-[var(--text)] outline-none transition hover:border-[var(--line-strong)]"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {selected.slice(0, 3).map((status) => (
            <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${getReviewStatusDotClass(status)}`} key={status} />
          ))}
          <span className="truncate">{label}</span>
        </span>
        <span aria-hidden="true" className={`flex h-4 w-4 shrink-0 items-center justify-center text-[var(--muted)] transition-transform ${isOpen ? "rotate-180" : ""}`}>
          <DropdownChevronIcon />
        </span>
      </button>
      {isOpen ? (
        <div className="absolute left-0 top-[calc(100%+0.25rem)] z-50 min-w-[170px] overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] p-1 shadow-lg">
          {([
            ["approved", "Approved"],
            ["pending_review", "Pending"],
            ["rejected", "Rejected"]
          ] as const).map(([status, statusLabel]) => {
            const isSelected = selected.includes(status);
            return (
              <button
                aria-pressed={isSelected}
                className={`flex w-full cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-left text-[10px] font-semibold transition ${
                  isSelected
                    ? getReviewStatusClass(status)
                    : "border-transparent text-[var(--muted)] hover:bg-[var(--surface-strong)] hover:text-[var(--text)]"
                }`}
                key={status}
                onClick={() =>
                  setSelected((current) =>
                    current.includes(status)
                      ? current.filter((item) => item !== status)
                      : [...current, status]
                  )
                }
                type="button"
              >
                <span aria-hidden="true" className={`h-2 w-2 rounded-full ${getReviewStatusDotClass(status)}`} />
                <span>{statusLabel}</span>
                <span className="ml-auto text-xs">{isSelected ? "✓" : ""}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function getReviewStatusDotClass(status: ReviewStatus) {
  if (status === "approved") {
    return "bg-emerald-500";
  }
  if (status === "rejected") {
    return "bg-red-500";
  }
  return "bg-amber-500";
}

function TypeFilterSelect({
  selected,
  setSelected
}: {
  selected: CategoryFilterOption[];
  setSelected: Dispatch<SetStateAction<CategoryFilterOption[]>>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const label =
    selected.length === 0
      ? "All types"
      : selected.length === 1
        ? selected[0] === "work"
          ? "Work"
          : selected[0] === "private"
            ? "Private"
            : "Unknown"
        : `${selected.length} types`;

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  return (
    <div className="relative min-w-[118px] normal-case tracking-normal" ref={containerRef}>
      <button
        aria-expanded={isOpen}
        className="flex h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs font-normal text-[var(--text)] outline-none transition hover:border-[var(--line-strong)]"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {selected.slice(0, 3).map((category) => (
            <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${getCategoryDotClass(category)}`} key={category} />
          ))}
          <span className="truncate">{label}</span>
        </span>
        <span aria-hidden="true" className={`flex h-4 w-4 shrink-0 items-center justify-center text-[var(--muted)] transition-transform ${isOpen ? "rotate-180" : ""}`}>
          <DropdownChevronIcon />
        </span>
      </button>
      {isOpen ? <div className="absolute left-0 top-[calc(100%+0.25rem)] z-50 min-w-[160px] overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] p-1 shadow-lg">
        {([
          ["work", "Work"],
          ["private", "Private"],
          ["unknown", "Unknown"]
        ] as const).map(([category, categoryLabel]) => {
          const isSelected = selected.includes(category);
          return (
            <button
              aria-pressed={isSelected}
              className={`flex w-full cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-left text-[10px] font-semibold transition ${
                isSelected
                  ? getCategoryFilterClass(category)
                  : "border-transparent text-[var(--muted)] hover:bg-[var(--surface-strong)] hover:text-[var(--text)]"
              }`}
              key={category}
              onClick={() =>
                setSelected((current) =>
                  current.includes(category)
                    ? current.filter((item) => item !== category)
                    : [...current, category]
                )
              }
              type="button"
            >
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${getCategoryDotClass(category)}`} />
              <span>{categoryLabel}</span>
              <span className="ml-auto text-xs">{isSelected ? "✓" : ""}</span>
            </button>
          );
        })}
      </div> : null}
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

function DropdownChevronIcon() {
  return (
    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 10 6">
      <path d="m1 1 4 4 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function isDateInputValue(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isReviewStatus(value: unknown): value is ReviewStatus {
  return value === "approved" || value === "pending_review" || value === "rejected";
}

function isCategoryFilterOption(value: unknown): value is CategoryFilterOption {
  return value === "work" || value === "private" || value === "unknown";
}

function isSelectedTagFilter(value: unknown): value is RecordingListTagFilter {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<RecordingListTagFilter>;
  return typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.pathLabel === "string" &&
    typeof candidate.includeDescendants === "boolean" &&
    Array.isArray(candidate.descendantIds) &&
    candidate.descendantIds.every((id) => typeof id === "string");
}

function SortableHeader({
  className,
  column,
  direction,
  label,
  onSort,
  selected
}: {
  className?: string;
  column: SortColumn;
  direction: SortDirection;
  label: string;
  onSort: (column: SortColumn) => void;
  selected: SortColumn;
}) {
  const isSelected = selected === column;
  return (
    <th className={`${className ?? "px-4"} pb-2 pt-3`}>
      <button className="cursor-pointer transition hover:text-[var(--text)]" onClick={() => onSort(column)} type="button">
        {label} <span aria-hidden="true">{isSelected ? (direction === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );
}
