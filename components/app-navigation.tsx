"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

type ThemePreference = "light" | "dark" | "auto";

type AppNavigationProps = {
  activeProfileEmail: string;
  buildSha: string;
  buildTime: string;
};

export function AppNavigation({ activeProfileEmail, buildSha, buildTime }: AppNavigationProps) {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);
  const [themePreference, setThemePreference] = useState<ThemePreference>("auto");
  const [isThemeReady, setIsThemeReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("echotrace-theme");
    if (stored === "light" || stored === "dark" || stored === "auto") {
      setThemePreference(stored);
    }
    setIsThemeReady(true);
  }, []);

  useEffect(() => {
    if (!isThemeReady) {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolved = themePreference === "auto" ? (media.matches ? "dark" : "light") : themePreference;
      document.documentElement.dataset.theme = themePreference;
      document.documentElement.dataset.resolvedTheme = resolved;
      window.localStorage.setItem("echotrace-theme", themePreference);
    };

    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [isThemeReady, themePreference]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <>
      {!isExpanded ? (
        <button
          aria-label="Expand navigation"
          className="fixed left-3 top-3 z-40 flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-100 md:hidden"
          onClick={() => setIsExpanded(true)}
          type="button"
        >
          <BurgerIcon />
        </button>
      ) : null}

      {isExpanded ? (
        <button
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-30 cursor-pointer bg-black/70 md:hidden"
          onClick={() => setIsExpanded(false)}
          type="button"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen flex-col border-r border-zinc-800 bg-zinc-950 px-3 py-4 transition-[width,transform] duration-200 ${
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
            className="hidden h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-500 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-200 md:flex"
            onClick={() => setIsExpanded((value) => !value)}
            type="button"
          >
            <BurgerIcon />
          </button>
          <button
            aria-label="Close navigation"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200 md:hidden"
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
          } text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100`}
          onClick={() => void logout()}
          title="Logout"
          type="button"
        >
          <LogoutIcon />
          {isExpanded ? <span>Logout</span> : null}
        </button>

        <div className="mt-auto space-y-2">
          <ThemePreferenceControl
            isExpanded={isExpanded}
            onChange={setThemePreference}
            value={themePreference}
          />
          {isExpanded ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-xs text-zinc-500">
              <p className="font-semibold uppercase tracking-[0.16em]">Build</p>
              <p className="mt-2 font-[family-name:var(--font-mono)] text-[11px] text-[var(--text)]">{buildSha}</p>
              {buildTime ? <p className="mt-1">{formatBuildTime(buildTime)}</p> : null}
            </div>
          ) : (
            <div
              className="flex h-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600"
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

function ThemePreferenceControl({
  isExpanded,
  onChange,
  value
}: {
  isExpanded: boolean;
  onChange: (value: ThemePreference) => void;
  value: ThemePreference;
}) {
  const options: Array<{ label: string; value: ThemePreference }> = [
    { label: "Light", value: "light" },
    { label: "Dark", value: "dark" },
    { label: "Auto", value: "auto" }
  ];

  if (!isExpanded) {
    const nextPreference: Record<ThemePreference, ThemePreference> = {
      auto: "light",
      light: "dark",
      dark: "auto"
    };

    return (
      <button
        aria-label={`Theme: ${value}. Switch theme`}
        className="flex h-10 w-full cursor-pointer items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-500 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-200"
        onClick={() => onChange(nextPreference[value])}
        title={`Theme: ${value} · click to switch`}
        type="button"
      >
        <ThemeIcon preference={value} />
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-1">
      <p className="px-2 pb-1.5 pt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-600">Appearance</p>
      <div className="grid grid-cols-3 gap-1">
        {options.map((option) => (
          <button
            aria-pressed={value === option.value}
            className={`cursor-pointer rounded-md px-1.5 py-1.5 text-[10px] font-medium transition ${
              value === option.value ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            }`}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ThemeIcon({ preference }: { preference: ThemePreference }) {
  if (preference === "light") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
      </svg>
    );
  }

  if (preference === "dark") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 20 20">
        <path d="M16.5 12.6A7 7 0 0 1 7.4 3.5 7 7 0 1 0 16.5 12.6Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 20 20">
      <rect height="12" rx="2" stroke="currentColor" strokeWidth="1.5" width="15" x="2.5" y="3" />
      <path d="M7 17h6M10 15v2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
      <path d="M10 5.5a3.5 3.5 0 0 0 0 7Z" fill="currentColor" />
    </svg>
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
      className={`flex rounded-lg px-3 py-2.5 text-sm font-medium transition ${
        isExpanded ? "justify-start gap-3" : "justify-center"
      } ${
        isActive ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
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
