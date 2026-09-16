"use client";

import { useCallback, useEffect, useState } from "react";
import ExtractionTable from "@/components/ExtractionTable";
import FileUploader from "@/components/FileUploader";
import { supabase } from "@/utils/supabase";

const PERMIT_TABLE = "permit summaries";

type ExtractionRow = {
  file_name?: string;
  fileName?: string;
  created_at?: string;
  createdAt?: string;
  extracted_data?: unknown;
  extractedData?: unknown;
  [key: string]: unknown;
};

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [extractions, setExtractions] = useState<ExtractionRow[]>([]);
  const [uploaderResetKey, setUploaderResetKey] = useState(0);

  const latestExtractions = extractions.slice(0, 1);
  const hasExtractions = latestExtractions.length > 0;

  const loadExtractions = useCallback(async () => {
    let { data, error } = await supabase
      .from(PERMIT_TABLE)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      ({ data, error } = await supabase.from(PERMIT_TABLE).select("*"));
      if (!error && data?.length) {
        data = [...data]
          .sort((a, b) => {
            const aTime = new Date(a.created_at ?? a.createdAt ?? 0).getTime();
            const bTime = new Date(b.created_at ?? b.createdAt ?? 0).getTime();
            return bTime - aTime;
          })
          .slice(0, 1);
      }
    }

    if (error) {
      console.error(error);
      return;
    }

    setExtractions(data ?? []);
  }, []);

  useEffect(() => {
    loadExtractions();
  }, [loadExtractions]);

  async function handleFilesSelected(files: File[]) {
    if (files.length === 0) {
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }

      const response = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to extract and analyze the PDF.");
      }

      await loadExtractions();
      setUploaderResetKey((key) => key + 1);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  function clearHistory() {
    setExtractions([]);
  }

  function exportData() {
    if (!hasExtractions) {
      return;
    }

    const payload = latestExtractions.map((row) => ({
      file_name: row.file_name ?? row.fileName ?? null,
      created_at: row.created_at ?? row.createdAt ?? null,
      extracted_data: row.extracted_data ?? row.extractedData ?? row,
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    link.href = url;
    link.download = `permit-extraction-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main
        className="flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-8 py-16 sm:items-start"
        aria-busy={loading}
      >
        <div className="w-full text-center sm:text-left">
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Permit & Regulatory PDF Analyzer
          </h1>
          <p className="mt-2 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Upload regulatory PDFs by dragging them into the drop zone or
            clicking to open the file selector.
          </p>
        </div>
        <FileUploader
          onFilesSelected={handleFilesSelected}
          disabled={loading}
          resetKey={uploaderResetKey}
        />
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={clearHistory}
            disabled={!hasExtractions || loading}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-500 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200 dark:hover:border-zinc-400 dark:hover:bg-zinc-900"
          >
            Clear history
          </button>
          <button
            type="button"
            onClick={exportData}
            disabled={!hasExtractions || loading}
            className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Export data
          </button>
        </div>
        <div className="relative w-full">
          {loading ? (
            <div
              className="absolute inset-0 z-10 flex min-h-[220px] items-center justify-center rounded-3xl bg-zinc-50/50 backdrop-blur-md dark:bg-black/45"
              role="status"
              aria-live="polite"
            >
              <div className="flex flex-col items-center gap-4 rounded-3xl border border-zinc-200/70 bg-white/80 px-10 py-8 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/75">
                <span className="relative h-12 w-12" aria-hidden="true">
                  <span className="absolute inset-0 rounded-full border-[3px] border-zinc-200 dark:border-zinc-700" />
                  <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-zinc-900 dark:border-t-zinc-50" />
                </span>
                <div className="text-center">
                  <p className="text-sm font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
                    Analyzing PDF
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Extracting text and analyzing with Claude...
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          <div
            className={`w-full max-h-[600px] overflow-y-auto overscroll-contain pr-1 ${
              loading ? "min-h-[220px] pointer-events-none" : ""
            }`}
          >
            <ExtractionTable data={latestExtractions} />
          </div>
        </div>
      </main>
    </div>
  );
}
