"use client";

import { useEffect, useId, useRef, useState } from "react";

function isPdfFile(file) {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileUploader({
  onFilesSelected,
  multiple = true,
  disabled = false,
  resetKey = 0,
}) {
  const inputId = useId();
  const labelId = `${inputId}-label`;
  const inputRef = useRef(null);
  const dragDepthRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    setFiles([]);
    setError("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [resetKey]);

  function applyFiles(fileList) {
    const incoming = Array.from(fileList ?? []);
    const pdfs = incoming.filter(isPdfFile);

    if (incoming.length === 0) {
      return;
    }

    if (pdfs.length === 0) {
      setError("Please upload regulatory PDFs only.");
      return;
    }

    setError(
      pdfs.length < incoming.length
        ? "Some files were skipped because they are not PDFs."
        : "",
    );

    const next = multiple ? [...files, ...pdfs] : pdfs.slice(0, 1);
    const unique = [];
    const seen = new Set();

    for (const file of next) {
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(file);
      }
    }

    setFiles(unique);
    onFilesSelected?.(unique);
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDragEnter(event) {
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDragging(true);
  }

  function handleDragLeave(event) {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragging(false);
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDragging(false);
    if (disabled) {
      return;
    }
    applyFiles(event.dataTransfer.files);
  }

  function handleInputChange(event) {
    applyFiles(event.target.files);
    event.target.value = "";
  }

  function openFileSelector() {
    if (disabled) {
      return;
    }
    inputRef.current?.click();
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openFileSelector();
    }
  }

  function removeFile(index) {
    const next = files.filter((_, fileIndex) => fileIndex !== index);
    setFiles(next);
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-labelledby={labelId}
        onClick={openFileSelector}
        onKeyDown={handleKeyDown}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
          disabled
            ? "cursor-not-allowed opacity-60"
            : "cursor-pointer"
        } ${
          isDragging && !disabled
            ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-900"
            : "border-zinc-300 bg-zinc-50 hover:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-zinc-400"
        }`}
      >
        <p
          id={labelId}
          className="text-base font-medium text-zinc-900 dark:text-zinc-50"
        >
          Drop regulatory PDFs here
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          or click to choose files from your computer
        </p>
        <span className="mt-4 rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-800 dark:border-zinc-600 dark:text-zinc-200">
          Select PDFs
        </span>
      </div>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple={multiple}
        disabled={disabled}
        tabIndex={-1}
        className="sr-only"
        aria-label="Upload regulatory PDFs"
        onChange={handleInputChange}
      />

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {files.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.lastModified}-${index}`}
              className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="min-w-0 text-left">
                <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                  {file.name}
                </p>
                <p className="text-zinc-500 dark:text-zinc-400">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeFile(index)}
                disabled={disabled}
                className="ml-4 shrink-0 text-zinc-500 transition-colors hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:text-zinc-100"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
