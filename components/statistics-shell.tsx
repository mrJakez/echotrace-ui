import Link from "next/link";

import { AppNavigation } from "@/components/app-navigation";
import type { StatisticsBreakdownItem, StatisticsData } from "@/lib/types";

type StatisticsShellProps = {
  activeProfileEmail: string;
  buildSha: string;
  buildTime: string;
  statistics: StatisticsData;
};

const MONTH_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  month: "short",
  timeZone: "Europe/Berlin"
});

const DATE_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Berlin"
});

export function StatisticsShell({
  activeProfileEmail,
  buildSha,
  buildTime,
  statistics
}: StatisticsShellProps) {
  const maxMonthlyCount = Math.max(...statistics.monthlyActivity.map((month) => month.count), 1);
  const averageFileSize =
    statistics.storage.fileCount > 0 ? statistics.storage.totalBytes / statistics.storage.fileCount : 0;

  return (
    <main className="min-h-screen px-3 pb-4 pt-[3.75rem] md:py-8 md:pl-[6.5rem] md:pr-8">
      <AppNavigation activeProfileEmail={activeProfileEmail} buildSha={buildSha} buildTime={buildTime} />
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 md:gap-6">
        <section className="statistics-hero overflow-hidden rounded-[28px] border px-4 py-5 md:rounded-[36px] md:px-8 md:py-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-400">EchoTrace Analytics</p>
              <h1 className="statistics-hero-title mt-2 text-[28px] font-semibold tracking-[-0.05em] md:text-[42px]">
                Statistiken
              </h1>
              <p className="statistics-hero-copy mt-2 max-w-2xl text-[13px] leading-6 md:text-sm">
                Bestand, Review-Fortschritt, Aufnahmevolumen und tatsächlich belegter Audiospeicher auf einen Blick.
              </p>
            </div>
            <div className="statistics-live-snapshot inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-semibold">
              <span aria-hidden="true" className="statistics-live-dot h-1.5 w-1.5 rounded-full" />
              <span>Live snapshot</span>
              <span aria-hidden="true" className="statistics-live-separator">·</span>
              <span className="font-[family-name:var(--font-mono)] font-medium">
                {new Date().toLocaleDateString("de-DE")}
              </span>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            detail={`${statistics.reviewBreakdown.find((item) => item.key === "approved")?.count ?? 0} approved`}
            label="Recordings"
            value={formatNumber(statistics.totalRecordings)}
          />
          <MetricCard
            detail={`${Math.round(ratio(
              statistics.reviewBreakdown.find((item) => item.key === "rejected")?.count ?? 0,
              statistics.totalRecordings
            ) * 100)}% of all recordings`}
            label="Rejected"
            tone="muted"
            value={formatNumber(statistics.reviewBreakdown.find((item) => item.key === "rejected")?.count ?? 0)}
          />
          <MetricCard
            detail="Audio linked to approved recordings"
            label="Approved storage"
            tone="green"
            value={formatBytes(statistics.storage.approvedBytes)}
          />
          <MetricCard
            detail="Audio linked to rejected recordings"
            label="Rejected storage"
            tone="muted"
            value={formatBytes(statistics.storage.rejectedBytes)}
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="glass-panel rounded-[28px] border border-white/70 p-4 shadow-[var(--shadow)] md:p-6">
            <SectionHeader label="Activity" meta="Last 12 months" title="Recording volume" />
            <div className="mt-7 grid h-[240px] grid-cols-12 items-end gap-1.5 sm:gap-3">
              {statistics.monthlyActivity.map((month) => (
                <div className="flex h-full min-w-0 flex-col justify-end" key={month.month}>
                  <div className="mb-2 text-center font-[family-name:var(--font-mono)] text-[9px] font-semibold text-[var(--muted)]">
                    {month.count || ""}
                  </div>
                  <div className="flex h-[180px] items-end rounded-lg bg-[rgba(226,232,240,0.48)] p-1">
                    <div
                      className="w-full rounded-md bg-blue-500 transition-[height]"
                      style={{ height: `${month.count > 0 ? Math.max((month.count / maxMonthlyCount) * 100, 5) : 0}%` }}
                      title={`${month.count} recordings · ${formatDuration(month.durationMs)}`}
                    />
                  </div>
                  <p className="mt-2 truncate text-center text-[9px] font-semibold uppercase text-[var(--muted)]">
                    {formatMonth(month.month)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5">
            <BreakdownCard
              items={statistics.reviewBreakdown}
              label="Workflow"
              title="Review status"
              tones={{ approved: "bg-emerald-500", pending_review: "statistics-review-pending-bar", rejected: "bg-zinc-500" }}
              total={statistics.totalRecordings}
            />
            <BreakdownCard
              items={statistics.categoryBreakdown}
              label="Library"
              title="Recording types"
              tones={{ private: "bg-violet-500", unknown: "bg-zinc-400", work: "bg-blue-500" }}
              total={statistics.totalRecordings}
            />
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          <div className="glass-panel rounded-[28px] border border-white/70 p-4 shadow-[var(--shadow)] md:p-6">
            <SectionHeader label="Audio" title="Storage health" />
            <div className="mt-5 grid grid-cols-2 gap-3">
              <SmallMetric label="Files found" value={formatNumber(statistics.storage.fileCount)} />
              <SmallMetric label="Missing audio" value={formatNumber(statistics.storage.missingFileCount)} />
              <SmallMetric label="Average file" value={formatBytes(averageFileSize)} />
              <SmallMetric label="Total used" value={formatBytes(statistics.storage.totalBytes)} />
              <SmallMetric label="Recorded time" value={formatDuration(statistics.totalDurationMs)} />
              <SmallMetric label="Average length" value={formatDuration(statistics.averageDurationMs)} />
            </div>
            <p className="mt-4 text-[11px] leading-5 text-[var(--muted)]">
              Storage counts unique audio files linked to current recordings. Duplicate references are counted only once.
            </p>
          </div>

          <div className="glass-panel rounded-[28px] border border-white/70 p-4 shadow-[var(--shadow)] md:p-6">
            <SectionHeader label="Transcript" title="Languages" />
            <div className="mt-5 space-y-3">
              {statistics.languageBreakdown.map((language) => (
                <ProgressRow
                  count={language.count}
                  key={language.key}
                  label={language.label}
                  max={Math.max(statistics.totalRecordings, 1)}
                  tone="bg-cyan-500"
                />
              ))}
              {statistics.languageBreakdown.length === 0 ? <EmptyState label="No language data yet." /> : null}
            </div>
          </div>

          <div className="glass-panel rounded-[28px] border border-white/70 p-4 shadow-[var(--shadow)] md:p-6">
            <SectionHeader label="Efficiency" title="Useful ratios" />
            <div className="mt-5 space-y-4">
              <RatioMetric
                label="Approved"
                value={ratio(
                  statistics.reviewBreakdown.find((item) => item.key === "approved")?.count ?? 0,
                  statistics.totalRecordings
                )}
              />
              <RatioMetric
                label="Pending review"
                value={ratio(
                  statistics.reviewBreakdown.find((item) => item.key === "pending_review")?.count ?? 0,
                  statistics.totalRecordings
                )}
              />
              <RatioMetric
                label="Audio available"
                value={ratio(statistics.storage.fileCount, statistics.totalRecordings)}
              />
            </div>
          </div>
        </section>

        <section className="glass-panel rounded-[28px] border border-white/70 p-4 shadow-[var(--shadow)] md:p-6">
          <SectionHeader label="Storage" meta={`Top ${statistics.largestRecordings.length}`} title="Largest recordings" />
          {statistics.largestRecordings.length > 0 ? (
            <div className="mt-5 overflow-x-auto">
              <div className="min-w-[620px] space-y-2">
                {statistics.largestRecordings.map((recording, index) => (
                  <Link
                    className="group grid grid-cols-[30px_minmax(0,1fr)_100px_90px_90px_20px] items-center gap-3 rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-3 text-xs transition hover:border-blue-500/50 hover:bg-blue-500/[0.06]"
                    href={`/list?recordingId=${encodeURIComponent(recording.id)}`}
                    key={recording.id}
                    title={`Open ${recording.title}`}
                  >
                    <span className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--muted)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="truncate font-semibold text-[var(--text)]">{recording.title}</span>
                    <span className="text-right font-[family-name:var(--font-mono)] text-[10px] text-[var(--muted)]">
                      {formatBytes(recording.sizeBytes)}
                    </span>
                    <span className="text-right font-[family-name:var(--font-mono)] text-[10px] text-[var(--muted)]">
                      {formatDuration(recording.durationMs)}
                    </span>
                    <span className="text-right text-[10px] text-[var(--muted)]">
                      {DATE_FORMATTER.format(new Date(recording.startedAt))}
                    </span>
                    <span aria-hidden="true" className="text-right text-sm text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-blue-500">
                      →
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-5"><EmptyState label="No linked audio files were found." /></div>
          )}
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  detail,
  label,
  tone = "default",
  value
}: {
  detail: string;
  label: string;
  tone?: "default" | "blue" | "green" | "muted";
  value: string;
}) {
  const toneClasses = {
    blue: "statistics-metric-blue",
    default: "statistics-metric-default",
    green: "statistics-metric-green",
    muted: "statistics-metric-muted"
  };

  return (
    <div className={`statistics-metric rounded-[24px] border p-4 md:p-5 ${toneClasses[tone]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-3 text-[28px] font-semibold tracking-[-0.05em] text-[var(--text)] md:text-[34px]">{value}</p>
      <p className="mt-2 text-[11px] text-[var(--muted)]">{detail}</p>
    </div>
  );
}

function SectionHeader({ label, meta, title }: { label: string; meta?: string; title: string }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
        <h2 className="mt-1 text-lg font-semibold tracking-[-0.035em] text-[var(--text)] md:text-xl">{title}</h2>
      </div>
      {meta ? <span className="text-[10px] text-[var(--muted)]">{meta}</span> : null}
    </div>
  );
}

function BreakdownCard({
  items,
  label,
  title,
  tones,
  total
}: {
  items: StatisticsBreakdownItem[];
  label: string;
  title: string;
  tones: Record<string, string>;
  total: number;
}) {
  return (
    <div className="glass-panel rounded-[28px] border border-white/70 p-4 shadow-[var(--shadow)] md:p-5">
      <SectionHeader label={label} title={title} />
      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <ProgressRow
            count={item.count}
            key={item.key}
            label={item.label}
            max={Math.max(total, 1)}
            tone={tones[item.key] ?? "bg-blue-500"}
          />
        ))}
      </div>
    </div>
  );
}

function ProgressRow({ count, label, max, tone }: { count: number; label: string; max: number; tone: string }) {
  const percentage = Math.min((count / max) * 100, 100);
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-[var(--text)]">{label}</span>
        <span className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--muted)]">
          {count} · {Math.round(percentage)}%
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[rgba(226,232,240,0.8)]">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white/75 px-3 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-base font-semibold tracking-[-0.03em] text-[var(--text)]">{value}</p>
    </div>
  );
}

function RatioMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] pb-3 last:border-0 last:pb-0">
      <span className="text-xs font-semibold text-[var(--text)]">{label}</span>
      <span className="font-[family-name:var(--font-mono)] text-sm font-semibold text-blue-600">{Math.round(value * 100)}%</span>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="rounded-2xl border border-dashed border-[var(--line-strong)] px-4 py-5 text-xs text-[var(--muted)]">{label}</p>;
}

function ratio(value: number, total: number) {
  return total > 0 ? value / total : 0;
}

function formatMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return MONTH_FORMATTER.format(new Date(Date.UTC(year, monthNumber - 1, 1))).replace(".", "");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("de-DE").format(value);
}

function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function formatDuration(milliseconds: number) {
  const totalMinutes = Math.round(milliseconds / 60_000);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days} d ${remainingHours} h` : `${days} d`;
}
