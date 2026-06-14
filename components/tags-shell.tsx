"use client";

import { useMemo, useState } from "react";

import { AppNavigation } from "@/components/app-navigation";
import type { TagItem } from "@/lib/types";

type TagsShellProps = {
  activeProfileEmail: string;
  buildSha: string;
  buildTime: string;
  initialTags: TagItem[];
};

type TagFlatItem = TagItem & {
  ancestorIds: string[];
  pathLabel: string;
};

type TagEditorState = {
  mode: "create" | "edit";
  tagId?: string;
  name: string;
  description: string;
  parentId: string;
};

export function TagsShell({ activeProfileEmail, buildSha, buildTime, initialTags }: TagsShellProps) {
  const [tags, setTags] = useState(initialTags);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(initialTags[0]?.id ?? null);
  const [editor, setEditor] = useState<TagEditorState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [expandedIds, setExpandedIds] = useState(() => new Set(flattenTags(initialTags).map((tag) => tag.id)));

  const flatTags = useMemo<TagFlatItem[]>(() => flattenTags(tags), [tags]);
  const selectedTag = flatTags.find((tag) => tag.id === selectedTagId) ?? null;

  function setAllExpanded(next: boolean) {
    setExpandedIds(next ? new Set(flatTags.map((tag) => tag.id)) : new Set());
  }

  function toggleExpanded(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function openCreateEditor(parentId: string | null) {
    setEditor({
      mode: "create",
      name: "",
      description: "",
      parentId: parentId ?? "root"
    });
  }

  function openEditEditor(tag: TagFlatItem) {
    setEditor({
      mode: "edit",
      tagId: tag.id,
      name: tag.name,
      description: tag.description ?? "",
      parentId: tag.parentId ?? "root"
    });
  }

  async function saveEditor() {
    if (!editor || !editor.name.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      const response =
        editor.mode === "create"
          ? await fetch("/api/tags", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: editor.name.trim(),
                description: editor.description.trim() || null,
                parentId: editor.parentId === "root" ? null : editor.parentId
              })
            })
          : await fetch(`/api/tags/${editor.tagId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: editor.name.trim(),
                description: editor.description.trim() || null,
                parentId: editor.parentId === "root" ? null : editor.parentId
              })
            });

      if (!response.ok) {
        return;
      }

      const nextTags = (await response.json()) as TagItem[];
      setTags(nextTags);
      setExpandedIds(new Set(flattenTags(nextTags).map((tag) => tag.id)));
      if (editor.mode === "edit" && editor.tagId) {
        setSelectedTagId(editor.tagId);
      }
      setEditor(null);
    } finally {
      setIsSaving(false);
    }
  }

  async function removeTag(id: string) {
    const response = await fetch(`/api/tags/${id}`, { method: "DELETE" });
    if (!response.ok) {
      return;
    }

    const nextTags = (await response.json()) as TagItem[];
    setTags(nextTags);
    if (selectedTagId === id) {
      setSelectedTagId(nextTags[0]?.id ?? null);
    }
  }

  async function reorderTag(id: string, direction: "move_up" | "move_down") {
    const response = await fetch(`/api/tags/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: direction })
    });

    if (!response.ok) {
      return;
    }

    const nextTags = (await response.json()) as TagItem[];
    setTags(nextTags);
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
                  Tags
                </span>
              </div>
              <div className="space-y-2">
                <h1 className="max-w-3xl text-[28px] font-semibold tracking-[-0.05em] text-balance md:text-[42px]">
                  Organize your tag system.
                </h1>
                <p className="max-w-xl text-[13px] leading-6 text-[var(--muted)] md:text-[15px]">
                  Browse the hierarchy in view mode. Switch to edit mode when you want to create, move, edit, or delete tags.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="glass-panel rounded-[28px] border border-white/70 p-4 shadow-[var(--shadow)] md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Hierarchy</p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {flatTags.length} tags in total{selectedTag ? ` · selected: ${selectedTag.pathLabel}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="cursor-pointer rounded-2xl border border-[rgba(226,232,240,0.95)] bg-white px-3 py-2 text-sm font-semibold text-[var(--text)]"
                onClick={() => setAllExpanded(true)}
                type="button"
              >
                Expand all
              </button>
              <button
                className="cursor-pointer rounded-2xl border border-[rgba(226,232,240,0.95)] bg-white px-3 py-2 text-sm font-semibold text-[var(--text)]"
                onClick={() => setAllExpanded(false)}
                type="button"
              >
                Collapse all
              </button>
              <button
                className={`cursor-pointer rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                  isEditMode ? "bg-[var(--accent)] text-white" : "border border-[rgba(226,232,240,0.95)] bg-white text-[var(--text)]"
                }`}
                onClick={() => setIsEditMode((value) => !value)}
                type="button"
              >
                {isEditMode ? "Done editing" : "Edit mode"}
              </button>
              {isEditMode ? (
                <button
                  className="cursor-pointer rounded-2xl border border-[rgba(226,232,240,0.95)] bg-white px-4 py-2 text-sm font-semibold text-[var(--text)]"
                  onClick={() => openCreateEditor(null)}
                  type="button"
                >
                  New root tag
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {tags.map((tag) => (
              <TagTreeRow
                key={tag.id}
                expandedIds={expandedIds}
                isEditMode={isEditMode}
                onCreateChild={openCreateEditor}
                onDelete={removeTag}
                onEdit={openEditEditor}
                onReorder={reorderTag}
                onSelect={setSelectedTagId}
                onToggleExpanded={toggleExpanded}
                selectedTagId={selectedTagId}
                tag={tag}
              />
            ))}
          </div>
        </section>

        {editor ? (
          <TagEditorDialog
            availableParents={flatTags}
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

function TagTreeRow({
  expandedIds,
  isEditMode,
  onCreateChild,
  onDelete,
  onEdit,
  onReorder,
  onSelect,
  onToggleExpanded,
  selectedTagId,
  tag,
  depth = 0
}: {
  expandedIds: Set<string>;
  isEditMode: boolean;
  onCreateChild: (parentId: string | null) => void;
  onDelete: (id: string) => void;
  onEdit: (tag: TagFlatItem) => void;
  onReorder: (id: string, direction: "move_up" | "move_down") => void;
  onSelect: (id: string) => void;
  onToggleExpanded: (id: string) => void;
  selectedTagId: string | null;
  tag: TagItem;
  depth?: number;
}) {
  const isExpanded = expandedIds.has(tag.id);
  const flatTag: TagFlatItem = {
    ...tag,
    ancestorIds: [],
    pathLabel: tag.name
  };

  return (
    <div className="space-y-2">
      <div
        className={`flex items-start justify-between gap-3 rounded-[18px] border px-4 py-3 transition ${
          selectedTagId === tag.id
            ? "border-[rgba(37,99,235,0.22)] bg-[rgba(239,246,255,0.95)]"
            : "border-[rgba(226,232,240,0.92)] bg-white/78"
        }`}
        style={{ marginLeft: `${depth * 18}px` }}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {tag.children.length > 0 ? (
            <button
              className="mt-0.5 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[rgba(226,232,240,0.95)] bg-white text-[var(--muted)]"
              onClick={() => onToggleExpanded(tag.id)}
              type="button"
            >
              <ChevronIcon expanded={isExpanded} />
            </button>
          ) : (
            <div className="mt-0.5 h-7 w-7 shrink-0" />
          )}
          <button
            className="min-w-0 flex-1 cursor-pointer text-left"
            onClick={() => {
              onSelect(tag.id);
              onEdit(flatTag);
            }}
            type="button"
          >
            <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-[var(--text)]">
              <span className="truncate">{tag.name}</span>
              {tag.description?.trim() ? (
                <span
                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[rgba(34,197,94,0.12)] text-[rgba(21,128,61,0.95)]"
                  title="Description available"
                >
                  <DescriptionIcon />
                </span>
              ) : null}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">{tag.assignmentCount} assignments</p>
          </button>
        </div>

        {isEditMode ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[rgba(226,232,240,0.95)] bg-white text-[var(--muted)]"
              onClick={() => onReorder(tag.id, "move_up")}
              type="button"
            >
              <ArrowUpIcon />
            </button>
            <button
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[rgba(226,232,240,0.95)] bg-white text-[var(--muted)]"
              onClick={() => onReorder(tag.id, "move_down")}
              type="button"
            >
              <ArrowDownIcon />
            </button>
            <button
              className="cursor-pointer rounded-full border border-[rgba(226,232,240,0.95)] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]"
              onClick={() => onEdit(flatTag)}
              type="button"
            >
              Edit
            </button>
            <button
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]"
              onClick={() => onCreateChild(tag.id)}
              type="button"
            >
              <PlusIcon />
            </button>
            <button
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[rgba(254,226,226,0.9)] text-[rgb(185,28,28)]"
              onClick={() => onDelete(tag.id)}
              type="button"
            >
              <MinusIcon />
            </button>
          </div>
        ) : null}
      </div>

      {isExpanded
        ? tag.children.map((child) => (
            <TagTreeRow
              key={child.id}
              depth={depth + 1}
              expandedIds={expandedIds}
              isEditMode={isEditMode}
              onCreateChild={onCreateChild}
              onDelete={onDelete}
              onEdit={onEdit}
              onReorder={onReorder}
              onSelect={onSelect}
              onToggleExpanded={onToggleExpanded}
              selectedTagId={selectedTagId}
              tag={child}
            />
          ))
        : null}
    </div>
  );
}

function TagEditorDialog({
  availableParents,
  editor,
  isSaving,
  onCancel,
  onChange,
  onSave
}: {
  availableParents: TagFlatItem[];
  editor: TagEditorState;
  isSaving: boolean;
  onCancel: () => void;
  onChange: (next: TagEditorState) => void;
  onSave: () => void;
}) {
  const editTagId = editor.mode === "edit" ? editor.tagId ?? null : null;
  const availableOptions =
    editTagId
      ? availableParents.filter((tag) => tag.id !== editTagId && !tag.ancestorIds.includes(editTagId))
      : availableParents;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(15,23,42,0.28)] px-4">
      <div className="w-full max-w-md rounded-[28px] border border-white/80 bg-white p-5 shadow-[0_28px_60px_rgba(15,23,42,0.18)] md:max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          {editor.mode === "create" ? "Create Tag" : "Edit Tag"}
        </p>
        <div className="mt-4 grid gap-3">
          <input
            autoFocus
            className="rounded-2xl border border-[rgba(226,232,240,0.95)] bg-white px-4 py-3 text-sm text-[var(--text)] outline-none"
            onChange={(event) => onChange({ ...editor, name: event.target.value })}
            placeholder="Tag name"
            value={editor.name}
          />
          <textarea
            className="min-h-[110px] rounded-2xl border border-[rgba(226,232,240,0.95)] bg-white px-4 py-3 text-sm text-[var(--text)] outline-none md:min-h-[220px]"
            onChange={(event) => onChange({ ...editor, description: event.target.value })}
            placeholder="Description"
            value={editor.description}
          />
          <select
            className="rounded-2xl border border-[rgba(226,232,240,0.95)] bg-white px-4 py-3 text-sm text-[var(--text)] outline-none"
            onChange={(event) => onChange({ ...editor, parentId: event.target.value })}
            value={editor.parentId}
          >
            <option value="root">No parent</option>
            {availableOptions.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.pathLabel}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="cursor-pointer rounded-2xl border border-[rgba(226,232,240,0.95)] bg-white px-4 py-3 text-sm font-semibold text-[var(--muted)]"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="cursor-pointer rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            disabled={isSaving || !editor.name.trim()}
            onClick={onSave}
            type="button"
          >
            {editor.mode === "create" ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function flattenTags(items: TagItem[], ancestors: string[] = [], labels: string[] = []): TagFlatItem[] {
  return items.flatMap((item) => {
    const current = {
      ...item,
      ancestorIds: ancestors,
      pathLabel: [...labels, item.name].join(" / ")
    };

    return [current, ...flattenTags(item.children, [...ancestors, item.id], [...labels, item.name])];
  });
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16">
      <path
        d={expanded ? "m4.5 9.5 3.5-3.5 3.5 3.5" : "m6.5 4.5 3.5 3.5-3.5 3.5"}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16">
      <path d="M3.5 8h9" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  );
}

function DescriptionIcon() {
  return (
    <svg aria-hidden="true" className="h-3 w-3" fill="none" viewBox="0 0 16 16">
      <path d="M4.75 4.5h6.5M4.75 8h6.5M4.75 11.5h3.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16">
      <path d="M8 12V4M8 4 5.5 6.5M8 4l2.5 2.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16">
      <path d="M8 4v8M8 12l-2.5-2.5M8 12l2.5-2.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  );
}
