"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { AudioLines, Download, Loader2, Mic, TriangleAlert, Upload, Chrome } from "lucide-react";
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

  const searchParams = useSearchParams();
  const urlParam = searchParams.get('url');

  useEffect(() => {
    if (urlParam && !text && !isParsing) {
      handleUrlParse(urlParam);
    }
  }, [urlParam]);

  const handleUrlParse = async (url: string) => {
    setIsParsing(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error("Failed to parse PDF from URL");
      const data = await res.json();
      setText(data.text.slice(0, MAX_CHARS));
    } catch (err: any) {
      setErrorMessage(err.message || "Error reading remote PDF");
      setStatus("error");
    } finally {
      setIsParsing(false);
    }
  };

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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-20 relative z-10">
      <header className="flex flex-col items-center justify-center gap-4 text-center">
        <div className="flex items-center justify-center p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
          <Mic className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-[linear-gradient(to_bottom,theme(colors.white),theme(colors.neutral.400))] drop-shadow-sm">
            Focus Studio
          </h1>
          <p className="mt-4 text-lg text-neutral-400 font-medium max-w-xl mx-auto leading-relaxed">
            Paste any text, upload a document, or send a PDF link from the extension.
          </p>
        </div>
      </header>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-3xl border border-white/5 bg-white/[0.02] p-5 shadow-2xl backdrop-blur-xl relative overflow-hidden group hover:bg-white/[0.04] transition-all duration-500">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        <div className="flex items-center gap-5 relative z-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0b0d10] border border-white/5 text-white shadow-inner shrink-0 group-hover:border-indigo-500/50 group-hover:text-indigo-400 transition-colors">
            <Chrome className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Chrome Extension MVP</h2>
            <p className="text-sm text-neutral-400 mt-1 leading-relaxed max-w-sm">
              Read any webpage with Bionic Font, Hyperfocus Vault, and ad-skipping. 
            </p>
          </div>
        </div>
        <a 
          href="/focusreader-extension.zip" 
          download="focusreader-extension.zip"
          className="flex shrink-0 items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-bold text-[#0b0d10] shadow-[0_0_20px_rgba(255,255,255,0.2)] transition hover:bg-neutral-200 hover:scale-[1.02] active:scale-95 relative z-10"
        >
          <Download className="h-4 w-4" />
          Install .zip
        </a>
      </div>

      <div className="rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent p-6 md:p-10 shadow-2xl backdrop-blur-3xl relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-indigo-500/20 blur-[100px] rounded-full"></div>
        
        <div className="relative z-10">
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
            className={`w-full resize-none rounded-2xl border border-white/10 bg-[#050608]/50 p-6 text-base leading-relaxed text-neutral-100 placeholder:text-neutral-600 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 shadow-inner ${isParsing ? "opacity-50" : ""} transition-colors duration-300`}
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

          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-neutral-300 transition hover:border-indigo-500/50 hover:bg-indigo-500/10 hover:text-indigo-300 shadow-sm">
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
            className="flex items-center gap-2 rounded-2xl bg-white px-8 py-3 text-base font-bold text-[#0b0d10] transition hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)] disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500 disabled:shadow-none disabled:transform-none"
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
