"use client";

import { useMemo, useState } from "react";

import { formatDuration, formatTime } from "@/lib/time";
import type { RecordingListItem, ReviewStatus } from "@/lib/types";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "short",
  weekday: "short",
  year: "numeric",
  timeZone: "Europe/Berlin"
});

type SortColumn = "category" | "date" | "duration" | "title";
type SortDirection = "asc" | "desc";

type RecordingListViewProps = {
  isSelectionMode: boolean;
  onSelect: (id: string) => void;
  recordings: RecordingListItem[];
  selectedBucketIds: string[];
  selectedId: string | null;
};

function getDurationMs(recording: RecordingListItem) {
  return Math.max(new Date(recording.endedAt).getTime() - new Date(recording.startedAt).getTime(), 0);
}

export function RecordingListView({
  isSelectionMode,
  onSelect,
  recordings,
  selectedBucketIds,
  selectedId
}: RecordingListViewProps) {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [reviewFilter, setReviewFilter] = useState<"all" | ReviewStatus>("all");
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const selectedBucketIdSet = useMemo(() => new Set(selectedBucketIds), [selectedBucketIds]);

  const categories = useMemo(
    () => [...new Set(recordings.map((recording) => recording.category ?? "unknown"))].sort(),
    [recordings]
  );

  const filteredRecordings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = recordings.filter((recording) => {
      if (categoryFilter !== "all" && (recording.category ?? "unknown") !== categoryFilter) {
        return false;
      }
      if (reviewFilter !== "all" && recording.reviewStatus !== reviewFilter) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }

      return [
        recording.title,
        recording.summary ?? "",
        recording.source ?? "",
        recording.filename,
        ...(recording.tags ?? []).map((tag) => tag.tagName)
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });

    return filtered.sort((left, right) => {
      let comparison = 0;
      if (sortColumn === "title") {
        comparison = left.title.localeCompare(right.title);
      } else if (sortColumn === "category") {
        comparison = (left.category ?? "unknown").localeCompare(right.category ?? "unknown");
      } else if (sortColumn === "duration") {
        comparison = getDurationMs(left) - getDurationMs(right);
      } else {
        comparison = left.startedAt.localeCompare(right.startedAt);
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [categoryFilter, query, recordings, reviewFilter, sortColumn, sortDirection]);

  function changeSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortColumn(column);
    setSortDirection("asc");
  }

  return (
    <div className="bg-zinc-950">
      <div className="grid gap-2 border-b border-zinc-800 p-3 sm:grid-cols-[minmax(0,1fr)_160px_170px] md:p-4">
        <label className="min-w-0">
          <span className="sr-only">Filter list</span>
          <input
            className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-zinc-600"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter this table..."
            type="search"
            value={query}
          />
        </label>
        <label>
          <span className="sr-only">Filter by type</span>
          <select
            className="h-10 w-full cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-300 outline-none"
            onChange={(event) => setCategoryFilter(event.target.value)}
            value={categoryFilter}
          >
            <option value="all">All types</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category === "unknown" ? "Unknown" : category.charAt(0).toUpperCase() + category.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by review status</span>
          <select
            className="h-10 w-full cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-300 outline-none"
            onChange={(event) => setReviewFilter(event.target.value as "all" | ReviewStatus)}
            value={reviewFilter}
          >
            <option value="all">All review states</option>
            <option value="pending_review">Pending only</option>
            <option value="approved">Approved only</option>
            <option value="rejected">Rejected only</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-left">
          <thead className="border-b border-zinc-800 bg-zinc-900/90 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            <tr>
              <SortableHeader column="date" direction={sortDirection} label="Date & time" onSort={changeSort} selected={sortColumn} />
              <SortableHeader column="title" direction={sortDirection} label="Recording" onSort={changeSort} selected={sortColumn} />
              <SortableHeader column="category" direction={sortDirection} label="Type" onSort={changeSort} selected={sortColumn} />
              <th className="px-4 py-3">Tags</th>
              <SortableHeader column="duration" direction={sortDirection} label="Duration" onSort={changeSort} selected={sortColumn} />
              {isSelectionMode ? <th className="px-4 py-3 text-right">Selection</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {filteredRecordings.map((recording) => {
              const isAdded = selectedBucketIdSet.has(recording.id);
              const assignedTags = (recording.tags ?? []).filter((tag) => tag.state !== "proposal");
              return (
                <tr
                  className={`cursor-pointer transition hover:bg-zinc-900/80 ${
                    recording.reviewStatus === "pending_review" ? "recording-card-review-pending" : ""
                  } ${recording.id === selectedId ? "bg-blue-500/10 ring-1 ring-inset ring-blue-500/40" : ""}`}
                  key={recording.id}
                  onClick={() => onSelect(recording.id)}
                >
                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    <p className="text-xs font-semibold text-zinc-300">{DATE_FORMATTER.format(new Date(recording.startedAt))}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {formatTime(recording.startedAt)} – {formatTime(recording.endedAt)}
                    </p>
                  </td>
                  <td className="max-w-[420px] px-4 py-3 align-top">
                    <p className="truncate text-sm font-semibold text-zinc-100">{recording.title}</p>
                    {recording.summary ? <p className="mt-1 line-clamp-1 text-xs text-zinc-500">{recording.summary}</p> : null}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] font-semibold capitalize text-zinc-400">
                      {recording.category ?? "unknown"}
                    </span>
                  </td>
                  <td className="max-w-[260px] px-4 py-3 align-top">
                    <div className="flex flex-wrap gap-1">
                      {assignedTags.slice(0, 3).map((tag) => (
                        <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[9px] text-zinc-400" key={tag.id}>
                          {tag.tagName}
                        </span>
                      ))}
                      {assignedTags.length > 3 ? <span className="text-[10px] text-zinc-500">+{assignedTags.length - 3}</span> : null}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-zinc-400">
                    {formatDuration(recording.startedAt, recording.endedAt)}
                  </td>
                  {isSelectionMode ? (
                    <td className="px-4 py-3 text-right align-top">
                      <span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${isAdded ? "bg-blue-600 text-white" : "border border-zinc-700 bg-zinc-800 text-blue-400"}`}>
                        {isAdded ? "Added" : "Add"}
                      </span>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredRecordings.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-zinc-500">No recordings match the table filters.</p>
      ) : (
        <p className="border-t border-zinc-800 px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
          {filteredRecordings.length} of {recordings.length} recordings
        </p>
      )}
    </div>
  );
}

function SortableHeader({
  column,
  direction,
  label,
  onSort,
  selected
}: {
  column: SortColumn;
  direction: SortDirection;
  label: string;
  onSort: (column: SortColumn) => void;
  selected: SortColumn;
}) {
  const isSelected = selected === column;
  return (
    <th className="px-4 py-3">
      <button className="cursor-pointer transition hover:text-zinc-200" onClick={() => onSort(column)} type="button">
        {label} <span aria-hidden="true">{isSelected ? (direction === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );
}
