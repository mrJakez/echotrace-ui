import type { CSSProperties } from "react";

import { addDays, formatDayLabel, formatDuration, formatTime, startOfWeek, toDateKey } from "@/lib/time";
import type { RecordingListItem } from "@/lib/types";

type WeekCalendarProps = {
  recordings: RecordingListItem[];
  selectedId: string | null;
  todayKey: string;
  onSelect: (id: string) => void;
  weekStart: string;
};

function getCategoryStyles(category: string | null, isSelected: boolean) {
  if (isSelected) {
    return {
      card: "border-[rgba(37,99,235,0.55)] bg-[linear-gradient(180deg,rgba(247,251,255,0.98)_0%,rgba(233,243,255,0.98)_100%)] text-[#0f172a] shadow-[0_18px_38px_rgba(15,23,42,0.08)] ring-1 ring-[rgba(37,99,235,0.18)]",
      badge: "bg-[rgba(37,99,235,0.12)] text-[rgba(30,64,175,0.92)]",
      metaDot: "bg-[rgba(37,99,235,0.92)]"
    };
  }

  switch ((category ?? "unknown").toLowerCase()) {
    case "work":
      return {
        card: "border-[rgba(96,165,250,0.22)] bg-[linear-gradient(180deg,rgba(247,251,255,0.98)_0%,rgba(236,245,255,0.98)_100%)] shadow-[0_10px_26px_rgba(15,23,42,0.04)] hover:-translate-y-0.5 hover:border-[rgba(59,130,246,0.3)] hover:shadow-[0_18px_32px_rgba(15,23,42,0.06)]",
        badge: "bg-[rgba(59,130,246,0.12)] text-[rgba(30,64,175,0.92)]",
        metaDot: "bg-[rgba(59,130,246,0.9)]"
      };
    case "private":
      return {
        card: "border-[rgba(74,222,128,0.2)] bg-[linear-gradient(180deg,rgba(247,255,250,0.98)_0%,rgba(235,252,241,0.98)_100%)] shadow-[0_10px_26px_rgba(15,23,42,0.04)] hover:-translate-y-0.5 hover:border-[rgba(34,197,94,0.3)] hover:shadow-[0_18px_32px_rgba(15,23,42,0.06)]",
        badge: "bg-[rgba(34,197,94,0.12)] text-[rgba(22,101,52,0.92)]",
        metaDot: "bg-[rgba(34,197,94,0.88)]"
      };
    default:
      return {
        card: "border-[rgba(226,232,240,0.95)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.98)_100%)] shadow-[0_10px_26px_rgba(15,23,42,0.04)] hover:-translate-y-0.5 hover:border-[rgba(148,163,184,0.45)] hover:shadow-[0_18px_32px_rgba(15,23,42,0.06)]",
        badge: "bg-[rgba(148,163,184,0.14)] text-[rgba(71,85,105,0.95)]",
        metaDot: "bg-[rgba(148,163,184,0.88)]"
      };
  }
}

export function WeekCalendar({
  recordings,
  selectedId,
  todayKey,
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
  const days = hasWeekendRecordings ? allDays : allDays.slice(0, 5);

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
            className={`min-h-[220px] border-l p-3 first:border-l-0 md:min-h-[680px] ${
              isToday
                ? "border-[rgba(96,165,250,0.45)] bg-[linear-gradient(180deg,rgba(245,249,255,0.88)_0%,rgba(255,255,255,0.82)_100%)]"
                : "border-[rgba(226,232,240,0.85)] bg-[rgba(255,255,255,0.74)]"
            }`}
          >
            <div
              className={`mb-4 rounded-[18px] border px-4 py-3 ${
                isToday
                  ? "border-[rgba(96,165,250,0.42)] bg-[rgba(239,246,255,0.96)] shadow-[inset_0_0_0_1px_rgba(191,219,254,0.75)]"
                  : "border-[rgba(226,232,240,0.9)] bg-white/84"
              }`}
            >
              <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${isToday ? "text-[rgba(29,78,216,0.9)]" : "text-[var(--muted)]"}`}>
                {day.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}
              </p>
              <p className={`mt-1 text-sm font-medium ${isToday ? "text-[rgba(15,23,42,0.92)]" : "text-[var(--muted)]"}`}>
                {day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {items.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-[rgba(203,213,225,0.95)] bg-white/64 p-4 text-sm text-[var(--muted)]">
                  No recording
                </div>
              ) : (
                items.map((recording) => {
                  const isSelected = recording.id === selectedId;
                  const styles = getCategoryStyles(recording.category, isSelected);

                  return (
                    <button
                      key={recording.id}
                      className={`w-full cursor-pointer rounded-[14px] border px-3 py-3 text-left transition duration-200 md:px-4 ${styles.card}`}
                      onClick={() => onSelect(recording.id)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p
                          className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${
                            isSelected ? "text-[rgba(51,65,85,0.72)]" : "text-[var(--accent)]"
                          }`}
                        >
                          {formatTime(recording.startedAt)}
                        </p>
                        <p className="text-[11px] text-[var(--muted)]">
                          {formatDuration(recording.startedAt, recording.endedAt)}
                        </p>
                      </div>
                      <p className="mt-3 line-clamp-3 text-[14px] font-semibold leading-6 text-[var(--text)] md:text-[15px]">
                        {recording.title}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs text-[var(--muted)]">
                        <span className={`h-2 w-2 rounded-full ${styles.metaDot}`} />
                        <span>{recording.source ?? "unknown"}</span>
                        <span>·</span>
                        <span>
                          {formatTime(recording.startedAt)} - {formatTime(recording.endedAt)}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${styles.badge}`}
                        >
                          {recording.category ?? "unknown"}
                        </span>
                        {(recording.transcriptionStatus ?? "").trim().toLowerCase() === "open" ? (
                          <span className="rounded-[8px] border border-[rgba(37,99,235,0.15)] bg-[rgba(37,99,235,0.08)] px-2 py-1 text-[10px] font-medium text-[rgba(30,64,175,0.92)]">
                            Transcript open
                          </span>
                        ) : null}
                      </div>
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
