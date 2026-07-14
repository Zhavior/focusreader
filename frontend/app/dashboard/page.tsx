"use client";

import { UserButton } from "@clerk/nextjs";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Loader2, Volume2, FastForward, Activity, Upload, Download, Chrome } from "lucide-react";
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
    <main className="relative min-h-screen bg-[#0b0d10] py-12 px-4 sm:px-6">

      <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 ease-out">
            
            {/* Header */}
            <header className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold text-neutral-100 tracking-tight">Focus Studio</h1>
                <p className="text-neutral-500">Paste text or upload a document, tune the dopamine, and hit play.</p>
                {credits !== null && (
                  <p className="text-xs text-neutral-600">
                    <span className={overBudget ? "text-red-400" : "text-neutral-400"}>
                      {charCount.toLocaleString()} chars
                    </span>
                    {charCount > 0 && (
                      <span className="text-indigo-400/80">
                        {" · ≈ "}
                        {estimateLabel(charCount, speed[0])} at {speed[0].toFixed(1)}x
                      </span>
                    )}
                    {" · "}
                    <a href="/dashboard/billing" className="hover:text-indigo-300 transition-colors">
                      {credits.toLocaleString()} credits left
                      {plan === "free" && " — upgrade for 100k/mo"}
                    </a>
                  </p>
                )}
              </div>
              <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-neutral-300 transition hover:border-indigo-500/50 hover:text-indigo-300">
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {isUploading ? "Reading..." : "Upload PDF / DOCX"}
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  className="hidden"
                  onChange={handleUpload}
                  disabled={isUploading}
                />
              </label>
            </header>

            {/* Chrome Extension Banner */}
            <div className="relative group cursor-pointer" onClick={() => window.location.href = '/dashboard/tools'}>
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
              <div className="relative flex flex-col sm:flex-row items-center justify-between bg-[#131619]/90 backdrop-blur-sm border border-white/10 rounded-xl p-6 gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex shrink-0 items-center justify-center w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                    <Chrome className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">Get the Zhavior Chrome Extension</h3>
                    <p className="text-sm text-neutral-400 mt-1 max-w-lg">
                      <strong className="text-indigo-300">Voice-Controlled AI Brain</strong> • Hands-Free Scrolling • Universal Media Sync • ADHD Bionic Text • Instantly push Voice Notes to your Dashboard.
                    </p>
                  </div>
                </div>
                <Button className="shrink-0 w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white rounded-full px-6 font-semibold shadow-[0_0_20px_-5px_rgba(59,130,246,0.5)] border border-blue-400/20">
                  <Download className="w-4 h-4 mr-2" />
                  Learn More
                </Button>
              </div>
            </div>

            {/* Main Editor */}
            <div className="space-y-6">
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-xl blur opacity-30 group-focus-within:opacity-100 transition duration-500"></div>
                <Textarea 
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste your boring textbook or PDF text here..." 
                  className="relative w-full min-h-[300px] resize-none bg-[#131619]/80 backdrop-blur-sm border-white/10 text-neutral-200 text-lg leading-relaxed p-6 rounded-xl focus-visible:ring-1 focus-visible:ring-indigo-500 transition-all"
                />
              </div>

              {/* Dopamine Control Bar */}
              <Card className="bg-[#131619] border-white/10">
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Speed Control */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-neutral-400">
                        <FastForward className="w-4 h-4" />
                        <span className="text-sm font-medium">Speed</span>
                      </div>
                      <span className="text-sm font-mono text-indigo-400">{speed[0].toFixed(1)}x</span>
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

                  {/* Background Control */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 text-neutral-400">
                      <Activity className="w-4 h-4" />
                      <span className="text-sm font-medium">Background Layer</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(["silence", "brown_noise", "binaural"] as const).map((bg) => (
                        <button
                          key={bg}
                          onClick={() => setBackground(bg)}
                          className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                            background === bg 
                              ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300" 
                              : "bg-transparent border-white/10 text-neutral-500 hover:text-neutral-300 hover:border-white/20"
                          }`}
                        >
                          {bg === "silence" ? "Silence" : bg === "brown_noise" ? "Brown Noise" : "Binaural"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Checkpoints */}
                  <label className="md:col-span-2 flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={checkpoints}
                      onChange={(e) => setCheckpoints(e.target.checked)}
                      className="h-4 w-4 rounded border-white/20 bg-transparent accent-indigo-500"
                    />
                    <span className="text-sm text-neutral-400">
                      Checkpoints — spoken section markers every ~5 minutes
                      {checkpointsApply ? "" : " (kicks in for longer texts)"}
                    </span>
                  </label>
                </CardContent>
              </Card>

              {/* Error Message */}
              {error && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Action Button & Player */}
              <div className="flex flex-col items-center space-y-6 pt-4">
                {audioUrl ? (
                  <div className="w-full bg-[#131619] p-4 rounded-2xl border border-white/10 shadow-2xl space-y-3">
                    <div className="flex items-center gap-2 text-indigo-400">
                      <Volume2 className="w-4 h-4" />
                      <span className="text-sm font-medium text-neutral-300">Read along</span>
                    </div>
                    <KaraokePlayer src={audioUrl} text={text} autoPlay />
                  </div>
                ) : (
                  <Button 
                    onClick={handleGenerate}
                    disabled={isGenerating || !text.trim() || overBudget}
                    className="w-full max-w-md h-16 text-lg font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-all duration-300 shadow-[0_0_40px_-10px_rgba(99,102,241,0.4)] hover:shadow-[0_0_60px_-15px_rgba(99,102,241,0.6)] disabled:opacity-50 disabled:shadow-none"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                        Generating Focus Track...
                      </>
                    ) : (
                      <>
                        <Play className="mr-3 h-6 w-6 fill-current" />
                        Generate Audio
                      </>
                    )}
                  </Button>
                )}
                
                {audioUrl && (
                  <div className="flex items-center gap-4">
                    <a href={audioUrl} download="FocusMode.mp3">
                      <Button 
                        variant="outline" 
                        className="border-indigo-500/50 text-indigo-300 hover:bg-indigo-500/10 hover:text-indigo-200 transition-colors"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download Audio
                      </Button>
                    </a>
                    <Button 
                      variant="ghost" 
                      onClick={() => {
                        setAudioUrl(null);
                      }}
                      className="text-neutral-500 hover:text-neutral-300"
                    >
                      Generate Another
                    </Button>
                  </div>
                )}
              </div>

              {/* Track Library */}
              <section className="pt-8">
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
