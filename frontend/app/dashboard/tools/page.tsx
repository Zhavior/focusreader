"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { 
  Chrome, Brain, Zap, Headphones, Copy, Download, ArrowLeft, 
  CheckCircle2, ChevronDown, FolderOpen, ToggleRight, UploadCloud, 
  Lock, Sparkles, ShieldCheck, Loader2 
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExtensionPage() {
  useUser(); // keeps Clerk session warm for token requests
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  // Plan gating state
  const [plan, setPlan] = useState<"free" | "premium" | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(true);

  useEffect(() => {
    fetch("/api/credits")
      .then((res) => res.json())
      .then((data) => {
        setPlan(data.plan || "free");
      })
      .catch(() => {
        setPlan("free");
      })
      .finally(() => {
        setIsLoadingPlan(false);
      });
  }, []);

  const generateToken = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/extension-token", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.token) setToken(data.token);
    } finally {
      setGenerating(false);
    }
  };

  const copyToken = () => {
    if (!token) return;
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoadingPlan) {
    return (
      <main className="min-h-screen bg-[#0b0d10] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-neutral-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <p className="text-sm font-semibold">Verifying Upgraded Plan status...</p>
        </div>
      </main>
    );
  }

  // ==========================================================
  // UPGRADE GATE: Lock Tools & Extension for Upgraded Plan Only
  // ==========================================================
  if (plan === "free") {
    return (
      <main className="relative min-h-screen bg-[#0b0d10] py-16 px-4 sm:px-6 flex flex-col items-center justify-center">
        <div className="max-w-2xl mx-auto text-center space-y-8 animate-in fade-in zoom-in-95 duration-500 bg-[#131619]/95 backdrop-blur-xl border border-amber-500/30 rounded-3xl p-8 sm:p-12 shadow-[0_0_60px_rgba(245,158,11,0.15)]">
          
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.25)] mx-auto">
            <Lock className="w-10 h-10" />
          </div>

          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> Upgraded Feature Only
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Zhavior Pro Tools & Extension <span className="text-amber-400">Are Locked</span>
            </h1>
            <p className="text-neutral-400 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              The **Zhavior Chrome Extension**, **Voice-Controlled AI Brain**, **Universal Media Sync**, and **Advanced Token Access** are exclusive to **Upgraded Pro** members.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left border-y border-white/10 py-6 my-6 text-sm">
            <div className="flex items-start gap-3 text-neutral-300">
              <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <span><strong>Universal Chrome Extension:</strong> Read & control any website anywhere.</span>
            </div>
            <div className="flex items-start gap-3 text-neutral-300">
              <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <span><strong>Voice-Controlled Brain:</strong> Hands-free scrolling and voice navigation.</span>
            </div>
            <div className="flex items-start gap-3 text-neutral-300">
              <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <span><strong>100,000 Monthly Characters:</strong> High-speed neural speech synthesis.</span>
            </div>
            <div className="flex items-start gap-3 text-neutral-300">
              <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <span><strong>Unlimited Document Studio:</strong> PDF & DOCX Bionic reading engine.</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Button
              onClick={() => router.push("/dashboard/billing")}
              className="w-full sm:w-auto h-14 px-8 text-base font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black rounded-full shadow-[0_0_35px_rgba(245,158,11,0.4)] transform hover:scale-105 transition-all"
            >
              <Zap className="w-5 h-5 mr-2 fill-current" />
              Upgrade to Pro ($19/mo) — Unlock All Tools
            </Button>
            <Link href="/dashboard" className="text-sm font-semibold text-neutral-400 hover:text-white transition-colors py-2">
              Back to Dashboard
            </Link>
          </div>

        </div>
      </main>
    );
  }

  // ==========================================================
  // PRO / UPGRADED VIEW: Full Access to Tools & Extension
  // ==========================================================
  return (
    <main className="relative min-h-screen bg-[#0b0d10] py-12 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 ease-out">
        
        {/* Header navigation */}
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/40 text-green-300 text-xs font-bold">
            <ShieldCheck className="w-3.5 h-3.5" /> Pro Plan Unlocked
          </div>
        </div>

        {/* Hero Section */}
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-500/10 text-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.3)] mb-4">
            <Chrome className="w-10 h-10" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
            The Zhavior <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Chrome Extension</span>
          </h1>
          <p className="text-xl text-neutral-400 max-w-2xl mx-auto">
            Bring the dopamine-optimized reading experience to any website. Control your browser entirely with your voice.
          </p>
        </div>

        {/* Access Token Section */}
        <div className="bg-[#131619]/90 backdrop-blur-sm border border-white/10 rounded-2xl p-8 max-w-2xl mx-auto text-center">
          <h3 className="text-xl font-bold text-white mb-2">Your Access Token</h3>
          <p className="text-neutral-400 text-sm mb-6">
            Generate a token and paste it into the extension. It's shown only
            once and can be regenerated anytime (which revokes the old one).
            Don't share it — it spends your TTS credits.
          </p>
          {token ? (
            <div className="flex items-center gap-2 max-w-md mx-auto">
              <code className="flex-1 px-4 py-3 bg-black rounded-lg border border-white/10 text-indigo-300 font-mono text-sm truncate">
                {token}
              </code>
              <Button onClick={copyToken} variant="outline" className="shrink-0 h-full border-white/10 bg-white/5 hover:bg-white/10 text-white">
                {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          ) : (
            <Button
              onClick={generateToken}
              disabled={generating}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl px-8 py-6 shadow-lg"
            >
              {generating ? "Generating..." : "Generate Extension Token"}
            </Button>
          )}
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 pt-8">
          <div className="bg-[#131619] border border-white/5 rounded-2xl p-6 hover:border-blue-500/30 transition-colors">
            <Brain className="w-8 h-8 text-blue-400 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Voice-Controlled Brain</h3>
            <p className="text-neutral-400 text-sm">
              Activate the microphone and navigate any webpage hands-free. Say "Scroll down", "Go back", or "Refresh".
            </p>
          </div>
          <div className="bg-[#131619] border border-white/5 rounded-2xl p-6 hover:border-indigo-500/30 transition-colors">
            <Zap className="w-8 h-8 text-indigo-400 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">ADHD Bionic Text</h3>
            <p className="text-neutral-400 text-sm">
              Instantly strip away ads and reformat any article into dopamine-optimized Bionic Reading mode with custom colors.
            </p>
          </div>
          <div className="bg-[#131619] border border-white/5 rounded-2xl p-6 hover:border-purple-500/30 transition-colors">
            <Headphones className="w-8 h-8 text-purple-400 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Universal Media Sync</h3>
            <p className="text-neutral-400 text-sm">
              Saying "pause" automatically pauses the AI voice AND any Spotify or YouTube videos playing on the page.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center pt-8 pb-20">
          <Button 
            onClick={() => window.location.href = '/focusreader-extension.zip'}
            className="h-16 px-12 text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-full transition-all duration-300 shadow-[0_0_40px_-10px_rgba(59,130,246,0.4)] hover:shadow-[0_0_60px_-15px_rgba(59,130,246,0.6)]"
          >
            <Download className="mr-3 h-6 w-6" />
            Download Zhavior Extension (.zip)
          </Button>

          <button 
            onClick={() => setShowInstructions(!showInstructions)}
            className="mt-6 flex items-center gap-2 text-sm font-semibold tracking-wide text-neutral-400 hover:text-white transition-colors"
          >
            How to install the extension
            <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showInstructions ? 'rotate-180' : ''}`} />
          </button>

          {showInstructions && (
            <div className="mt-8 grid md:grid-cols-3 gap-6 w-full max-w-4xl animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="bg-[#131619] border border-white/5 rounded-2xl p-6 text-center hover:border-blue-500/30 transition-colors">
                <div className="w-16 h-16 mx-auto bg-blue-500/10 rounded-xl flex items-center justify-center mb-4">
                  <FolderOpen className="w-8 h-8 text-blue-400" />
                </div>
                <h4 className="font-bold text-white mb-2">1. Extract the .zip</h4>
                <p className="text-sm text-neutral-400">Unzip the downloaded file to a folder on your computer.</p>
              </div>
              <div className="bg-[#131619] border border-white/5 rounded-2xl p-6 text-center hover:border-indigo-500/30 transition-colors">
                <div className="w-16 h-16 mx-auto bg-indigo-500/10 rounded-xl flex items-center justify-center mb-4">
                  <ToggleRight className="w-8 h-8 text-indigo-400" />
                </div>
                <h4 className="font-bold text-white mb-2">2. Enable Developer Mode</h4>
                <p className="text-sm text-neutral-400">Go to <code className="text-xs bg-black px-1.5 py-0.5 rounded border border-white/10 text-white">chrome://extensions</code> and toggle Developer Mode on (top right).</p>
              </div>
              <div className="bg-[#131619] border border-white/5 rounded-2xl p-6 text-center hover:border-purple-500/30 transition-colors">
                <div className="w-16 h-16 mx-auto bg-purple-500/10 rounded-xl flex items-center justify-center mb-4">
                  <UploadCloud className="w-8 h-8 text-purple-400" />
                </div>
                <h4 className="font-bold text-white mb-2">3. Load Unpacked</h4>
                <p className="text-sm text-neutral-400">Click "Load unpacked" and select the folder you extracted in Step 1.</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
