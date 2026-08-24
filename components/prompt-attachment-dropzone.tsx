"use client";

import { useRef, useState } from "react";

type PromptAttachmentDropzoneProps = {
  files: File[];
  onChange: (files: File[]) => void;
};

function getFileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}-${file.type}`;
}

export function PromptAttachmentDropzone({ files, onChange }: PromptAttachmentDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepthRef = useRef(0);

  function addFiles(incomingFiles: File[]) {
    const filesByKey = new Map(files.map((file) => [getFileKey(file), file]));
    for (const file of incomingFiles) {
      filesByKey.set(getFileKey(file), file);
    }
    onChange([...filesByKey.values()]);
  }

  return (
    <div className="rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Optional files</p>
      <label
        className={`flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-5 text-center transition ${
          isDragging
            ? "border-blue-500 bg-blue-500/10 text-blue-500 ring-2 ring-blue-500/15"
            : "border-[var(--line-strong)] bg-[var(--surface-strong)] text-[var(--muted)] hover:border-blue-500/50 hover:bg-blue-500/5"
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          dragDepthRef.current += 1;
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
          if (dragDepthRef.current === 0) {
            setIsDragging(false);
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepthRef.current = 0;
          setIsDragging(false);
          addFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <input
          className="sr-only"
          multiple
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
          type="file"
        />
        <svg aria-hidden="true" className="mb-2 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
        </svg>
        <span className="text-xs font-semibold text-[var(--text)]">
          {isDragging ? "Drop files here" : "Drag files here"}
        </span>
        <span className="mt-1 text-[10px]">or click to choose files</span>
      </label>

      {files.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {files.map((file) => (
            <span
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface-strong)] py-1 pl-2.5 pr-1 text-[10px] font-semibold text-[var(--muted)]"
              key={getFileKey(file)}
            >
              <span className="max-w-56 truncate">{file.name}</span>
              <button
                aria-label={`Remove ${file.name}`}
                className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full text-xs transition hover:bg-black/10 hover:text-[var(--text)]"
                onClick={() => onChange(files.filter((candidate) => getFileKey(candidate) !== getFileKey(file)))}
                type="button"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
