"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { MarkdownResponse } from "@/components/markdown-response";
import type { PromptItem } from "@/lib/types";

type PromptSelectorDetailsProps = {
  isLoading: boolean;
  onChange: (id: string) => void;
  prompts: PromptItem[];
  selectedPromptId: string;
};

function summarizePromptMarkdown(markdown: string) {
  const plainText = markdown
    .replace(/^---[\s\S]*?---\s*/m, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (plainText.length <= 320) {
    return plainText;
  }

  const shortened = plainText.slice(0, 320);
  const sentenceEnd = Math.max(shortened.lastIndexOf(". "), shortened.lastIndexOf("! "), shortened.lastIndexOf("? "));
  const summaryEnd = sentenceEnd >= 180 ? sentenceEnd + 1 : shortened.lastIndexOf(" ");
  return `${shortened.slice(0, summaryEnd).trim()}…`;
}

export function PromptSelectorDetails({
  isLoading,
  onChange,
  prompts,
  selectedPromptId
}: PromptSelectorDetailsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement | null>(null);
  const selectedPrompt = useMemo(
    () => prompts.find((prompt) => prompt.id === selectedPromptId) ?? null,
    [prompts, selectedPromptId]
  );

  useEffect(() => {
    setIsExpanded(false);
    setIsMenuOpen(false);
  }, [selectedPromptId]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!selectorRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  const promptStats = useMemo(() => {
    if (!selectedPrompt) {
      return null;
    }

    const trimmedPrompt = selectedPrompt.prompt.trim();
    return {
      lines: trimmedPrompt ? trimmedPrompt.split(/\r?\n/).length : 0,
      summary: summarizePromptMarkdown(trimmedPrompt),
      words: trimmedPrompt ? trimmedPrompt.split(/\s+/).length : 0
    };
  }, [selectedPrompt]);

  return (
    <div className="grid gap-2">
      <div className="grid gap-2" ref={selectorRef}>
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Prompt</span>
        <div className="relative min-w-0">
          <button
            aria-expanded={isMenuOpen}
            aria-haspopup="listbox"
            aria-label="Select prompt"
            className="group/select flex h-11 w-full min-w-0 cursor-pointer items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] pl-3.5 text-left text-sm font-semibold text-[var(--text)] shadow-[0_6px_18px_rgba(15,23,42,0.04)] outline-none transition hover:border-[var(--line-strong)] focus:border-blue-500/60 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading || prompts.length === 0}
            onClick={() => setIsMenuOpen((current) => !current)}
            type="button"
          >
            <span className="min-w-0 truncate">
              {isLoading
                ? "Loading prompts..."
                : selectedPrompt?.title ?? (prompts.length === 0 ? "No prompts configured" : "Select prompt")}
            </span>
            <span
              aria-hidden="true"
              className="ml-3 flex h-full w-10 shrink-0 items-center justify-center rounded-r-[11px] border-l border-[var(--line)] bg-[var(--surface-strong)] text-[var(--muted)] transition group-hover/select:text-[var(--text)]"
            >
              <svg className={`h-4 w-4 transition-transform ${isMenuOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 16 16">
                <path d="m4.5 6 3.5 3.5L11.5 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
              </svg>
            </span>
          </button>

          {isMenuOpen ? (
            <div
              className="absolute left-0 right-0 top-[calc(100%+6px)] z-[90] max-h-60 overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-[0_18px_44px_rgba(15,23,42,0.22)]"
              role="listbox"
            >
              {prompts.map((prompt) => {
                const isSelected = prompt.id === selectedPromptId;
                return (
                  <button
                    aria-selected={isSelected}
                    className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${
                      isSelected
                        ? "bg-blue-500/12 text-blue-500"
                        : "text-[var(--text)] hover:bg-[var(--surface-strong)]"
                    }`}
                    key={prompt.id}
                    onClick={() => {
                      onChange(prompt.id);
                      setIsMenuOpen(false);
                    }}
                    role="option"
                    type="button"
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center text-xs ${isSelected ? "opacity-100" : "opacity-0"}`}>
                      ✓
                    </span>
                    <span className="min-w-0 truncate">{prompt.title}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {selectedPrompt && promptStats ? (
        <div className="rounded-[16px] border border-[var(--line)] bg-[var(--surface-strong)] p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Prompt summary</p>
              <p className="mt-1 truncate text-sm font-semibold text-[var(--text)]">{selectedPrompt.title}</p>
            </div>
            <span className="shrink-0 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[9px] font-medium text-[var(--muted)]">
              {promptStats.words} words · {promptStats.lines} lines
            </span>
          </div>

          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
            {promptStats.summary || "This prompt does not contain any descriptive text."}
          </p>

          <button
            className="mt-2 cursor-pointer rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[10px] font-semibold text-[var(--text)] transition hover:border-[var(--line-strong)]"
            onClick={() => setIsExpanded((current) => !current)}
            type="button"
          >
            {isExpanded ? "Hide full prompt" : "Show full prompt"}
          </button>

          {isExpanded ? (
            <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
              <MarkdownResponse compact content={selectedPrompt.prompt} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
