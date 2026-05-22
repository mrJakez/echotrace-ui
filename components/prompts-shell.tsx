"use client";

import { useMemo, useState } from "react";

import { AppNavigation } from "@/components/app-navigation";
import { MarkdownResponse } from "@/components/markdown-response";
import type { PromptItem } from "@/lib/types";

type PromptsShellProps = {
  activeProfileEmail: string;
  buildSha: string;
  buildTime: string;
  initialPrompts: PromptItem[];
};

type PromptEditorState = {
  mode: "create" | "edit";
  id?: string;
  originalPrompt?: string;
  originalTitle?: string;
  title: string;
  prompt: string;
};

export function PromptsShell({ activeProfileEmail, buildSha, buildTime, initialPrompts }: PromptsShellProps) {
  const [prompts, setPrompts] = useState(initialPrompts);
  const [editor, setEditor] = useState<PromptEditorState | null>(null);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(initialPrompts[0]?.id ?? null);
  const [isSaving, setIsSaving] = useState(false);

  const selectedPrompt = useMemo(
    () => prompts.find((prompt) => prompt.id === selectedPromptId) ?? prompts[0] ?? null,
    [prompts, selectedPromptId]
  );

  function openCreateEditor() {
    setEditor({
      mode: "create",
      originalPrompt: "",
      originalTitle: "",
      title: "",
      prompt: ""
    });
  }

  function openEditEditor(prompt: PromptItem) {
    setEditor({
      mode: "edit",
      id: prompt.id,
      originalPrompt: prompt.prompt,
      originalTitle: prompt.title,
      title: prompt.title,
      prompt: prompt.prompt
    });
  }

  async function saveEditor() {
    if (!editor || !editor.title.trim() || !editor.prompt.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      const response =
        editor.mode === "create"
          ? await fetch("/api/prompts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: editor.prompt.trim(),
                title: editor.title.trim()
              })
            })
          : await fetch(`/api/prompts/${editor.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: editor.prompt.trim(),
                title: editor.title.trim()
              })
            });

      if (!response.ok) {
        return;
      }

      const nextPrompts = (await response.json()) as PromptItem[];
      setPrompts(nextPrompts);
      if (editor.mode === "edit" && editor.id) {
        setSelectedPromptId(editor.id);
      } else {
        setSelectedPromptId(nextPrompts[0]?.id ?? null);
      }
      setEditor(null);
    } finally {
      setIsSaving(false);
    }
  }

  async function deletePrompt(id: string) {
    const response = await fetch(`/api/prompts/${id}`, { method: "DELETE" });
    if (!response.ok) {
      return;
    }

    const nextPrompts = (await response.json()) as PromptItem[];
    setPrompts(nextPrompts);
    if (selectedPromptId === id) {
      setSelectedPromptId(nextPrompts[0]?.id ?? null);
    }
  }

  return (
    <main className="min-h-screen px-3 py-3 md:pl-[6.5rem] md:pr-8 md:py-8">
      <AppNavigation activeProfileEmail={activeProfileEmail} buildSha={buildSha} buildTime={buildTime} />
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 md:gap-6">
        <section className="glass-panel overflow-hidden rounded-[28px] border border-white/70 shadow-[var(--shadow)] md:rounded-[36px]">
          <div className="px-4 py-4 md:px-8 md:py-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-white/80 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                  EchoTrace
                </span>
                <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                  Prompts
                </span>
              </div>
              <div className="space-y-2">
                <h1 className="max-w-3xl text-[28px] font-semibold tracking-[-0.05em] text-balance md:text-[42px]">
                  Manage reusable prompts.
                </h1>
                <p className="max-w-xl text-[13px] leading-6 text-[var(--muted)] md:text-[15px]">
                  Store prompt templates that can be used later with selected recordings from the calendar.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="glass-panel rounded-[28px] border border-white/70 p-4 shadow-[var(--shadow)] md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Prompt Library</p>
                <p className="mt-2 text-sm text-[var(--muted)]">{prompts.length} prompts configured</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="cursor-pointer rounded-2xl border border-[rgba(226,232,240,0.95)] bg-white px-4 py-2 text-sm font-semibold text-[var(--text)]"
                  onClick={openCreateEditor}
                  type="button"
                >
                  New prompt
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {prompts.length === 0 ? (
                <p className="rounded-[22px] border border-dashed border-[rgba(203,213,225,0.95)] bg-white/68 px-4 py-6 text-sm text-[var(--muted)]">
                  No prompts yet. Create the first one to use it from the calendar export workflow.
                </p>
              ) : (
                prompts.map((prompt) => (
                  <div
                    key={prompt.id}
                    className={`w-full cursor-pointer rounded-[22px] border px-4 py-4 text-left transition ${
                      selectedPrompt?.id === prompt.id
                        ? "border-[rgba(37,99,235,0.32)] bg-[rgba(239,246,255,0.94)]"
                        : "border-[rgba(226,232,240,0.95)] bg-white/82 hover:bg-white"
                    }`}
                    onClick={() => setSelectedPromptId(prompt.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold tracking-[-0.02em] text-[var(--text)]">{prompt.title}</p>
                        <p className="mt-2 font-[family-name:var(--font-mono)] text-[11px] text-[var(--muted)]">{prompt.id}</p>
                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--muted)]">{prompt.prompt}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
        </section>

        <section className="glass-panel rounded-[28px] border border-white/70 p-4 shadow-[var(--shadow)] md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Prompt Detail</p>
                {selectedPrompt ? (
                  <p className="mt-2 font-[family-name:var(--font-mono)] text-xs text-[var(--muted)]">{selectedPrompt.id}</p>
                ) : null}
              </div>
              {selectedPrompt ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    className="cursor-pointer rounded-2xl border border-[rgba(226,232,240,0.95)] bg-white px-4 py-2 text-sm font-semibold text-[var(--text)]"
                    onClick={() => openEditEditor(selectedPrompt)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="cursor-pointer rounded-2xl border border-[rgba(248,113,113,0.3)] bg-[rgba(254,242,242,0.95)] px-4 py-2 text-sm font-semibold text-[rgba(185,28,28,0.95)]"
                    onClick={() => void deletePrompt(selectedPrompt.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
            {selectedPrompt ? (
              <div className="mt-4">
                <h2 className="text-[28px] font-semibold tracking-[-0.05em] text-[var(--text)] md:text-[40px]">{selectedPrompt.title}</h2>
                <div className="mt-5 rounded-[22px] border border-[rgba(226,232,240,0.95)] bg-white/86 p-4 md:p-6">
                  <MarkdownResponse content={selectedPrompt.prompt} />
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">Select a prompt to view and manage it.</p>
            )}
        </section>

        {editor ? (
          <PromptEditorDialog
            editor={editor}
            isSaving={isSaving}
            onCancel={() => setEditor(null)}
            onChange={setEditor}
            onSave={() => void saveEditor()}
          />
        ) : null}
      </div>
    </main>
  );
}

function PromptEditorDialog({
  editor,
  isSaving,
  onCancel,
  onChange,
  onSave
}: {
  editor: PromptEditorState;
  isSaving: boolean;
  onCancel: () => void;
  onChange: (next: PromptEditorState) => void;
  onSave: () => void;
}) {
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const promptDiff = useMemo(
    () => buildLineDiff(editor.originalPrompt ?? "", editor.prompt),
    [editor.originalPrompt, editor.prompt]
  );
  const hasTitleChanged = (editor.originalTitle ?? "") !== editor.title;
  const hasPromptChanged = (editor.originalPrompt ?? "") !== editor.prompt;
  const shouldShowDiff = editor.mode === "edit" && (hasTitleChanged || hasPromptChanged);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.18)] px-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[28px] border border-white/80 bg-white/96 p-5 shadow-[0_28px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              {editor.mode === "create" ? "Create Prompt" : "Edit Prompt"}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text)]">Prompt details</h2>
          </div>
          <button className="cursor-pointer rounded-full bg-[rgba(15,23,42,0.06)] px-3 py-1.5 text-sm font-semibold" onClick={onCancel} type="button">
            Close
          </button>
        </div>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Title</span>
            <input
              className="rounded-2xl border border-[rgba(226,232,240,0.95)] bg-white px-4 py-3 text-sm outline-none focus:border-[rgba(37,99,235,0.45)]"
              onChange={(event) => onChange({ ...editor, title: event.target.value })}
              placeholder="Prompt title"
              value={editor.title}
            />
          </label>
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Prompt</span>
            <textarea
              className="min-h-[280px] rounded-2xl border border-[rgba(226,232,240,0.95)] bg-white px-4 py-3 text-sm leading-7 outline-none focus:border-[rgba(37,99,235,0.45)]"
              onChange={(event) => onChange({ ...editor, prompt: event.target.value })}
              placeholder="Prompt text"
              value={editor.prompt}
            />
          </label>
        </div>
        {shouldShowDiff ? (
          <div className="mt-5 rounded-[24px] border border-[rgba(226,232,240,0.95)] bg-[rgba(248,250,252,0.94)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Diff Preview</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {isDiffOpen ? "Review changes before saving." : "Changes are available. Open the diff if you want to inspect them."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isDiffOpen ? (
                  <div className="flex gap-2 text-[11px] font-semibold">
                    <span className="rounded-full bg-[rgba(220,252,231,0.9)] px-2.5 py-1 text-[rgba(22,101,52,0.95)]">Added</span>
                    <span className="rounded-full bg-[rgba(254,226,226,0.92)] px-2.5 py-1 text-[rgba(153,27,27,0.95)]">Removed</span>
                  </div>
                ) : null}
                <button
                  className="cursor-pointer rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)]"
                  onClick={() => setIsDiffOpen((value) => !value)}
                  type="button"
                >
                  {isDiffOpen ? "Hide diff" : "Show diff"}
                </button>
              </div>
            </div>
            {isDiffOpen ? (
              <>
                {hasTitleChanged ? (
                  <div className="mt-4 rounded-[18px] border border-[rgba(226,232,240,0.85)] bg-white/86 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Title</p>
                    <div className="mt-2 grid gap-1 font-[family-name:var(--font-mono)] text-xs">
                      <DiffLine line={{ text: editor.originalTitle || "(empty)", type: "removed" }} />
                      <DiffLine line={{ text: editor.title || "(empty)", type: "added" }} />
                    </div>
                  </div>
                ) : null}
                {hasPromptChanged ? (
                  <div className="mt-4 max-h-[360px] overflow-y-auto rounded-[18px] border border-[rgba(226,232,240,0.85)] bg-white/86 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Prompt</p>
                    <div className="mt-2 grid gap-1 font-[family-name:var(--font-mono)] text-xs">
                      {promptDiff.map((line, index) => (
                        <DiffLine key={`${line.type}-${index}-${line.text}`} line={line} />
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : editor.mode === "edit" ? (
          <div className="mt-5 rounded-[18px] border border-[rgba(226,232,240,0.9)] bg-[rgba(248,250,252,0.9)] px-4 py-3 text-sm text-[var(--muted)]">
            No changes yet.
          </div>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button className="cursor-pointer rounded-2xl border border-[rgba(226,232,240,0.95)] bg-white px-4 py-2 text-sm font-semibold" onClick={onCancel} type="button">
            Cancel
          </button>
          <button
            className="cursor-pointer rounded-2xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving || !editor.title.trim() || !editor.prompt.trim()}
            onClick={onSave}
            type="button"
          >
            {isSaving ? "Saving..." : "Save prompt"}
          </button>
        </div>
      </div>
    </div>
  );
}

type DiffLineItem = {
  text: string;
  type: "added" | "removed" | "unchanged";
};

function DiffLine({ line }: { line: DiffLineItem }) {
  const prefix = line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";
  const className =
    line.type === "added"
      ? "border-[rgba(34,197,94,0.22)] bg-[rgba(220,252,231,0.86)] text-[rgba(20,83,45,0.98)]"
      : line.type === "removed"
        ? "border-[rgba(248,113,113,0.24)] bg-[rgba(254,226,226,0.86)] text-[rgba(127,29,29,0.98)]"
        : "border-transparent bg-transparent text-[var(--text)]";

  return (
    <div className={`grid grid-cols-[24px_minmax(0,1fr)] rounded-xl border px-2 py-1.5 ${className}`}>
      <span className="select-none text-center font-semibold">{prefix}</span>
      <span className="whitespace-pre-wrap break-words">{line.text || " "}</span>
    </div>
  );
}

function buildLineDiff(previous: string, next: string): DiffLineItem[] {
  const previousLines = previous.split("\n");
  const nextLines = next.split("\n");
  const table = Array.from({ length: previousLines.length + 1 }, () => Array<number>(nextLines.length + 1).fill(0));

  for (let previousIndex = previousLines.length - 1; previousIndex >= 0; previousIndex -= 1) {
    for (let nextIndex = nextLines.length - 1; nextIndex >= 0; nextIndex -= 1) {
      table[previousIndex][nextIndex] =
        previousLines[previousIndex] === nextLines[nextIndex]
          ? table[previousIndex + 1][nextIndex + 1] + 1
          : Math.max(table[previousIndex + 1][nextIndex], table[previousIndex][nextIndex + 1]);
    }
  }

  const diff: DiffLineItem[] = [];
  let previousIndex = 0;
  let nextIndex = 0;

  while (previousIndex < previousLines.length && nextIndex < nextLines.length) {
    if (previousLines[previousIndex] === nextLines[nextIndex]) {
      diff.push({ text: previousLines[previousIndex], type: "unchanged" });
      previousIndex += 1;
      nextIndex += 1;
    } else if (table[previousIndex + 1][nextIndex] >= table[previousIndex][nextIndex + 1]) {
      diff.push({ text: previousLines[previousIndex], type: "removed" });
      previousIndex += 1;
    } else {
      diff.push({ text: nextLines[nextIndex], type: "added" });
      nextIndex += 1;
    }
  }

  while (previousIndex < previousLines.length) {
    diff.push({ text: previousLines[previousIndex], type: "removed" });
    previousIndex += 1;
  }

  while (nextIndex < nextLines.length) {
    diff.push({ text: nextLines[nextIndex], type: "added" });
    nextIndex += 1;
  }

  return diff;
}
