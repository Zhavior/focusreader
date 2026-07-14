"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Chrome, Brain, Zap, Headphones, Copy, Download, ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function ExtensionPage() {
  useUser(); // keeps Clerk session warm for the token request
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

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

  return (
    <main className="relative min-h-screen bg-[#0b0d10] py-12 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 ease-out">
        
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
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
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
          <p className="text-xs text-neutral-500 mt-6">
            To install: Extract the .zip, go to <code className="text-neutral-400">chrome://extensions</code>, enable "Developer Mode", and click "Load unpacked".
          </p>
        </div>

      </div>
    </main>
  );
}
