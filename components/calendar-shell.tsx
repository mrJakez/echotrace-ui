"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { RecordingDetailPanel } from "@/components/recording-detail-panel";
import { WeekCalendar } from "@/components/week-calendar";
import { addDays, addWeeks, formatDayLabel, formatDuration, formatTime, fromDateKey, startOfWeek, toDateKey } from "@/lib/time";
import type { RecordingDetail, RecordingListItem, ReviewStatus } from "@/lib/types";

type CalendarShellProps = {
  activeProfileEmail: string;
  initialCategoryFilter: "all" | "work" | "private" | "unknown";
  initialReviewFilter: "all" | ReviewStatus;
  initialWeekStart: string;
  recordings: RecordingListItem[];
};

export function CalendarShell({
  activeProfileEmail,
  initialCategoryFilter,
  initialReviewFilter,
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<"all" | "work" | "private" | "unknown">(initialCategoryFilter);
  const [reviewFilter, setReviewFilter] = useState<"all" | ReviewStatus>(initialReviewFilter);

  const weekStart = useMemo(() => new Date(initialWeekStart), [initialWeekStart]);
  const selectedId = searchParams.get("recordingId");
  const requestedDay = searchParams.get("day");

  useEffect(() => {
    setRecordingItems(recordings);
  }, [recordings]);

  useEffect(() => {
    setCategoryFilter(initialCategoryFilter);
  }, [initialCategoryFilter]);

  useEffect(() => {
    setReviewFilter(initialReviewFilter);
  }, [initialReviewFilter]);

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
    }

    if (!filtersOpen) {
      return;
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [filtersOpen]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    startDetailTransition(async () => {
      const response = await fetch(`/api/recordings/${selectedId}`, { cache: "no-store" });
      if (!response.ok) {
        setDetail(null);
        return;
      }

      const payload = (await response.json()) as RecordingDetail;
      setDetail(payload);
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
  }) {
    startNavTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      const resolvedCategoryFilter = next.categoryFilter ?? categoryFilter;
      const resolvedReviewFilter = next.reviewFilter ?? reviewFilter;

      params.set("categoryFilter", resolvedCategoryFilter);
      params.set("reviewFilter", resolvedReviewFilter);
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

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
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
        .map((item) => (item.id === updated.id ? { ...item, reviewStatus: updated.reviewStatus } : item))
        .filter((item) => {
          if (reviewFilter !== "all") {
            return item.reviewStatus === reviewFilter;
          }

          return item.reviewStatus !== "rejected";
        })
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
  const visibleDays = useMemo(() => {
    const start = startOfWeek(weekStart);
    const end = visibleWeekEnd;
    const days: Date[] = [];
    const cursor = new Date(start);

    while (cursor <= end) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return days;
  }, [visibleWeekEnd, weekStart]);
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
  const hasActiveFilters = categoryFilter !== "all" || reviewFilter !== "all";

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

  return (
    <main className="min-h-screen px-3 py-3 md:px-8 md:py-8">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 md:gap-4">
        <section className="glass-panel overflow-hidden rounded-[28px] border border-white/70 shadow-[var(--shadow)] md:rounded-[36px]">
          <div className="grid gap-4 px-4 py-4 md:grid-cols-[1.2fr_0.8fr] md:items-start md:px-8 md:py-4">
            <div className="space-y-3">
              <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-white/80 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                    EchoTrace
                  </span>
                  <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                    Week View
                  </span>
                </div>
                <div className="flex w-full items-center gap-2 rounded-[20px] border border-white/80 bg-white/76 px-2 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.05)] md:w-auto md:rounded-full">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_100%)] text-sm font-semibold text-white">
                    {getProfileInitials(activeProfileEmail)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text)]">{activeProfileEmail}</p>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Active profile</p>
                  </div>
                  <button
                    className="cursor-pointer rounded-full border border-[rgba(226,232,240,0.95)] bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text)] transition hover:border-[rgba(148,163,184,0.55)]"
                    onClick={logout}
                    type="button"
                  >
                    Logout
                  </button>
                </div>
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
                <div className="mt-3 grid grid-cols-3 gap-2 md:gap-3">
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

        <section className="grid gap-4">
          <div className="glass-panel overflow-hidden rounded-[28px] border border-white/70 shadow-[var(--shadow)] md:rounded-[36px]">
            <div className="flex flex-col gap-4 border-b border-[rgba(226,232,240,0.9)] px-4 py-4 md:flex-row md:flex-wrap md:items-center md:justify-between md:px-8">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Calendar</p>
                <div className="flex items-center gap-2 md:gap-3">
                  <RangeButton direction="left" onClick={() => navigateCalendar(-1)} />
                  <p className="min-w-0 flex-1 text-[18px] font-semibold tracking-[-0.04em] text-[var(--text)] md:min-w-[260px] md:flex-none md:text-[24px]">
                    {calendarHeaderLabel}
                  </p>
                  <RangeButton direction="right" onClick={() => navigateCalendar(1)} />
                </div>
              </div>
              <div className="flex w-full items-center justify-end gap-2 md:ml-auto md:w-auto md:flex-wrap">
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
                              updateUrlState({ reviewFilter: value });
                            }}
                            value={reviewFilter}
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <WeekCalendar
              mobileDayKey={isMobile ? currentMobileDay : null}
              recordings={recordingItems}
              selectedId={selectedId}
              onSelect={setSelectedRecording}
              weekStart={initialWeekStart}
              todayKey={toDateKey(new Date())}
            />
          </div>
        </section>
      </div>
      {selectedId ? (
        <RecordingDetailPanel
          detail={detail}
          isLoading={detailLoading}
          onReviewStatusUpdated={(updated) => {
            setDetail(updated);
            setRecordingItems((current) =>
              current
                .map((item) =>
                  item.id === updated.id
                    ? {
                        ...item,
                        title: updated.title,
                        customTitle: updated.customTitle,
                        reviewStatus: updated.reviewStatus
                      }
                    : item
                )
                .filter((item) => {
                  if (reviewFilter !== "all") {
                    return item.reviewStatus === reviewFilter;
                  }

                  return item.reviewStatus !== "rejected";
                })
            );
          }}
          onTitleUpdated={(updated) => {
            setDetail(updated);
            setRecordingItems((current) =>
              current.map((item) =>
                item.id === updated.id
                  ? {
                      ...item,
                      title: updated.title,
                      customTitle: updated.customTitle
                    }
                  : item
              )
            );
          }}
          onClose={() => {
            setDetail(null);
            setSelectedRecording(null);
          }}
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
    <div className="rounded-[16px] border border-white/80 bg-white/78 p-2.5 md:rounded-[18px] md:p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-base font-semibold tracking-[-0.04em] md:text-[22px]">{value}</p>
    </div>
  );
}

function formatWeekRange(start: Date, end: Date) {
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = start.getMonth() === end.getMonth() && sameYear;
  const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long" });

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
    day: "numeric"
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

function formatMinutesCompact(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }

  return `${minutes}m`;
}

function getProfileInitials(email: string) {
  const localPart = email.split("@")[0] ?? "";
  const parts = localPart.split(/[.\-_]/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }

  return localPart.slice(0, 2).toUpperCase() || "ET";
}
