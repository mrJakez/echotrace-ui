"use client";

import { type Dispatch, type SetStateAction, useMemo, useState } from "react";

import type { TagItem } from "@/lib/types";

export type RecordingListTagOption = {
  descendantIds: string[];
  id: string;
  name: string;
  pathLabel: string;
};

export type RecordingListTagFilter = RecordingListTagOption & {
  includeDescendants: boolean;
};

export function RecordingTagFilter({
  selectedTags,
  setSelectedTags
}: {
  selectedTags: RecordingListTagFilter[];
  setSelectedTags: Dispatch<SetStateAction<RecordingListTagFilter[]>>;
}) {
  const [availableTags, setAvailableTags] = useState<RecordingListTagOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const suggestions = useMemo(() => {
    const normalizedInput = input.trim().toLowerCase();
    const selectedIds = new Set(selectedTags.map((tag) => tag.id));
    return availableTags
      .filter((tag) => !selectedIds.has(tag.id))
      .filter((tag) => !normalizedInput || tag.pathLabel.toLowerCase().includes(normalizedInput))
      .slice(0, 8);
  }, [availableTags, input, selectedTags]);

  async function loadTags() {
    if (availableTags.length > 0 || isLoading) {
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch("/api/tags", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      setAvailableTags(flattenTagOptions((await response.json()) as TagItem[]));
    } finally {
      setIsLoading(false);
    }
  }

  function addTag(tag: RecordingListTagOption, includeDescendants: boolean) {
    setSelectedTags((current) =>
      current.some((item) => item.id === tag.id) ? current : [...current, { ...tag, includeDescendants }]
    );
    setInput("");
    setIsOpen(false);
  }

  function removeTag(tagId: string) {
    setSelectedTags((current) => current.filter((tag) => tag.id !== tagId));
  }

  return (
    <div className="relative w-full min-w-[220px] normal-case tracking-normal">
      <div className="flex min-h-8 flex-wrap items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface)] px-1.5 py-1 focus-within:border-[var(--line-strong)]">
        {selectedTags.map((tag) => (
          <span className="inline-flex max-w-[220px] items-center gap-1 rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent)]" key={tag.id}>
            <span className="truncate">{tag.name}{tag.includeDescendants ? " / *" : ""}</span>
            <button
              aria-label={`Remove ${tag.name} filter`}
              className="cursor-pointer text-[var(--muted)] hover:text-[var(--text)]"
              onClick={() => removeTag(tag.id)}
              type="button"
            >
              ×
            </button>
          </span>
        ))}
        <input
          aria-autocomplete="list"
          aria-expanded={isOpen}
          className="h-6 min-w-[90px] flex-1 bg-transparent px-1 text-xs font-normal text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
          onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
          onChange={(event) => {
            setInput(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            void loadTags();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && suggestions[0]) {
              event.preventDefault();
              addTag(suggestions[0], false);
            } else if (event.key === "Backspace" && !input && selectedTags.length > 0) {
              removeTag(selectedTags[selectedTags.length - 1].id);
            } else if (event.key === "Escape") {
              setIsOpen(false);
            }
          }}
          placeholder={selectedTags.length > 0 ? "Add tag..." : "Filter tags..."}
          role="combobox"
          type="search"
          value={input}
        />
      </div>
      {isOpen ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-50 max-h-72 overflow-y-auto rounded-md border border-[var(--line)] bg-[var(--surface)] shadow-lg">
          {isLoading ? <p className="px-2 py-2 text-left text-xs font-normal text-[var(--muted)]">Loading tags…</p> : null}
          {!isLoading && suggestions.length === 0 ? (
            <p className="px-2 py-2 text-left text-xs font-normal text-[var(--muted)]">No matching tags</p>
          ) : null}
          {suggestions.map((tag) => (
            <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-2 py-1.5 text-left last:border-b-0" key={tag.id} onMouseDown={(event) => event.preventDefault()}>
              <span className="min-w-0 font-normal text-[var(--text)]">
                <span className="block truncate text-xs font-semibold">{tag.name}</span>
                {tag.pathLabel !== tag.name ? <span className="block truncate text-[10px] text-[var(--muted)]">{tag.pathLabel}</span> : null}
              </span>
              <span className="flex shrink-0 gap-1">
                <button className="cursor-pointer rounded border border-[var(--line)] bg-[var(--surface-strong)] px-2 py-1 text-[10px] font-semibold text-[var(--text)] transition hover:border-[var(--line-strong)]" onClick={() => addTag(tag, false)} title={`Only ${tag.name}`} type="button">
                  Exact
                </button>
                {tag.descendantIds.length > 0 ? (
                  <button className="cursor-pointer rounded border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-[10px] font-semibold text-blue-600 transition hover:bg-blue-500/20" onClick={() => addTag(tag, true)} title={`${tag.name} and all sub-tags`} type="button">
                    + Sub-tags
                  </button>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function flattenTagOptions(items: TagItem[], parents: string[] = []): RecordingListTagOption[] {
  return items.flatMap((item) => {
    const path = [...parents, item.name];
    return [
      { descendantIds: collectTagIds(item.children), id: item.id, name: item.name, pathLabel: path.join(" / ") },
      ...flattenTagOptions(item.children, path)
    ];
  });
}

function collectTagIds(items: TagItem[]): string[] {
  return items.flatMap((item) => [item.id, ...collectTagIds(item.children)]);
}
