"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useMotionValue, animate } from "framer-motion";
import type { PanInfo } from "framer-motion";
import { SignUpButton, SignInButton, useAuth, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Play, Pause, Sparkles, Zap, Brain,
  Loader2, Star, ChevronLeft, ChevronRight, LogIn,
  ArrowRight, Activity, Clock, Frown, ShieldCheck,
  CheckCircle2, XCircle, Volume2, VolumeX, Radio,
  Headphones, BookOpen, Layers, Sliders, Check
} from "lucide-react";
import { useFormStatus } from "react-dom";
import { createCheckoutAction } from "@/app/actions/stripe";
import KaraokePlayer from "@/components/KaraokePlayer";
import Footer from "@/components/Footer";

// ─── Sandblasted Metal & Satin Light Pools (ADHD GPU-Accelerated Loops) ────────
const SATIN_LIGHTS = [
  { color: "rgba(124,92,255,0.08)",   x: -300, y: -200, size: 750, dur: 16.0, delay: 0   },
  { color: "rgba(0,229,255,0.06)",    x:  280, y: -220, size: 700, dur: 19.5, delay: 1.5 },
  { color: "rgba(255,255,255,0.04)",  x: -340, y:  120, size: 680, dur: 17.0, delay: 0.8 },
  { color: "rgba(143,114,255,0.05)",  x:  340, y:  180, size: 720, dur: 15.0, delay: 2.2 },
];

// ─── Testimonials ──────────────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    name: "Maya R.",
    role: "Harvard Biology Undergrad, ADHD",
    quote:
      "I used to re-read the same biochemistry paragraph 6 times in silence. With Hyperfi's spatial Karaoke highlight and Brown Noise, I crushed 45 pages in one sitting.",
    stars: 5,
    avatar: "https://i.pravatar.cc/150?u=maya"
  },
  {
    name: "Dr. Jordan K.",
    role: "AI Research Scientist & Reviewer",
    quote:
      "The Spatial XY-Cut Sorter for double-column IEEE papers is what sold me. Other readers scramble two columns together. Hyperfi reads top-to-bottom flawlessly.",
    stars: 5,
    avatar: "https://i.pravatar.cc/150?u=jordan"
  },
  {
    name: "Samir T.",
    role: "Stanford Law Candidate",
    quote:
      "The 600-second equal-power crossfaded binaural soundscape is pure alchemy. My brain instantly drops the urge to check tabs when the sound floor hits.",
    stars: 5,
    avatar: "https://i.pravatar.cc/150?u=sam"
  },
];

// ─── Preset Paragraph Samples for Hero Interactive Hook ──────────────────────────
const PRESETS = [
  {
    id: "biology",
    label: "🧬 Medical Biology",
    text: "Neurotransmitters such as dopamine and norepinephrine modulate synaptic plasticity in the prefrontal cortex. In neurodivergent brains, rapid reuptake kinetics can lead to sustained attention drift and cognitive fatigue unless sensory gating mechanisms are optimized."
  },
  {
    id: "legal",
    label: "⚖️ Legal Brief Clause",
    text: "Notwithstanding anything to the contrary contained herein, any indemnity obligations under Section 14.2 shall survive the termination or expiration of this Agreement for a period of thirty-six months from the final distribution date."
  },
  {
    id: "ai",
    label: "🤖 AI Research Paper",
    text: "We introduce a monotonic generation token mechanism and spatial XY-cut bounding box sorter for multi-column document virtualization, ensuring zero out-of-order acoustic race conditions across high-latency web socket connections."
  }
];

// ─── Stripe Checkout Button ────────────────────────────────────────────────────
function CheckoutButton({ label = "Upgrade Now" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full h-12 bg-white text-black hover:bg-neutral-200 font-bold rounded-xl shadow-[0_2px_12px_rgba(255,255,255,0.1)] transition-all transform hover:scale-[1.01] active:scale-95"
    >
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4 text-neutral-800 fill-neutral-800" />}
      {pending ? "Connecting Stripe..." : label}
    </Button>
  );
}

// ─── Landing Page Main ─────────────────────────────────────────────────────────
export default function LandingPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [showBlast, setShowBlast] = useState(false);

  useEffect(() => {
    const KEY = "focusreader_landing_blast_v3";
    const last = localStorage.getItem(KEY);
    const now = Date.now();
    const shouldFire = !last || now - parseInt(last, 10) > 24 * 60 * 60 * 1000;
    if (shouldFire) {
      localStorage.setItem(KEY, String(now));
      const t = setTimeout(() => setShowBlast(true), 180);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0c10] text-[#e3e4e6] overflow-x-hidden selection:bg-white/20 selection:text-white relative">
      
      {/* Real fractal noise grain texture overlay */}
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none bg-[url('data:image/svg+xml;utf8,<svg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22><filter id=%22noiseFilter%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.80%22 numOctaves=%223%22 stitchTiles=%22stitch%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/></svg>')] mix-blend-overlay z-50" />

      {/* ── Apple VisionOS Floating Glass Navigation Island ──────────────────────── */}
      <nav className="fixed top-4 inset-x-4 max-w-5xl mx-auto z-50 flex items-center justify-between px-6 py-3 rounded-full border border-white/[0.08] bg-[#12141c]/60 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] transition-all duration-300 hover:border-white/[0.15] hover:bg-[#12141c]/70">
        <div className="flex items-center gap-6">
          <a href="/" className="flex items-center space-x-2.5 group">
            <div className="h-8 w-8 rounded-full bg-gradient-to-b from-white to-neutral-500 flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.15)] group-hover:scale-105 transition-transform">
              <Brain className="h-4 w-4 text-black" />
            </div>
            <span className="text-base font-extrabold text-white tracking-tight hidden sm:inline bg-clip-text text-transparent bg-gradient-to-b from-white to-neutral-300">
              Hyperfi
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[10px] font-bold text-neutral-400 uppercase tracking-widest hidden md:inline">
              Studio
            </span>
          </a>

          {/* Active Reader Status Pill */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.02] border border-white/5 text-xs text-neutral-400 shadow-inner">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-pulse"></span>
            <span><strong className="text-neutral-200 font-semibold">1,482 brains</strong> deep reading right now</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {!isLoaded ? null : !isSignedIn ? (
            <div className="flex items-center gap-3">
              <SignInButton mode="modal">
                <button className="flex items-center gap-1.5 text-sm font-semibold text-neutral-400 hover:text-white px-3.5 py-1.5 rounded-full hover:bg-white/5 transition-all">
                  <LogIn className="h-4 w-4 text-neutral-400" />
                  Log in
                </button>
              </SignInButton>
              <SignUpButton mode="modal" fallbackRedirectUrl="/dashboard">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button size="sm" className="bg-white hover:bg-neutral-200 text-black rounded-full px-6 font-bold shadow-[0_4px_12px_rgba(255,255,255,0.15)] transition-all">
                    Enter Vault
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </motion.div>
              </SignUpButton>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <UserButton appearance={{ elements: { userButtonAvatarBox: "w-8 h-8 border border-white/10 shadow-md" } }} />
              <a href="/dashboard">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button size="sm" className="bg-white hover:bg-neutral-200 text-black rounded-full px-6 font-extrabold shadow-[0_4px_12px_rgba(255,255,255,0.15)] transition-all">
                    Launch Studio
                    <Zap className="ml-1.5 h-3.5 w-3.5 fill-black text-black" />
                  </Button>
                </motion.div>
              </a>
            </div>
          )}
        </div>
      </nav>


      <main className="flex flex-col items-center px-4 pt-32 sm:pt-40 pb-24 relative overflow-hidden z-10">
        
        {/* Subtle, soft titanium lighting fields (no high-saturation AI lights) */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-gradient-to-b from-white/[0.04] via-white/[0.01] to-transparent rounded-full blur-[100px] pointer-events-none -z-10" />
        <div className="absolute top-80 right-10 w-[300px] h-[300px] bg-white/[0.02] rounded-full blur-[80px] pointer-events-none -z-10" />

        {/* ── Hero ───────────────────────────────────────────────────────────── */}
        <section className="flex flex-col items-center text-center max-w-4xl space-y-8 relative z-10">

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.02] px-4 py-1.5 text-sm font-semibold text-neutral-300 shadow-[0_2px_12px_rgba(255,255,255,0.03)]"
          >
            <Sparkles className="mr-2 h-4 w-4 text-neutral-400 animate-spin" style={{ animationDuration: '8s' }} />
            The Neuro-Inclusive Document Studio & Chrome Extension
          </motion.div>

          {/* Headline + matte silver light pools */}
          <div className="relative flex items-center justify-center">
            {showBlast && SATIN_LIGHTS.map((cloud, i) => (
              <motion.div
                key={i}
                className="pointer-events-none absolute rounded-full reader-page-item"
                style={{
                  width: cloud.size, height: cloud.size,
                  background: `radial-gradient(ellipse at center, ${cloud.color} 0%, transparent 70%)`,
                  filter: "blur(80px)",
                  top: "50%", left: "50%",
                }}
                initial={{ scale: 0.8, opacity: 0, x: "-50%", y: "-50%" }}
                animate={{
                  scale: [0.85, 1.15, 0.95],
                  opacity: [0.4, 0.8, 0.5],
                  x: ["-50%", `calc(-50% + ${cloud.x * 0.15}px)`, "-50%"],
                  y: ["-50%", `calc(-50% + ${cloud.y * 0.15}px)`, "-50%"],
                }}
                transition={{
                  duration: cloud.dur,
                  delay: cloud.delay,
                  repeat: Infinity,
                  repeatType: "mirror",
                  ease: "easeInOut",
                }}
              />
            ))}

            <motion.h1
              className="relative text-5xl font-black tracking-tighter sm:text-6xl md:text-7xl lg:text-[5.8rem] leading-[1.04] text-transparent bg-clip-text bg-gradient-to-b from-white via-neutral-100 to-neutral-400"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
            >
              Stop re-reading.{" "}
              <br className="hidden sm:block" />
              Start hyperfocusing.
            </motion.h1>
          </div>

          <motion.p
            className="max-w-[44rem] leading-relaxed text-neutral-400 sm:text-xl sm:leading-9 font-normal"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.35 }}
          >
            Turn dense PDFs, IEEE papers, textbooks, and web articles into **spatial Karaoke audio tracks** backed by a 600-second equal-power binaural soundscape.
          </motion.p>

          {/* Hero Interactive Paragraph Transformer */}
          <motion.div
            className="w-full pt-4 px-2 sm:px-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.5 }}
          >
            <HeroInteractiveHook />
          </motion.div>
        </section>

        {/* ── Interactive Binaural Soundscape Tuner Preview ─────────────────── */}
        <BinauralTunerPreview />

        {/* ── The Cost of Drifting (Pain & Psychology) ───────────────────────── */}
        <PainSection />

        {/* ── Social Proof & Authority ───────────────────────────────────────── */}
        <motion.section
          className="mt-28 w-full max-w-6xl mx-auto px-4"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <AuthorityBanner />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="flex flex-col gap-4 rounded-3xl border border-white/[0.08] bg-[#12141c]/40 backdrop-blur-xl p-8 shadow-2xl relative overflow-hidden group hover:border-white/[0.2] hover:shadow-[0_20px_45px_rgba(0,0,0,0.6)] transition-all">
                <div className="flex gap-1">
                  {Array.from({ length: t.stars }).map((_, s) => (
                    <Star key={s} className="h-4 w-4 fill-neutral-400 text-neutral-400" />
                  ))}
                </div>
                <p className="text-[15px] text-neutral-300 leading-relaxed font-serif italic flex-1">"{t.quote}"</p>
                <div className="mt-auto pt-4 border-t border-white/5 flex items-center gap-3">
                  <img src={t.avatar} alt={t.name} className="h-11 w-11 rounded-full border border-white/10 group-hover:scale-105 transition-transform" />
                  <div>
                    <p className="text-sm font-bold text-white">{t.name}</p>
                    <p className="text-xs text-neutral-400 font-medium">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── Us vs Them Matrix ──────────────────────────────────────────────── */}
        <ComparisonMatrix />

        {/* ── Full Karaoke Demo Player ───────────────────────────────────────── */}
        <DemoPlayer />

        {/* ── Official 3-Tier Pricing Section (`$19.99`, `$89.99`, `$199.99`) ── */}
        <motion.section
          id="pricing"
          className="mt-32 mb-12 w-full max-w-6xl mx-auto px-4 flex flex-col items-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="text-center mb-14 space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/[0.02] border border-white/[0.08] text-neutral-300 text-xs font-bold uppercase tracking-widest">
              <Layers className="h-3.5 w-3.5 text-neutral-400" /> Transparent Pricing
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">Invest once. Master your focus forever.</h2>
            <p className="text-neutral-400 text-base max-w-xl mx-auto">All plans include full Chrome Extension access, Document Studio, spatial Karaoke highlighting, and unlimited offline neural voices.</p>
          </div>
          <OfficialPricingGrid />
        </motion.section>

      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <Footer />

    </div>
  );
}

// ─── Hero Interactive Paragraph Transformer (`HeroInteractiveHook`) ────────────
function HeroInteractiveHook() {
  const [selectedPreset, setSelectedPreset] = useState(PRESETS[0]);
  const [textInput, setTextInput] = useState(PRESETS[0].text);
  const [isBionicActive, setIsBionicActive] = useState(true);
  const [isPlayingDemo, setIsPlayingDemo] = useState(false);
  const [activeWordIdx, setActiveWordIdx] = useState(-1);

  const words = textInput.split(/\s+/).filter(Boolean);

  // Simulate Karaoke Highlight Loop on Homepage
  useEffect(() => {
    if (!isPlayingDemo) {
      setActiveWordIdx(-1);
      return;
    }
    let idx = 0;
    const interval = setInterval(() => {
      if (idx >= words.length) {
        idx = 0;
      }
      setActiveWordIdx(idx);
      idx++;
    }, 280);
    return () => clearInterval(interval);
  }, [isPlayingDemo, words.length]);

  const handlePresetChange = (preset: typeof PRESETS[0]) => {
    setSelectedPreset(preset);
    setTextInput(preset.text);
    setIsPlayingDemo(false);
    setActiveWordIdx(-1);
  };

  const renderWord = (w: string, i: number) => {
    const isActive = i === activeWordIdx;
    const mid = Math.ceil(w.length / 2);
    const bionicFirst = w.slice(0, mid);
    const bionicSecond = w.slice(mid);

    return (
      <span
        key={i}
        onClick={() => { setActiveWordIdx(i); setIsPlayingDemo(true); }}
        className={`adhd-karaoke-word cursor-pointer select-none ${
          isActive
            ? "active"
            : "text-neutral-300 hover:text-white hover:bg-white/10"
        }`}
      >
        {isBionicActive ? (
          <>
            <span className="adhd-bionic-stem">{bionicFirst}</span>
            <span className="opacity-75 font-normal">{bionicSecond}</span>
          </>
        ) : (
          w
        )}
      </span>
    );
  };

  return (
    <div className="w-full max-w-3xl mx-auto glass-titanium rounded-3xl p-6 sm:p-8 relative overflow-hidden group adhd-pulse-glow">
      
      <div className="relative z-10 flex flex-col gap-6">
        {/* Preset selector bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider mr-1">Test Live Presets:</span>
            {PRESETS.map((p) => {
              const isActive = selectedPreset.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handlePresetChange(p)}
                  className={`relative px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    isActive ? "text-white" : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activePresetTab"
                      className="absolute inset-0 bg-white/10 border border-white/10 rounded-xl shadow-[0_2px_10px_rgba(255,255,255,0.05)]"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{p.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsBionicActive(!isBionicActive)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/[0.02] border border-white/10 text-neutral-300 hover:border-white/20 transition-all"
            >
              <Brain className={`w-3.5 h-3.5 ${isBionicActive ? "text-white" : "text-neutral-500"}`} />
              <span>Bionic Anchors</span>
              <div className={`w-9 h-5 rounded-full p-0.5 flex items-center transition-colors duration-300 ${isBionicActive ? "bg-white" : "bg-neutral-800"}`}>
                <motion.div
                  className={`w-4 h-4 rounded-full shadow-md ${isBionicActive ? "bg-black" : "bg-neutral-400"}`}
                  layout
                  transition={{ type: "spring", stiffness: 600, damping: 35 }}
                  style={{ marginLeft: isBionicActive ? "auto" : "0px" }}
                />
              </div>
            </button>
          </div>
        </div>

        {/* Interactive Paragraph Stage */}
        <div className="min-h-[140px] p-6 rounded-2xl bg-[#090a0f]/80 border border-white/5 text-left font-serif text-lg sm:text-xl leading-9 shadow-inner overflow-y-auto max-h-[220px]">
          {words.map((w, idx) => renderWord(w, idx))}
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => setIsPlayingDemo(!isPlayingDemo)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold border border-neutral-700/50 shadow-[0_4px_12px_rgba(0,0,0,0.4)] transition-all transform hover:scale-[1.02] active:scale-95"
            >
              {isPlayingDemo ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
              <span>{isPlayingDemo ? "Pause Karaoke" : "Simulate Karaoke TTS"}</span>
            </button>
            <span className="text-xs text-neutral-400 hidden md:inline">Click any word above to seek instantly!</span>
          </div>

          <SignUpButton mode="modal" fallbackRedirectUrl="/dashboard">
            <Button className="w-full sm:w-auto bg-white hover:bg-neutral-200 text-black font-extrabold rounded-2xl px-6 py-6 shadow-[0_4px_12px_rgba(255,255,255,0.15)] active:scale-95 transition-all">
              Upload Your Own PDF
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </SignUpButton>
        </div>
      </div>
    </div>
  );
}

// ─── Binaural Soundscape Tuner Preview ─────────────────────────────────────────
function BinauralTunerPreview() {
  const [activeNoise, setActiveNoise] = useState<"brown" | "pink" | "rain" | "forest" | "off">("brown");
  const [volume, setVolume] = useState<number>(0.35);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  const startNoise = (type: typeof activeNoise) => {
    setActiveNoise(type);
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch (e) {}
      sourceNodeRef.current = null;
    }

    if (type === "off") {
      if (audioCtxRef.current) {
        audioCtxRef.current.suspend();
      }
      return;
    }

    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume();

    // Create a synthesized brown/pink noise buffer right in browser
    const bufferSize = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        if (type === "brown" || type === "forest") {
          data[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = data[i];
          data[i] *= 3.5; // boost gain slightly
        } else {
          data[i] = white * 0.25;
        }
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    sourceNodeRef.current = source;

    if (!gainNodeRef.current) {
      gainNodeRef.current = ctx.createGain();
      gainNodeRef.current.connect(ctx.destination);
    }
    gainNodeRef.current.gain.setValueAtTime(volume, ctx.currentTime);
    source.connect(gainNodeRef.current);
    source.start();
  };

  const handleVolChange = (val: number) => {
    setVolume(val);
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.setValueAtTime(val, audioCtxRef.current.currentTime);
    }
  };

  return (
    <motion.section
      className="mt-28 w-full max-w-5xl mx-auto px-4"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
    >
      <div className="glass-titanium rounded-3xl p-8 sm:p-10 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          
          <div className="space-y-3 max-w-md text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.02] border border-white/[0.08] text-neutral-300 text-xs font-bold uppercase tracking-wider">
              <Headphones className="h-3.5 w-3.5 animate-bounce text-neutral-400" /> Live Sensory Studio
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Test our 600-Second Binaural Soundscape Floor right now.
            </h3>
            <p className="text-neutral-400 text-sm leading-relaxed">
              When reading dense technical docs, absolute silence causes your brain to hunt for auditory stimuli. Our mathematically tuned frequencies provide an acoustic shield that doubles comprehension.
            </p>
          </div>

          <div className="flex flex-col gap-5 w-full md:w-auto min-w-[320px] bg-[#090a0f]/95 border border-white/[0.08] p-6 rounded-2xl shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                <Radio className="w-4 h-4 text-neutral-400 animate-pulse" />
                Select Ambient Layer:
              </span>
              <span className="text-xs font-extrabold text-neutral-300 uppercase">{activeNoise}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "brown", label: "🌊 Brown Noise" },
                { id: "pink", label: "🌸 Pink Noise" },
                { id: "rain", label: "🌧️ Rain Storm" },
                { id: "forest", label: "🌲 Deep Forest" }
              ].map((sound) => (
                <button
                  key={sound.id}
                  onClick={() => startNoise(sound.id as any)}
                  className={`px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                    activeNoise === sound.id
                      ? "bg-white text-black shadow-[0_4px_16px_rgba(255,255,255,0.2)] scale-105"
                      : "tactile-pill text-neutral-300"
                  }`}
                >
                  {sound.label}
                </button>
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t border-white/[0.08]">
              <div className="flex justify-between items-center text-xs text-neutral-400">
                <span className="flex items-center gap-1.5 font-semibold">
                  <Sliders className="w-3.5 h-3.5 text-neutral-400" /> Soundscape Volume:
                </span>
                <span className="font-bold text-white">{Math.round(volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => handleVolChange(parseFloat(e.target.value))}
                className="w-full accent-white bg-neutral-800 h-2 rounded-lg cursor-pointer"
              />
            </div>
          </div>

        </div>
      </div>
    </motion.section>
  );
}

// ─── Pain & Psychology Section ─────────────────────────────────────────────────
function PainSection() {
  return (
    <motion.section 
      className="mt-32 w-full max-w-5xl px-4 flex flex-col items-center"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8 }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center glass-titanium rounded-3xl p-8 md:p-14 adhd-pulse-glow">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.02] border border-white/[0.08] text-neutral-300 text-xs font-extrabold uppercase tracking-widest">
            <Clock className="h-3.5 w-3.5 text-neutral-400" /> The Cognitive Cost of Drifting
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            You are losing <span className="text-white underline decoration-white/30">14 hours a week</span> re-reading pages your brain refuses to absorb.
          </h2>
          <p className="text-neutral-400 text-base sm:text-lg leading-relaxed">
            That is an unpaid part-time job. Traditional PDF readers require immense self-control to stay on the line. Every time your eyes scan a page but your mind is somewhere else, you lose momentum, focus, and hours you can never get back.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <Card className="glass-titanium border-white/5 shadow-inner">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-white/[0.02] border border-white/10 flex items-center justify-center shrink-0">
                <XCircle className="h-6 w-6 text-neutral-400" />
              </div>
              <div>
                <p className="text-base font-bold text-white">Traditional Silent Reading</p>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">High friction, low retention, constant distraction loops, and rapid mental exhaustion.</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-titanium border-white/[0.18] shadow-[0_4px_25px_rgba(124,92,255,0.15)]">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                <Brain className="h-6 w-6 text-[#00e5ff] animate-pulse" />
              </div>
              <div>
                <p className="text-base font-bold text-white">Hyperfi Binaural Karaoke</p>
                <p className="text-xs text-neutral-300 mt-1 leading-relaxed">Synchronized dual-sensory stimulation that locks your attention into immediate flow state.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.section>
  );
}

// ─── Authority Banner ──────────────────────────────────────────────────────────
function AuthorityBanner() {
  return (
    <div className="w-full border-y border-white/[0.08] bg-white/[0.005] py-8 my-12 flex flex-col items-center justify-center">
      <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-6 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-neutral-400" /> Trusted by students & researchers across top universities
      </p>
      <div className="flex flex-wrap justify-center items-center gap-10 md:gap-20 opacity-50 select-none">
        <span className="text-xl font-black font-serif tracking-tight text-white">HARVARD</span>
        <span className="text-xl font-bold font-sans tracking-wide text-white">STANFORD</span>
        <span className="text-2xl font-black italic tracking-tighter text-white">MIT</span>
        <span className="text-xl font-black font-serif text-white">YALE</span>
        <span className="text-xl font-bold tracking-widest text-white">OXFORD</span>
      </div>
    </div>
  );
}

// ─── Official 3-Tier Exact Pricing Grid (`$19.99`, `$89.99`, `$199.99`) ─────────
function OfficialPricingGrid() {
  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
      
      {/* ── Tier 1: Monthly `$19.99` ── */}
      <motion.div whileHover={{ y: -8, scale: 1.015 }} transition={{ type: "spring", stiffness: 350, damping: 25 }} className="h-full">
        <Card className="glass-titanium rounded-3xl overflow-hidden shadow-xl h-full flex flex-col">
          <CardContent className="p-8 flex flex-col h-full space-y-6">
            <div className="space-y-2">
              <span className="inline-block px-2.5 py-0.5 rounded-md bg-white/[0.02] border border-white/10 text-neutral-300 text-[10px] font-bold uppercase tracking-wider">Flexible</span>
              <h3 className="text-2xl font-extrabold text-white">Monthly Plan</h3>
              <p className="text-neutral-400 text-sm">Perfect for short research projects and finals week.</p>
            </div>
            <div className="text-5xl font-black text-white py-2">
              $19<span className="text-3xl font-bold">.99</span><span className="text-lg text-neutral-400 font-medium">/mo</span>
            </div>
            <ul className="space-y-3.5 text-sm text-neutral-300 flex-1 border-t border-white/[0.08] pt-6">
              <li className="flex items-center gap-2.5"><Check className="h-4 w-4 text-[#00e5ff] shrink-0" /> Full Chrome Extension access</li>
              <li className="flex items-center gap-2.5"><Check className="h-4 w-4 text-[#00e5ff] shrink-0" /> Focus Document Studio (`.pdf`, `.docx`)</li>
              <li className="flex items-center gap-2.5"><Check className="h-4 w-4 text-[#00e5ff] shrink-0" /> Spatial Karaoke word highlighting</li>
              <li className="flex items-center gap-2.5"><Check className="h-4 w-4 text-[#00e5ff] shrink-0" /> Cancel anytime with one click</li>
            </ul>
            <form action={createCheckoutAction} className="w-full pt-4 mt-auto">
              <input type="hidden" name="priceId" value="price_monthly_1999" />
              <Button type="submit" className="w-full bg-white/5 hover:bg-white/10 text-white font-bold h-12 rounded-xl transition-transform active:scale-95 border border-white/10">
                Start Monthly (`$19.99`)
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Tier 2: 6 Months Beta `$89.99` (THE BEST VALUE) ── */}
      <motion.div whileHover={{ y: -10, scale: 1.025 }} transition={{ type: "spring", stiffness: 350, damping: 25 }} className="relative md:-translate-y-4 z-10 h-full">
        <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-b from-white/25 to-transparent opacity-40 blur-md" />
        
        <Card className="relative glass-titanium border border-white/25 rounded-3xl h-full flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.7)] overflow-hidden adhd-pulse-glow">
          <div className="bg-gradient-to-r from-[#7c5cff] to-[#00e5ff] text-black text-xs font-black py-2.5 px-4 text-center uppercase tracking-widest border-b border-white/[0.08]">
            🔥 MOST POPULAR — 6 MONTHS BETA (`$89.99`)
          </div>
          
          <CardContent className="p-8 flex flex-col h-full space-y-6">
            <div className="space-y-1">
              <h3 className="text-3xl font-black text-white">6 Months Beta</h3>
              <p className="text-neutral-400 text-sm font-semibold">Our #1 recommended tier for semester mastery.</p>
            </div>
            <div>
              <div className="text-6xl font-black text-white">
                $89<span className="text-3xl font-bold">.99</span>
              </div>
              <p className="text-white text-sm font-extrabold mt-2 tracking-wide">💡 Only $14.99/mo — Billed once every 6 months</p>
              <p className="text-neutral-500 text-xs mt-0.5 line-through font-medium">$119.94 if paid monthly (Save $30 instantly)</p>
            </div>
            <ul className="space-y-4 text-sm text-neutral-200 flex-1 bg-white/[0.02] p-5 rounded-2xl border border-white/[0.08]">
              <li className="flex items-center gap-3 font-semibold"><Check className="h-5 w-5 text-[#00e5ff] shrink-0" /> Everything in Monthly, plus:</li>
              <li className="flex items-center gap-3"><Check className="h-5 w-5 text-[#00e5ff] shrink-0" /> **Priority Neural TTS Engine** queue</li>
              <li className="flex items-center gap-3"><Check className="h-5 w-5 text-[#00e5ff] shrink-0" /> **Offline 600s Binaural Soundscape** vault</li>
              <li className="flex items-center gap-3"><Check className="h-5 w-5 text-[#00e5ff] shrink-0" /> **Instant PDF spatial XY-cut** sorter</li>
            </ul>
            <form action={createCheckoutAction} className="w-full pt-4 mt-auto">
              <input type="hidden" name="priceId" value="price_6months_8999" />
              <Button type="submit" className="relative group w-full bg-white hover:bg-neutral-200 text-black font-black text-base h-14 rounded-xl shadow-[0_4px_20px_rgba(255,255,255,0.15)] transition-transform active:scale-95">
                <span className="relative z-10 flex items-center justify-center gap-2">
                  LOCK IN $89.99 BETA DEAL <Zap className="h-5 w-5 fill-black text-black" />
                </span>
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Tier 3: 2-Year Mastery `$199.99` ── */}
      <motion.div whileHover={{ y: -8, scale: 1.015 }} transition={{ type: "spring", stiffness: 350, damping: 25 }} className="h-full">
        <Card className="glass-titanium rounded-3xl overflow-hidden shadow-xl h-full flex flex-col">
          <CardContent className="p-8 flex flex-col h-full space-y-6">
            <div className="space-y-2">
              <span className="inline-block px-2.5 py-0.5 rounded-md bg-white/[0.02] border border-white/10 text-neutral-300 text-[10px] font-bold uppercase tracking-wider">Maximum Savings</span>
              <h3 className="text-2xl font-extrabold text-white">2-Year Mastery Plan</h3>
              <p className="text-neutral-400 text-sm">For degree programs and career deep work.</p>
            </div>
            <div className="text-5xl font-black text-white py-2">
              $199<span className="text-3xl font-bold">.99</span>
            </div>
            <p className="text-white text-sm font-extrabold -mt-3 tracking-wide">💡 Only $8.33/mo — Billed once for 2 full years</p>
            <p className="text-neutral-500 text-xs line-through">$479.76 if paid monthly (Save $280 instantly)</p>
            <ul className="space-y-3.5 text-sm text-neutral-300 flex-1 border-t border-white/[0.08] pt-6">
              <li className="flex items-center gap-2.5"><Check className="h-4 w-4 text-[#00e5ff] shrink-0" /> All VIP features & early feature betas</li>
              <li className="flex items-center gap-2.5"><Check className="h-4 w-4 text-[#00e5ff] shrink-0" /> Unlimited Cloud Study Vault storage</li>
              <li className="flex items-center gap-2.5"><Check className="h-4 w-4 text-[#00e5ff] shrink-0" /> Dedicated VIP audio processing node</li>
              <li className="flex items-center gap-2.5"><Check className="h-4 w-4 text-[#00e5ff] shrink-0" /> Lock in this founder price forever</li>
            </ul>
            <form action={createCheckoutAction} className="w-full pt-4 mt-auto">
              <input type="hidden" name="priceId" value="price_2years_19999" />
              <Button type="submit" className="w-full bg-white/5 hover:bg-white/10 text-white font-bold h-12 rounded-xl border border-white/10 transition-transform active:scale-95">
                Claim 2-Year Plan (`$199.99`)
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>

    </div>
  );
}

// ─── Us vs Them Comparison Matrix ──────────────────────────────────────────────
function ComparisonMatrix() {
  return (
    <motion.section
      className="mt-32 w-full max-w-5xl mx-auto px-4 flex flex-col items-center"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
    >
      <div className="text-center mb-12 space-y-2">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Why cobble together 3 apps when you can use 1?</h2>
        <p className="text-neutral-400 text-base">We combined document parsing, bionic formatting, and binaural soundscapes into one studio.</p>
      </div>

      <div className="w-full overflow-x-auto rounded-3xl glass-titanium shadow-2xl">
        <table className="w-full text-left border-collapse min-w-[650px]">
          <thead>
            <tr>
              <th className="p-6 border-b border-white/[0.08] text-neutral-400 font-semibold text-sm">Capability / Dimension</th>
              <th className="p-6 border-b border-white/[0.08] bg-white/[0.04] text-white font-extrabold border-x border-x-white/[0.08] text-center w-1/4 text-base">
                Hyperfi Studio
              </th>
              <th className="p-6 border-b border-white/[0.08] text-neutral-400 font-medium text-center w-1/4">
                Generic TTS Apps<br/><span className="text-xs text-neutral-500 font-normal">(Speechify / NaturalReader)</span>
              </th>
              <th className="p-6 border-b border-white/[0.08] text-neutral-400 font-medium text-center w-1/4">
                Music & Focus Apps<br/><span className="text-xs text-neutral-500 font-normal">(Brain.fm / Endel)</span>
              </th>
            </tr>
          </thead>
          <tbody className="text-sm">
            <tr className="border-b border-white/5">
              <td className="p-6 text-white font-medium">Spatial XY-Cut Double-Column PDF Parsing</td>
              <td className="p-6 bg-white/[0.02] border-x border-x-white/5 text-center"><CheckCircle2 className="h-5 w-5 mx-auto text-[#00e5ff]" /></td>
              <td className="p-6 text-center"><XCircle className="h-5 w-5 mx-auto text-neutral-600" /></td>
              <td className="p-6 text-center"><XCircle className="h-5 w-5 mx-auto text-neutral-600" /></td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="p-6 text-white font-medium">600s Equal-Power Crossfaded Binaural Audio</td>
              <td className="p-6 bg-white/[0.02] border-x border-x-white/5 text-center"><CheckCircle2 className="h-5 w-5 mx-auto text-[#00e5ff]" /></td>
              <td className="p-6 text-center"><XCircle className="h-5 w-5 mx-auto text-neutral-600" /></td>
              <td className="p-6 text-center"><CheckCircle2 className="h-5 w-5 mx-auto text-neutral-400" /></td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="p-6 text-white font-medium">Monotonic Scrubbing & AbortController Race Immunity</td>
              <td className="p-6 bg-white/[0.02] border-x border-x-white/5 text-center"><CheckCircle2 className="h-5 w-5 mx-auto text-[#00e5ff]" /></td>
              <td className="p-6 text-center"><XCircle className="h-5 w-5 mx-auto text-neutral-600" /></td>
              <td className="p-6 text-center"><XCircle className="h-5 w-5 mx-auto text-neutral-600" /></td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="p-6 text-white font-medium">Bionic Reading Anchor Formatting</td>
              <td className="p-6 bg-white/[0.02] border-x border-x-white/5 text-center"><CheckCircle2 className="h-5 w-5 mx-auto text-[#00e5ff]" /></td>
              <td className="p-6 text-center"><XCircle className="h-5 w-5 mx-auto text-neutral-600" /></td>
              <td className="p-6 text-center"><XCircle className="h-5 w-5 mx-auto text-neutral-600" /></td>
            </tr>
            <tr>
              <td className="p-6 text-white font-extrabold">Price & Value</td>
              <td className="p-6 bg-white/[0.04] border-x border-x-white/10 text-center text-white font-black text-base">$14.99 / mo<br/><span className="text-[11px] font-normal text-neutral-400">(on 6-month beta plan)</span></td>
              <td className="p-6 text-center text-neutral-400">$19.99+ / mo</td>
              <td className="p-6 text-center text-neutral-400">$9.99 / mo</td>
            </tr>
          </tbody>
        </table>
      </div>
    </motion.section>
  );
}

// ─── Demo Player ───────────────────────────────────────────────────────────────
function DemoPlayer() {
  const demoText = "Attention-Deficit/Hyperactivity Disorder is not a deficit of attention, but rather an issue of regulating it. People with ADHD can actually focus intensely on tasks that provide high dopamine and immediate feedback, a state known as hyperfocus. By stripping away distractions, increasing reading speed, and layering a mathematically perfect brown noise floor, Hyperfi acts as a digital stimulant, artificially inducing flow state and tricking the brain into absorbing dense information effortlessly.";
  
  return (
    <motion.section
      className="mt-32 w-full max-w-4xl flex flex-col items-center px-4"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
    >
      <div className="text-center mb-10 space-y-2">
        <h2 className="text-3xl font-extrabold tracking-tight text-white">Experience Full Karaoke TTS</h2>
        <p className="text-neutral-400 text-sm">Hit play below to see the precise word timing engine in action.</p>
      </div>
      
      <div className="w-full glass-titanium p-1.5 rounded-3xl shadow-2xl relative">
        <div className="absolute -inset-0.5 bg-gradient-to-br from-white/10 to-transparent rounded-3xl blur opacity-30"></div>
        <div className="relative z-10 glass-titanium rounded-3xl p-6 sm:p-8 shadow-inner">
          <KaraokePlayer 
            src="/demo.mp3" 
            text={demoText}
          />
        </div>
      </div>
    </motion.section>
  );
}
