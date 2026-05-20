"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";

type AppNavigationProps = {
  activeProfileEmail: string;
  buildSha: string;
  buildTime: string;
};

export function AppNavigation({ activeProfileEmail, buildSha, buildTime }: AppNavigationProps) {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <>
      {!isExpanded ? (
        <button
          aria-label="Expand navigation"
          className="fixed left-3 top-3 z-40 flex h-11 w-11 cursor-pointer items-center justify-center rounded-[18px] border border-white/80 bg-white/92 text-[var(--muted)] shadow-[0_12px_28px_rgba(15,23,42,0.12)] backdrop-blur transition hover:bg-white md:hidden"
          onClick={() => setIsExpanded(true)}
          type="button"
        >
          <BurgerIcon />
        </button>
      ) : null}

      {isExpanded ? (
        <button
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-30 cursor-pointer bg-[rgba(15,23,42,0.16)] backdrop-blur-[2px] md:hidden"
          onClick={() => setIsExpanded(false)}
          type="button"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen flex-col border-r border-[rgba(226,232,240,0.92)] bg-white/96 px-3 py-4 shadow-[0_20px_44px_rgba(15,23,42,0.08)] backdrop-blur transition-[width,transform] duration-200 ${
          isExpanded ? "w-[270px] translate-x-0" : "w-[270px] -translate-x-full md:w-[78px] md:translate-x-0"
        }`}
      >
        <div className={`flex items-center ${isExpanded ? "justify-between gap-3" : "justify-center"}`}>
          {isExpanded ? (
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Navigation</p>
            <p className="mt-1 truncate text-sm font-medium text-[var(--text)]">{activeProfileEmail}</p>
          </div>
          ) : null}
          <button
            aria-label={isExpanded ? "Collapse navigation" : "Expand navigation"}
            className="hidden h-11 w-11 cursor-pointer items-center justify-center rounded-[18px] border border-white/80 bg-white/88 text-[var(--muted)] shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition hover:bg-white md:flex"
            onClick={() => setIsExpanded((value) => !value)}
            type="button"
          >
            <BurgerIcon />
          </button>
          <button
            aria-label="Close navigation"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-[18px] border border-white/80 bg-white/88 text-[var(--muted)] shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition hover:bg-white md:hidden"
            onClick={() => setIsExpanded(false)}
            type="button"
          >
            <BurgerIcon />
          </button>
        </div>

        <div className="mt-6 flex flex-1 flex-col gap-1">
        <NavMenuLink href="/" icon={<CalendarIcon />} isActive={pathname === "/"} isExpanded={isExpanded} label="Calendar" />
        <NavMenuLink
          href="/tags"
          icon={<TagIcon />}
          isActive={pathname.startsWith("/tags")}
          isExpanded={isExpanded}
          label="Tags"
        />
        <NavMenuLink
          href="/prompts"
          icon={<PromptIcon />}
          isActive={pathname.startsWith("/prompts")}
          isExpanded={isExpanded}
          label="Prompts"
        />
        <button
          aria-label="Logout"
          className={`mt-1 flex w-full cursor-pointer items-center rounded-[18px] px-3 py-3 text-left text-sm font-medium transition ${
            isExpanded ? "gap-3 justify-start" : "justify-center"
          } text-[var(--text)] hover:bg-[rgba(248,250,252,0.96)]`}
          onClick={() => void logout()}
          title="Logout"
          type="button"
        >
          <LogoutIcon />
          {isExpanded ? <span>Logout</span> : null}
        </button>

        <div className="mt-auto">
          {isExpanded ? (
            <div className="rounded-[18px] border border-[rgba(226,232,240,0.92)] bg-[rgba(248,250,252,0.96)] px-4 py-3 text-xs text-[var(--muted)]">
              <p className="font-semibold uppercase tracking-[0.16em]">Build</p>
              <p className="mt-2 font-[family-name:var(--font-mono)] text-[11px] text-[var(--text)]">{buildSha}</p>
              {buildTime ? <p className="mt-1">{formatBuildTime(buildTime)}</p> : null}
            </div>
          ) : (
            <div
              className="flex h-11 items-center justify-center rounded-[18px] border border-[rgba(226,232,240,0.92)] bg-[rgba(248,250,252,0.96)] text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]"
              title={`${buildSha}${buildTime ? ` · ${formatBuildTime(buildTime)}` : ""}`}
            >
              {buildSha.slice(0, 4)}
            </div>
          )}
        </div>
      </div>
      </aside>
    </>
  );
}

function NavMenuLink({
  href,
  icon,
  isActive,
  isExpanded,
  label
}: {
  href: string;
  icon: ReactNode;
  isActive: boolean;
  isExpanded: boolean;
  label: string;
}) {
  return (
    <Link
      aria-label={label}
      className={`flex rounded-[18px] px-3 py-3 text-sm font-medium transition ${
        isExpanded ? "justify-start gap-3" : "justify-center"
      } ${
        isActive ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text)] hover:bg-[rgba(248,250,252,0.96)]"
      }`}
      href={href}
      title={label}
    >
      {icon}
      {isExpanded ? <span>{label}</span> : null}
    </Link>
  );
}

function BurgerIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16">
      <path d="M3 4.5h10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      <path d="M3 8h10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      <path d="M3 11.5h10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 20 20">
      <rect height="12" rx="3" stroke="currentColor" strokeWidth="1.5" width="14" x="3" y="5" />
      <path d="M6.5 3.5v3M13.5 3.5v3M3 8.5h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 20 20">
      <path
        d="M10.5 3.5H6.8c-.66 0-.99 0-1.26.13-.24.11-.43.3-.54.54-.13.27-.13.6-.13 1.26v3.7c0 .29 0 .43.04.56.04.12.1.24.18.34.08.11.18.21.39.42l4.98 4.98a1.5 1.5 0 0 0 2.12 0l2.85-2.85a1.5 1.5 0 0 0 0-2.12l-4.98-4.98a2.1 2.1 0 0 0-.42-.39 1.3 1.3 0 0 0-.34-.18c-.13-.04-.27-.04-.56-.04Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <circle cx="7.6" cy="7.6" fill="currentColor" r="1.1" />
    </svg>
  );
}

function PromptIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 20 20">
      <path d="M5.5 4.5h9A1.5 1.5 0 0 1 16 6v8a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 14V6a1.5 1.5 0 0 1 1.5-1.5Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 8h6M7 11h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
      <path d="M14 3v3M6 3v3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 20 20">
      <path d="M8 5.5H6.5A2.5 2.5 0 0 0 4 8v4a2.5 2.5 0 0 0 2.5 2.5H8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
      <path d="M11 6.5 14.5 10 11 13.5M8.5 10h6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function formatBuildTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin"
  }).format(date);
}
