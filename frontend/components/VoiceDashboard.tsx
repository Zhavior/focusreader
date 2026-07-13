"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AudioLines, Download, Loader2, Mic, TriangleAlert, Upload } from "lucide-react";
import { generateVoice, VoiceGenerationError } from "@/lib/api";

const MAX_CHARS = 200000;
const CHUNK_SIZE = 5000;

type Status = "idle" | "generating" | "ready" | "error";

export default function VoiceDashboard() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [receivedKb, setReceivedKb] = useState(0);
  const [isParsing, setIsParsing] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const charCount = text.length;
  const chunkCount = useMemo(
    () => (charCount === 0 ? 0 : Math.ceil(charCount / CHUNK_SIZE)),
    [charCount]
  );
  const overLimit = charCount > MAX_CHARS;

  const resetAudio = useCallback(() => {
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!text.trim() || overLimit) return;

    resetAudio();
    setStatus("generating");
    setErrorMessage(null);
    setReceivedKb(0);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const blob = await generateVoice({
        text,
        filename: "voice-output",
        signal: controller.signal,
        onProgress: (bytes) => setReceivedKb(Math.round(bytes / 1024)),
      });

      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setStatus("ready");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setStatus("idle");
        return;
      }
      const message =
        err instanceof VoiceGenerationError
          ? err.message
          : "Something went wrong generating your audio. Please try again.";
      setErrorMessage(message);
      setStatus("error");
    }
  }, [text, overLimit, resetAudio]);

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      try {
        if (file.name.endsWith(".txt") || file.name.endsWith(".md")) {
          const content = await file.text();
          setText(content.slice(0, MAX_CHARS));
        } else {
          setIsParsing(true);
          setErrorMessage(null);
          
          const formData = new FormData();
          formData.append("file", file);
          
          const res = await fetch("/api/parse", {
            method: "POST",
            body: formData,
          });
          
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Failed to parse document");
          }
          
          const data = await res.json();
          setText(data.text.slice(0, MAX_CHARS));
        }
        
        resetAudio();
        setStatus("idle");
      } catch (err: any) {
        setErrorMessage(err.message || "Error reading file");
        setStatus("error");
      } finally {
        setIsParsing(false);
        if (e.target) e.target.value = "";
      }
    },
    [resetAudio]
  );

  const isGenerating = status === "generating";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-16">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-brand">
          <Mic className="h-5 w-5" />
          <span className="text-sm font-medium uppercase tracking-wider">
            Voice Agent
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          Turn text into hyper-realistic voice
        </h1>
        <p className="text-sm text-neutral-400">
          Paste long-form text or upload a document. We chunk, stream, and
          stitch the audio automatically.
        </p>
      </header>

      <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-xl shadow-black/20">
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setStatus("idle");
              resetAudio();
            }}
            placeholder="Paste your text here or upload a PDF/DOCX..."
            rows={12}
            disabled={isParsing}
            className={`w-full resize-none rounded-xl border border-surface-border bg-surface p-4 text-sm leading-relaxed text-neutral-100 placeholder:text-neutral-600 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand ${isParsing ? "opacity-50" : ""}`}
          />
          {isParsing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface/50 backdrop-blur-sm rounded-xl">
              <Loader2 className="h-8 w-8 animate-spin text-brand mb-2" />
              <p className="text-sm font-medium text-brand animate-pulse">Extracting text from document...</p>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
          <div className="flex items-center gap-3">
            <span className={overLimit ? "font-medium text-red-400" : ""}>
              {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters
            </span>
            {chunkCount > 0 && (
              <span className="rounded-full bg-surface px-2 py-0.5">
                {chunkCount} chunk{chunkCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-surface-border px-3 py-1.5 text-neutral-300 transition hover:border-brand hover:text-brand">
            <Upload className="h-3.5 w-3.5" />
            Upload document
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.pdf,.docx"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isParsing}
            />
          </label>
        </div>

        {overLimit && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
            <TriangleAlert className="h-3.5 w-3.5" />
            Text exceeds the {MAX_CHARS.toLocaleString()} character limit.
          </p>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={!text.trim() || overLimit || isGenerating}
            className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-surface-border disabled:text-neutral-500"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating{receivedKb > 0 ? ` — ${receivedKb} KB` : "..."}
              </>
            ) : (
              <>
                <AudioLines className="h-4 w-4" />
                Generate Voice
              </>
            )}
          </button>

          {isGenerating && (
            <button
              onClick={handleCancel}
              className="rounded-xl border border-surface-border px-4 py-2.5 text-sm text-neutral-400 transition hover:border-red-400 hover:text-red-400"
            >
              Cancel
            </button>
          )}
        </div>

        {status === "error" && errorMessage && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {status === "ready" && audioUrl && (
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-surface-border bg-surface p-4">
            <audio controls src={audioUrl} className="w-full">
              Your browser does not support the audio element.
            </audio>
            <a
              href={audioUrl}
              download="voice-output.mp3"
              className="flex w-fit items-center gap-2 rounded-lg border border-surface-border px-4 py-2 text-sm text-neutral-200 transition hover:border-brand hover:text-brand"
            >
              <Download className="h-4 w-4" />
              Download MP3
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
