"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

const OMNIFOCUS_DEFAULT_TAG = "echotrace";

type MarkdownResponseProps = {
  compact?: boolean;
  content: string;
};

type MarkdownBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; text: string };

export function MarkdownResponse({ compact = false, content }: MarkdownResponseProps) {
  const blocks = useMemo(() => parseMarkdownBlocks(content), [content]);
  const todoEntries = useMemo(
    () =>
      blocks.flatMap((block, blockIndex) =>
        block.type === "list"
          ? block.items.flatMap((item, itemIndex) => {
              const todo = parseTodoItem(item);
              return todo ? [{ ...todo, key: `${blockIndex}-${itemIndex}` }] : [];
            })
          : []
      ),
    [blocks]
  );
  const [selectedTodoKeys, setSelectedTodoKeys] = useState<Set<string>>(() => new Set());
  const selectedTodos = todoEntries.filter((todo) => selectedTodoKeys.has(todo.key));

  useEffect(() => {
    setSelectedTodoKeys(new Set());
  }, [content]);

  function toggleTodo(key: string) {
    setSelectedTodoKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function toggleAllTodos() {
    setSelectedTodoKeys((current) =>
      current.size === todoEntries.length ? new Set() : new Set(todoEntries.map((todo) => todo.key))
    );
  }

  return (
    <div className={compact ? "space-y-2 text-xs leading-5 text-[var(--text)]" : "space-y-4 text-sm leading-7 text-[var(--text)]"}>
      {todoEntries.length > 0 ? (
        <div
          className={`sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border border-blue-200/80 bg-blue-50/95 shadow-[0_8px_24px_rgba(59,130,246,0.12)] backdrop-blur-md ${
            compact ? "rounded-xl px-3 py-2" : "rounded-2xl px-4 py-3"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="cursor-pointer rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-blue-700 transition hover:bg-blue-100"
              onClick={toggleAllTodos}
              type="button"
            >
              {selectedTodoKeys.size === todoEntries.length ? "Clear selection" : "Select all"}
            </button>
            <span className="text-[10px] font-semibold text-blue-800">
              {selectedTodos.length} of {todoEntries.length} selected
            </span>
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-semibold text-blue-600">
              Tag: {OMNIFOCUS_DEFAULT_TAG}
            </span>
          </div>
          <a
            aria-disabled={selectedTodos.length === 0}
            className={`rounded-full px-3 py-2 text-[10px] font-semibold leading-none transition ${
              selectedTodos.length > 0
                ? "bg-blue-600 !text-white hover:bg-blue-500"
                : "pointer-events-none bg-blue-200 text-blue-500"
            }`}
            href={selectedTodos.length > 0 ? createOmniFocusPasteUrl(selectedTodos) : undefined}
            style={selectedTodos.length > 0 ? { color: "#ffffff" } : undefined}
          >
            Add {selectedTodos.length || "selected"} to OmniFocus
          </a>
        </div>
      ) : null}
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const className =
            block.level === 1
              ? compact
                ? "text-lg font-semibold tracking-[-0.03em]"
                : "text-2xl font-semibold tracking-[-0.04em]"
              : block.level === 2
                ? compact
                  ? "text-base font-semibold tracking-[-0.025em]"
                  : "text-xl font-semibold tracking-[-0.035em]"
                : compact
                  ? "text-sm font-semibold tracking-[-0.02em]"
                  : "text-base font-semibold tracking-[-0.02em]";
          const HeadingTag = `h${block.level}` as const;

          return (
            <HeadingTag key={index} className={className}>
              {renderInlineMarkdown(block.text)}
            </HeadingTag>
          );
        }

        if (block.type === "list") {
          const todoItems = block.items.map(parseTodoItem);
          if (todoItems.some(Boolean)) {
            return (
              <div key={index} className={compact ? "space-y-1.5" : "space-y-2.5"}>
                {block.items.map((item, itemIndex) => {
                  const todo = todoItems[itemIndex];
                  if (!todo) {
                    return (
                      <ul key={`${index}-${itemIndex}`} className={compact ? "list-disc pl-4" : "list-disc pl-5"}>
                        <li>{renderInlineMarkdown(item)}</li>
                      </ul>
                    );
                  }

                  const todoKey = `${index}-${itemIndex}`;
                  const isSelected = selectedTodoKeys.has(todoKey);
                  const omniFocusUrl = createOmniFocusPasteUrl([todo]);

                  return (
                    <div
                      aria-checked={isSelected}
                      key={`${index}-${itemIndex}`}
                      className={`flex cursor-pointer items-start gap-3 border transition hover:-translate-y-px ${
                        compact ? "rounded-xl px-3 py-2" : "rounded-2xl px-4 py-3"
                      } ${
                        todo.important
                          ? "border-amber-300/80 bg-amber-50 text-amber-950 shadow-[0_8px_22px_rgba(245,158,11,0.1)]"
                          : isSelected
                            ? "border-blue-300 bg-blue-50/80 shadow-[0_8px_22px_rgba(59,130,246,0.08)]"
                            : "border-[rgba(226,232,240,0.95)] bg-white/90"
                      } ${isSelected ? "ring-2 ring-blue-500/30" : ""}`}
                      onClick={() => toggleTodo(todoKey)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleTodo(todoKey);
                        }
                      }}
                      role="checkbox"
                      tabIndex={0}
                    >
                      <input
                        aria-label={`Select task: ${stripInlineMarkdown(todo.text)}`}
                        checked={isSelected}
                        className="mt-1.5 h-4 w-4 shrink-0 cursor-pointer accent-blue-600"
                        onChange={() => toggleTodo(todoKey)}
                        onClick={(event) => event.stopPropagation()}
                        type="checkbox"
                      />
                      <div className="min-w-0 flex-1">
                        {todo.important ? (
                          <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.15em] text-amber-700">
                            Important
                          </span>
                        ) : null}
                        <p className={todo.important ? "font-semibold" : ""}>{renderInlineMarkdown(todo.text)}</p>
                      </div>
                      <a
                        className={`shrink-0 rounded-full border font-semibold leading-none transition ${
                          compact ? "px-2 py-1.5 text-[9px]" : "px-3 py-2 text-[10px]"
                        } ${
                          todo.important
                            ? "border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
                            : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                        }`}
                        href={omniFocusUrl}
                        onClick={(event) => event.stopPropagation()}
                        title="Add this task to the OmniFocus inbox"
                      >
                        Add to OmniFocus
                      </a>
                    </div>
                  );
                })}
              </div>
            );
          }

          return (
            <ul key={index} className={`list-disc ${compact ? "space-y-1 pl-4" : "space-y-2 pl-5"}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`${index}-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === "code") {
          return (
            <pre
              key={index}
              className={`overflow-x-auto bg-[rgba(15,23,42,0.92)] text-white ${
                compact ? "rounded-xl p-3 text-[10px] leading-4" : "rounded-2xl p-4 text-xs leading-6"
              }`}
            >
              <code>{block.text}</code>
            </pre>
          );
        }

        return <p key={index}>{renderInlineMarkdown(block.text)}</p>;
      })}
    </div>
  );
}

function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let codeLines: string[] = [];
  let isInCodeBlock = false;

  function flushParagraph() {
    if (paragraph.length === 0) {
      return;
    }

    blocks.push({ type: "paragraph", text: paragraph.join(" ").trim() });
    paragraph = [];
  }

  function flushList() {
    if (listItems.length === 0) {
      return;
    }

    blocks.push({ type: "list", items: listItems });
    listItems = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (isInCodeBlock) {
        blocks.push({ type: "code", text: codeLines.join("\n") });
        codeLines = [];
        isInCodeBlock = false;
        continue;
      }

      flushParagraph();
      flushList();
      isInCodeBlock = true;
      continue;
    }

    if (isInCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: headingMatch[1].length as 1 | 2 | 3,
        text: headingMatch[2]
      });
      continue;
    }

    const bulletMatch = /^[-*]\s+(.+)$/.exec(trimmed);
    if (bulletMatch) {
      flushParagraph();
      listItems.push(bulletMatch[1]);
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();

  if (codeLines.length > 0) {
    blocks.push({ type: "code", text: codeLines.join("\n") });
  }

  return blocks;
}

function parseTodoItem(item: string) {
  const match = /^\[(TODO|IMPORTANT)\]\s+(.+)$/i.exec(item.trim());
  if (!match) {
    return null;
  }

  return {
    important: match[1].toUpperCase() === "IMPORTANT",
    text: match[2].trim()
  };
}

function createOmniFocusPasteUrl(todos: Array<{ important: boolean; text: string }>) {
  const dueDate = formatLocalDate(new Date());
  const taskPaper = todos
    .map((todo) => {
      const taskName = sanitizeTaskPaperText(stripInlineMarkdown(todo.text));
      const parameters = [
        `@tags(${OMNIFOCUS_DEFAULT_TAG})`,
        `@due(${dueDate})`,
        ...(todo.important ? ["@flagged"] : [])
      ];
      return `- ${taskName} ${parameters.join(" ")}`;
    })
    .join("\n");

  return `omnifocus:///paste?target=inbox&content=${encodeURIComponent(taskPaper)}`;
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sanitizeTaskPaperText(text: string) {
  return text.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

function stripInlineMarkdown(text: string) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }

    const token = match[0];
    if (token.startsWith("`")) {
      nodes.push(
        <code key={`${match.index}-code`} className="rounded-md bg-[rgba(15,23,42,0.07)] px-1.5 py-0.5 text-[0.92em]">
          {token.slice(1, -1)}
        </code>
      );
    } else {
      nodes.push(
        <strong key={`${match.index}-strong`} className="font-semibold">
          {token.slice(2, -2)}
        </strong>
      );
    }

    cursor = match.index + token.length;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}
