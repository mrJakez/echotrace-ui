import type { CSSProperties } from "react";

import { addDays, formatDuration, formatTime, startOfWeek, toDateKey } from "@/lib/time";
import type { RecordingListItem } from "@/lib/types";

const WEEKDAY_HEADER_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "Europe/Berlin"
});

const DAY_HEADER_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "Europe/Berlin"
});

type WeekCalendarProps = {
  isSelectionMode: boolean;
  mobileDayKey: string | null;
  recordings: RecordingListItem[];
  selectedBucketIds: string[];
  selectedId: string | null;
  todayKey: string;
  onSelectDay: (items: RecordingListItem[]) => void;
  onSelect: (id: string) => void;
  weekStart: string;
};

function getCategoryStyles(category: string | null, isSelected: boolean) {
  if (isSelected) {
    return {
      card: "border-blue-500 bg-zinc-800 text-zinc-100 ring-1 ring-blue-500/30"
    };
  }

  switch ((category ?? "unknown").toLowerCase()) {
    case "work":
      return {
        card: "border-blue-500/40 bg-blue-500/[0.06] hover:border-blue-400 hover:bg-blue-500/[0.1]"
      };
    case "private":
      return {
        card: "recording-card-private"
      };
    default:
      return {
        card: "border-zinc-800 bg-zinc-900 hover:border-zinc-600 hover:bg-zinc-800/80"
      };
  }
}

export function WeekCalendar({
  isSelectionMode,
  mobileDayKey,
  recordings,
  selectedBucketIds,
  selectedId,
  todayKey,
  onSelectDay,
  onSelect,
  weekStart
}: WeekCalendarProps) {
  const anchor = startOfWeek(new Date(weekStart));
  const allDays = Array.from({ length: 7 }, (_, index) => addDays(anchor, index));

  const byDay = new Map<string, RecordingListItem[]>();
  for (const recording of recordings) {
    const key = toDateKey(new Date(recording.startedAt));
    const list = byDay.get(key) ?? [];
    list.push(recording);
    byDay.set(key, list);
  }

  const saturday = allDays[5];
  const sunday = allDays[6];
  const hasWeekendRecordings =
    (byDay.get(toDateKey(saturday)) ?? []).length > 0 || (byDay.get(toDateKey(sunday)) ?? []).length > 0;
  const days = mobileDayKey ? allDays : hasWeekendRecordings ? allDays : allDays.slice(0, 5);
  const bucketIdSet = new Set(selectedBucketIds);

  const dayItemCounts = days.map((day) => (byDay.get(toDateKey(day)) ?? []).length);
  const populatedDayCount = dayItemCounts.filter((count) => count > 0).length;
  const emptyDayCount = days.length - populatedDayCount;
  const useCompressedEmptyDays = populatedDayCount >= 4 && emptyDayCount >= 3;
  const desktopColumns = dayItemCounts
    .map((count) => (useCompressedEmptyDays ? (count > 0 ? "1.2fr" : "0.72fr") : "1fr"))
    .join(" ");

  return (
    <div
      className="grid grid-cols-1 gap-px bg-[var(--line)] md:[grid-template-columns:var(--week-columns)]"
      style={{ "--week-columns": desktopColumns } as CSSProperties}
    >
      {days.map((day) => {
        const key = toDateKey(day);
        const isToday = key === todayKey;
        const items = (byDay.get(key) ?? []).sort((left, right) => left.startedAt.localeCompare(right.startedAt));

        return (
          <section
            key={key}
            className={`${mobileDayKey && key !== mobileDayKey ? "hidden md:block" : "block"} min-h-[220px] border-l border-zinc-800 bg-zinc-950 p-3 first:border-l-0 md:min-h-[680px]`}
          >
            <div
              className={`mb-4 rounded-lg border px-3 py-3 ${
                isToday
                  ? "border-blue-500/50 bg-blue-500/10"
                  : "border-zinc-800 bg-zinc-900"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${isToday ? "text-[rgba(29,78,216,0.9)]" : "text-[var(--muted)]"}`}>
                    {WEEKDAY_HEADER_FORMATTER.format(day).toUpperCase()}
                  </p>
                  <p className={`mt-1 text-sm font-medium ${isToday ? "text-zinc-100" : "text-[var(--muted)]"}`}>
                    {DAY_HEADER_FORMATTER.format(day)}
                  </p>
                </div>
                {isSelectionMode && items.length > 0 ? (
                  <button
                    aria-label={`Add all recordings from ${DAY_HEADER_FORMATTER.format(day)}`}
                    className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 text-xl font-medium leading-none text-blue-400 transition hover:border-blue-500 hover:bg-zinc-700 hover:text-blue-300"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectDay(items);
                    }}
                    title="Add all recordings of this day"
                    type="button"
                  >
                    +
                  </button>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-600">
                  No recording
                </div>
              ) : (
                items.map((recording) => {
                  const isSelected = recording.id === selectedId;
                  const isBucketSelected = bucketIdSet.has(recording.id);
                  const needsReview = recording.reviewStatus === "pending_review";
                  const styles = getCategoryStyles(recording.category, isSelected);
                  const assignedTags = (recording.tags ?? []).filter((tag) => tag.state !== "proposal");
                  const proposalTagCount = (recording.tags ?? []).filter((tag) => tag.state === "proposal").length;
                  const visibleTags = assignedTags.slice(0, 3);
                  const hiddenTagCount = assignedTags.length - visibleTags.length;

                  return (
                    <button
                      key={recording.id}
                      className={`relative w-full cursor-pointer rounded-xl border px-3 py-3 text-left transition duration-200 md:px-4 ${
                        isSelectionMode ? "pr-12 md:pr-12" : ""
                      } ${
                        isSelectionMode && isBucketSelected
                          ? "border-blue-500 bg-zinc-800 ring-1 ring-blue-500/30"
                          : needsReview
                            ? "recording-card-review-pending"
                          : styles.card
                      }`}
                      onClick={() => onSelect(recording.id)}
                      type="button"
                    >
                      {isSelectionMode ? (
                        <span
                          className={`absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg text-xl font-medium leading-none ${
                            isBucketSelected
                              ? "bg-blue-500 text-white"
                              : "border border-zinc-700 bg-zinc-800 text-blue-400 transition hover:border-blue-500 hover:bg-zinc-700 hover:text-blue-300"
                          }`}
                        >
                          {isBucketSelected ? "✓" : "+"}
                        </span>
                      ) : null}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p
                            className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${
                              isSelected ? "text-[rgba(51,65,85,0.72)]" : "text-[var(--accent)]"
                            }`}
                          >
                            {formatTime(recording.startedAt)} - {formatTime(recording.endedAt)}
                          </p>
                          {proposalTagCount > 0 ? (
                            <span
                              className="mt-2 inline-flex items-center gap-1 rounded-full border border-[rgba(245,158,11,0.32)] bg-[rgba(255,251,235,0.96)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[rgba(180,83,9,0.96)]"
                              title={`${proposalTagCount} tag proposal${proposalTagCount === 1 ? "" : "s"} to review`}
                            >
                              <ReviewIcon />
                              Review tags
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[11px] text-[var(--muted)]">
                          {formatDuration(recording.startedAt, recording.endedAt)}
                        </p>
                      </div>
                      <p className="mt-3 line-clamp-3 text-[14px] font-semibold leading-6 text-[var(--text)] md:text-[15px]">
                        {recording.title}
                      </p>
                      {visibleTags.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {visibleTags.map((tag) => (
                            <span
                              key={tag.id}
                              className={`max-w-full truncate rounded-full border px-2 py-0.5 text-[9px] font-semibold ${getTagStyles(
                                tag.source,
                                tag.state
                              )}`}
                              title={tag.tagName}
                            >
                              {tag.tagName}
                            </span>
                          ))}
                          {hiddenTagCount > 0 ? (
                            <span className="rounded-full border border-[rgba(148,163,184,0.22)] bg-white/72 px-2 py-0.5 text-[9px] font-semibold text-[var(--muted)]">
                              +{hiddenTagCount}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ReviewIcon() {
  return (
    <svg aria-hidden="true" className="h-3 w-3" fill="none" viewBox="0 0 16 16">
      <path d="M8 3v5.2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      <path d="M8 11.6h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
      <path d="M8 1.75 14.25 13H1.75L8 1.75Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.35" />
    </svg>
  );
}

function getTagStyles(source: string, state: string) {
  if (source === "automatic" || state === "very_likely") {
    return "border-[rgba(34,197,94,0.22)] bg-[rgba(240,253,244,0.9)] text-[rgba(21,128,61,0.95)]";
  }

  return "border-[rgba(59,130,246,0.22)] bg-[rgba(239,246,255,0.9)] text-[rgba(30,64,175,0.96)]";
}
