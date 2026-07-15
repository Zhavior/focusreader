"use client";

import { UserButton } from "@clerk/nextjs";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Loader2, Volume2, FastForward, Activity, Upload, Download, Chrome, BookOpen, Sparkles, Sliders } from "lucide-react";
import TrackLibrary from "@/components/TrackLibrary";
import KaraokePlayer from "@/components/KaraokePlayer";
import { estimateLabel } from "@/lib/duration";

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [text, setText] = useState("");
  const [speed, setSpeed] = useState([1.5]);
  const [background, setBackground] = useState<"silence" | "brown_noise" | "binaural">("brown_noise");

  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [libraryVersion, setLibraryVersion] = useState(0);
  const [credits, setCredits] = useState<number | null>(null);
  const [plan, setPlan] = useState<"free" | "premium">("free");

  const refreshCredits = async () => {
    try {
      const res = await fetch("/api/credits");
      if (!res.ok) return;
      const data = await res.json();
      setCredits(data.credits);
      setPlan(data.plan);
    } catch {
      // Balance display is best-effort; the server still enforces the gate.
    }
  };

  useEffect(() => {
    refreshCredits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryVersion]);

  useEffect(() => {
    const importId = searchParams?.get("import");
    if (importId) {
      setIsGenerating(true); // show some loading state
      fetch(`/api/extension-import/${importId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.text) {
            setText(data.text);
            // Clean up URL
            router.replace("/dashboard");
          }
        })
        .finally(() => setIsGenerating(false));
    }
  }, [searchParams, router]);

  const charCount = text.length;
  const overBudget = credits !== null && charCount > credits;

  // Checkpoints: spoken "section 2 of 5" markers every ~5 minutes. On by
  // default for anything long enough to have sections.
  const [checkpoints, setCheckpoints] = useState(true);
  const checkpointsApply = charCount > 4750;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setIsUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/extract", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not read that file.");
      setText(data.text);
      if (data.truncated) {
        setError("Document was long — trimmed to the first 200,000 characters.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  // Texts longer than this go through the async job queue instead of one
  // long-lived streaming request that a network blip would destroy.
  const ASYNC_THRESHOLD = 20000;

  const handleGenerate = async () => {
    if (!text.trim()) return;

    setIsGenerating(true);
    setError(null);
    setAudioUrl(null);

    try {
      if (text.length > ASYNC_THRESHOLD) {
        await generateViaJobQueue();
      } else {
        await generateStreaming();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate audio");
    } finally {
      setIsGenerating(false);
    }
  };

  const generateStreaming = async () => {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, speed: speed[0], background, checkpoints }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Failed to generate audio");
    }

    const blob = await res.blob();
    setAudioUrl(URL.createObjectURL(blob));
    setLibraryVersion((v) => v + 1);
  };

  const generateViaJobQueue = async () => {
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, speed: speed[0], background, checkpoints }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Failed to queue the job");

    setLibraryVersion((v) => v + 1); // show the processing track immediately

    // Poll until the worker finishes (long docs can take minutes).
    while (true) {
      await new Promise((r) => setTimeout(r, 3000));
      const poll = await fetch(`/api/jobs/${data.jobId}`);
      const status = await poll.json().catch(() => ({}));
      if (!poll.ok) throw new Error(status.message || "Lost track of the job");
      if (status.status === "done") {
        setLibraryVersion((v) => v + 1);
        const audio = await fetch(`/api/tracks/${data.trackId}/audio`);
        if (audio.ok) setAudioUrl(URL.createObjectURL(await audio.blob()));
        return;
      }
      if (status.status === "failed") {
        setLibraryVersion((v) => v + 1);
        throw new Error(status.error || "Generation failed — credits refunded.");
      }
    }
  };

  return (
    <main className="relative min-h-screen bg-[#0b0d10] py-12 px-4 sm:px-6 overflow-hidden">
      {/* Fractal Noise Overlays for Sandblasted Titanium Texture */}
      <div className="pointer-events-none fixed inset-0 z-50 opacity-[0.03] mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />

      <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000 ease-out relative z-10">
        
        {/* Apple-grade tactile header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-300 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" /> Studio Dashboard
            </div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight leading-none">Focus Studio</h1>
            <p className="text-neutral-400 text-sm">Paste text or upload a document, tune the dopamine, and hit play.</p>
            {credits !== null && (
              <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 mt-1">
                <span className={overBudget ? "text-red-400" : "text-neutral-400"}>
                  {charCount.toLocaleString()} characters
                </span>
                {charCount > 0 && (
                  <span className="text-amber-400/80">
                    {" • "}
                    {estimateLabel(charCount, speed[0])} at {speed[0].toFixed(1)}x
                  </span>
                )}
                <span>•</span>
                <a href="/dashboard/billing" className="hover:text-white transition-colors underline decoration-white/20 underline-offset-2">
                  {credits.toLocaleString()} credits left
                  {plan === "free" && " (upgrade to Pro)"}
                </a>
              </div>
            )}
          </div>
          
          <label className="flex shrink-0 items-center justify-center gap-2.5 rounded-full bg-[#161a1f] hover:bg-neutral-800 border border-white/10 px-6 py-3.5 text-sm font-bold text-white cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-lg">
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
            ) : (
              <Upload className="h-4 w-4 text-neutral-400" />
            )}
            {isUploading ? "Uploading..." : "Upload Document"}
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md"
              className="hidden"
              onChange={handleUpload}
              disabled={isUploading}
            />
          </label>
        </header>

        {/* Feature Cards Grid (Studio & Extension) */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Zhavior Document Studio Card */}
          <div 
            onClick={() => router.push('/dashboard/reader')}
            className="group relative flex flex-col justify-between bg-gradient-to-br from-[#161a1f] to-[#0f1115] border border-white/5 rounded-2xl p-6 gap-6 cursor-pointer hover:border-violet-500/40 hover:shadow-[0_0_30px_rgba(139,92,246,0.1)] transition-all duration-300 transform hover:-translate-y-1"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shadow-md">
                <BookOpen className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white tracking-tight group-hover:text-violet-300 transition-colors">Launch Document Studio</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/40 uppercase">PRO</span>
                </div>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  Advanced PDF & DOCX Bionic reader. Uses stereo spatial soundscapes, real-time karaoke synchronization, and hands-free layout modes.
                </p>
              </div>
            </div>
            <div className="inline-flex items-center text-sm font-bold text-violet-400 group-hover:text-violet-300 transition-colors pt-2">
              Launch Studio →
            </div>
          </div>

          {/* Chrome Extension Card */}
          <div 
            onClick={() => router.push('/dashboard/tools')}
            className="group relative flex flex-col justify-between bg-gradient-to-br from-[#161a1f] to-[#0f1115] border border-white/5 rounded-2xl p-6 gap-6 cursor-pointer hover:border-blue-500/40 hover:shadow-[0_0_30px_rgba(59,130,246,0.1)] transition-all duration-300 transform hover:-translate-y-1"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-md">
                <Chrome className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white tracking-tight group-hover:text-blue-300 transition-colors">Chrome Extension</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/40 uppercase">AUTO-LOGIN</span>
                </div>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  Bring dopamine Bionic Reading and voice-controlled web page navigation directly to any website you read.
                </p>
              </div>
            </div>
            <div className="inline-flex items-center text-sm font-bold text-blue-400 group-hover:text-blue-300 transition-colors pt-2">
              Configure Extension →
            </div>
          </div>
        </div>

        {/* Main Editor & Settings */}
        <div className="space-y-8">
          
          {/* Text Editor Glass Card */}
          <div className="relative group">
            <div className="absolute -inset-px bg-gradient-to-r from-neutral-800 to-neutral-700 rounded-3xl blur-sm opacity-20 group-focus-within:opacity-40 transition duration-300"></div>
            <div className="relative bg-[#161a1f]/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#121518]/50">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Content Input</span>
                <span className="text-xs font-mono text-neutral-500">{charCount.toLocaleString()} characters</span>
              </div>
              <Textarea 
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your textbook, article, or PDF text here to begin..." 
                className="w-full min-h-[340px] resize-none bg-transparent border-0 text-neutral-200 text-lg leading-relaxed p-6 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none transition-all placeholder:text-neutral-600"
              />
            </div>
          </div>

          {/* Settings Panels Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            
            {/* Speed Panel */}
            <div className="bg-[#161a1f]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-2xl flex flex-col justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-neutral-300 font-bold">
                  <FastForward className="w-4 h-4 text-neutral-400" />
                  <span>Playback Speed</span>
                </div>
                <p className="text-xs text-neutral-500">Tune the voice rate to match your focus level.</p>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-400 font-semibold">Speed Offset</span>
                  <span className="text-sm font-bold font-mono text-amber-400">{speed[0].toFixed(1)}x</span>
                </div>
                <Slider
                  value={speed}
                  onValueChange={(value) =>
                    setSpeed(Array.isArray(value) ? [...value] : [value])
                  }
                  min={1.0}
                  max={3.0} 
                  step={0.1}
                  className="py-2"
                />
              </div>
            </div>

            {/* Background Soundscape Panel */}
            <div className="bg-[#161a1f]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-2xl flex flex-col justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-neutral-300 font-bold">
                  <Activity className="w-4 h-4 text-neutral-400" />
                  <span>Background Soundscape</span>
                </div>
                <p className="text-xs text-neutral-500">Stereo frequencies designed to mute cognitive noise.</p>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2">
                {(["silence", "brown_noise", "binaural"] as const).map((bg) => (
                  <button
                    key={bg}
                    onClick={() => setBackground(bg)}
                    className={`px-3 py-3.5 text-xs font-bold rounded-xl border transition-all ${
                      background === bg 
                        ? "bg-white text-black border-white shadow-md scale-[1.02]" 
                        : "bg-transparent border-white/10 text-neutral-400 hover:text-white hover:border-white/20"
                    }`}
                  >
                    {bg === "silence" ? "Silence" : bg === "brown_noise" ? "Brown Noise" : "Binaural"}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Checkpoints Option */}
          <div className="bg-[#161a1f]/30 border border-white/5 rounded-xl p-4 flex items-center justify-between">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={checkpoints}
                onChange={(e) => setCheckpoints(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-transparent accent-white"
              />
              <span className="text-sm text-neutral-400 font-medium">
                Include spoken section checkpoints every ~5 minutes
                {checkpointsApply ? "" : " (triggers automatically for long content)"}
              </span>
            </label>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Action Button & Player */}
          <div className="flex flex-col items-center space-y-6 pt-4">
            {audioUrl ? (
              <div className="w-full bg-[#161a1f] p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-neutral-300">
                    <Volume2 className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-bold">Synchronized Reader Player</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={audioUrl} download="FocusTrack.mp3" className="text-xs font-bold text-neutral-400 hover:text-white transition-colors inline-flex items-center gap-1">
                      <Download className="w-3.5 h-3.5" /> Download MP3
                    </a>
                    <span className="text-neutral-600">•</span>
                    <button onClick={() => setAudioUrl(null)} className="text-xs font-bold text-neutral-500 hover:text-red-400 transition-colors">
                      Discard
                    </button>
                  </div>
                </div>
                <KaraokePlayer src={audioUrl} text={text} autoPlay />
              </div>
            ) : (
              <Button 
                onClick={handleGenerate}
                disabled={isGenerating || !text.trim() || overBudget}
                className="w-full max-w-lg h-16 text-lg font-bold bg-white hover:bg-neutral-200 text-black rounded-full transition-all duration-300 shadow-[0_10px_35px_rgba(255,255,255,0.1)] active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-3 h-5 w-5 animate-spin text-black" />
                    Generating Speech Track...
                  </>
                ) : (
                  <>
                    <Play className="mr-3 h-5 w-5 fill-current text-black" />
                    Generate Audio
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Track Library */}
          <section className="pt-10 border-t border-white/5">
            <div className="flex items-center gap-2 mb-6">
              <Sliders className="w-5 h-5 text-neutral-400" />
              <h2 className="text-xl font-bold text-white tracking-tight">Your Generated Library</h2>
            </div>
            <TrackLibrary refreshSignal={libraryVersion} />
          </section>

        </div>
      </div>
    </main>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0b0d10] flex items-center justify-center text-white"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
      <DashboardContent />
    </Suspense>
  );
}
