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
  CheckCircle2, XCircle
} from "lucide-react";
import { useFormStatus } from "react-dom";
import { createCheckoutAction } from "@/app/actions/stripe";

// ─── Smoke cloud definitions ───────────────────────────────────────────────────
const SMOKE_CLOUDS = [
  { color: "rgba(139,92,246,0.95)",  x: -280, y: -200, size: 700, dur: 4.5, delay: 0    },
  { color: "rgba(236,72,153,0.9)",   x:  260, y: -220, size: 660, dur: 4.8, delay: 0.08 },
  { color: "rgba(34,211,238,0.8)",   x: -340, y:  100, size: 640, dur: 5.0, delay: 0.15 },
  { color: "rgba(251,113,133,0.85)", x:  320, y:  180, size: 680, dur: 4.6, delay: 0.05 },
  { color: "rgba(167,139,250,0.85)", x:   10, y: -320, size: 720, dur: 5.5, delay: 0.2  },
  { color: "rgba(45,212,191,0.75)",  x:  -10, y:  330, size: 660, dur: 5.2, delay: 0.1  },
  { color: "rgba(249,115,22,0.75)",  x:  380, y:  -80, size: 580, dur: 4.2, delay: 0.12 },
  { color: "rgba(99,102,241,0.9)",   x: -400, y:  -30, size: 620, dur: 4.4, delay: 0.07 },
  { color: "rgba(217,70,239,0.7)",   x:  200, y:  280, size: 560, dur: 5.0, delay: 0.18 },
  { color: "rgba(16,185,129,0.65)",  x: -200, y:  260, size: 540, dur: 4.8, delay: 0.22 },
];

// ─── Testimonials ──────────────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    name: "Maya R.",
    role: "Biology undergrad, ADHD",
    quote:
      "I re-read the same paragraph 6 times in silence. With FocusReader I got through 40 pages in one sitting. First time that's ever happened.",
    stars: 5,
    avatar: "https://i.pravatar.cc/150?u=maya"
  },
  {
    name: "Jordan T.",
    role: "Product manager, anxiety",
    quote:
      "I've tried every focus app. This one actually works because it removes the hardest part — starting. I just paste, press play, done.",
    stars: 5,
    avatar: "https://i.pravatar.cc/150?u=jordan"
  },
  {
    name: "Sam K.",
    role: "Law student, self-diagnosed",
    quote:
      "The brown noise layer is everything. My brain stops hunting for distractions when there's a sound floor underneath the voice.",
    stars: 5,
    avatar: "https://i.pravatar.cc/150?u=sam"
  },
];

// ─── Stripe Checkout Button ────────────────────────────────────────────────────
function CheckoutButton({ label = "Upgrade Now" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full h-12 bg-white text-black hover:bg-neutral-200 font-semibold"
    >
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
      {pending ? "Loading..." : label}
    </Button>
  );
}

// ─── Landing Page ──────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [showBlast, setShowBlast] = useState(false);

  useEffect(() => {
    const KEY = "focusreader_landing_blast_v2";
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
    <div className="flex min-h-screen flex-col bg-[#080a0c] overflow-x-hidden">

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#080a0c]/80 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <div className="flex items-center space-x-2">
            <div className="h-7 w-7 rounded-full bg-[linear-gradient(45deg,theme(colors.indigo.500),theme(colors.violet.500),theme(colors.indigo.500))] bg-[length:200%_auto] animate-[rainbow_4s_linear_infinite] flex items-center justify-center shadow-[0_0_12px_rgba(99,102,241,0.5)]">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold text-white tracking-tight hidden sm:inline">FocusReader</span>
          </div>

          {/* Login, Logout, Profile, Settings (Top Left Corner) */}
          <div className="flex items-center gap-3 border-l border-white/10 pl-6">
            {!isLoaded ? null : !isSignedIn ? (
              <SignInButton mode="modal">
                <button className="flex items-center gap-1.5 text-sm font-medium text-neutral-400 hover:text-white transition-colors">
                  <LogIn className="h-4 w-4" />
                  Log in
                </button>
              </SignInButton>
            ) : (
              <div className="flex items-center gap-2">
                <UserButton appearance={{ elements: { userButtonAvatarBox: "w-8 h-8" } }} />
                <span className="text-sm font-medium text-neutral-400">Profile & Settings</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isLoaded ? null : !isSignedIn ? (
            <SignUpButton mode="modal" fallbackRedirectUrl="/onboarding">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-full px-5 font-semibold">
                Get started
              </Button>
            </SignUpButton>
          ) : (
            <a href="/dashboard">
              <Button size="sm" className="bg-white hover:bg-neutral-200 text-black rounded-full px-5 font-bold shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                Open app
              </Button>
            </a>
          )}
        </div>
      </nav>

      <main className="flex flex-col items-center px-4 pt-32 sm:pt-40 pb-24
        bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))]
        from-indigo-900/20 via-[#080a0c] to-[#080a0c]">

        {/* ── Hero ───────────────────────────────────────────────────────────── */}
        <section className="flex flex-col items-center text-center max-w-3xl space-y-8">

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-sm font-medium text-indigo-300"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Neuro-inclusive design
          </motion.div>

          {/* Headline + smoke blast */}
          <div className="relative flex items-center justify-center">
            {showBlast && SMOKE_CLOUDS.map((cloud, i) => (
              <motion.div
                key={i}
                className="pointer-events-none absolute rounded-full"
                style={{
                  width: cloud.size, height: cloud.size,
                  background: `radial-gradient(ellipse at center, ${cloud.color} 0%, transparent 70%)`,
                  filter: "blur(55px)",
                  top: "50%", left: "50%",
                  translateX: "-50%", translateY: "-50%",
                }}
                initial={{ scale: 0.15, opacity: 0, x: 0, y: 0 }}
                animate={{ scale: [0.15, 1.0, 1.4], opacity: [0, 0.85, 0], x: cloud.x, y: cloud.y }}
                transition={{ duration: cloud.dur, delay: cloud.delay, ease: [0.16, 1, 0.3, 1], times: [0, 0.35, 1] }}
              />
            ))}
            {showBlast && (
              <motion.div
                className="pointer-events-none absolute rounded-full"
                style={{
                  width: 600, height: 600,
                  background: "radial-gradient(ellipse at center, rgba(255,255,255,0.28) 0%, rgba(139,92,246,0.55) 35%, rgba(236,72,153,0.3) 60%, transparent 75%)",
                  filter: "blur(30px)",
                  top: "50%", left: "50%", translateX: "-50%", translateY: "-50%",
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1.4, 0.2], opacity: [0, 1, 0] }}
                transition={{ duration: 2.0, ease: "easeOut", delay: 0.05 }}
              />
            )}

            <motion.h1
              className="relative text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl text-transparent bg-clip-text bg-[linear-gradient(to_right,theme(colors.neutral.100),theme(colors.indigo.200),theme(colors.neutral.400),theme(colors.neutral.100))] bg-[length:200%_auto] animate-[rainbow_5s_linear_infinite]"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
            >
              Stop drifting.{" "}
              <br className="hidden sm:block" />
              Start finishing.
            </motion.h1>
          </div>

          <motion.p
            className="max-w-[42rem] leading-normal text-neutral-400 sm:text-xl sm:leading-8"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.35 }}
          >
            Turn boring PDFs and textbooks into dopamine-optimized audio tracks.
          </motion.p>

          <motion.div
            className="w-full pt-4 px-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.5 }}
          >
            <HeroInteractiveHook />
          </motion.div>
        </section>

        {/* ── The Pain (Amygdala Activation) ─────────────────────────────────── */}
        <PainSection />

        {/* ── Social Proof & Authority ───────────────────────────────────────── */}
        <motion.section
          className="mt-20 w-full"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <AuthorityBanner />
          
          <div className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 px-4">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#0b0d10]/50 backdrop-blur-sm p-6 shadow-xl relative overflow-hidden group hover:border-indigo-500/30 transition-colors">
                <div className="flex gap-0.5">
                  {Array.from({ length: t.stars }).map((_, s) => (
                    <Star key={s} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-[15px] text-neutral-300 leading-relaxed flex-1">"{t.quote}"</p>
                <div className="mt-auto pt-4 flex items-center gap-3">
                  <img src={t.avatar} alt={t.name} className="h-10 w-10 rounded-full border border-white/10 grayscale group-hover:grayscale-0 transition-all" />
                  <div>
                    <p className="text-sm font-bold text-white">{t.name}</p>
                    <p className="text-xs text-neutral-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── Us vs Them Matrix ──────────────────────────────────────────────── */}
        <ComparisonMatrix />

        {/* ── Focus Demo ────────────────────────────────────────────────────── */}
        <DemoPlayer />

        {/* ── Pricing ───────────────────────────────────────────────────────── */}
        <motion.section
          className="mt-32 mb-4 w-full flex flex-col items-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="text-center mb-12 space-y-2">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Simple, transparent pricing</h2>
            <p className="text-neutral-400 text-sm sm:text-base">Invest in your focus. It pays dividends.</p>
          </div>
          <DecoyPricing />
        </motion.section>

      </main>

    </div>
  );
}

// ─── Demo Player ───────────────────────────────────────────────────────────────
function DemoPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState("0:00");
  const [duration, setDuration] = useState("0:00");
  const audioRef = useRef<HTMLAudioElement>(null);

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      setCurrentTime(fmt(el.currentTime));
      setProgress(el.duration ? (el.currentTime / el.duration) * 100 : 0);
    };
    const onMeta = () => setDuration(fmt(el.duration));
    const onEnded = () => { setIsPlaying(false); setProgress(0); setCurrentTime("0:00"); };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("ended", onEnded);
    };
  }, []);

  const toggle = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause(); setIsPlaying(false);
    } else {
      setIsLoading(true);
      try { await el.play(); setIsPlaying(true); }
      catch { /* autoplay blocked or file missing */ }
      finally { setIsLoading(false); }
    }
  };

  return (
    <motion.section
      className="mt-28 w-full max-w-4xl flex flex-col items-center"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut", delay: 0.7 }}
    >
      <audio ref={audioRef} src="/demo.mp3" preload="metadata" />
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-200">Hear the Difference</h2>
        <p className="text-neutral-500 mt-2">1.5x Speed + Brown Noise Layering.</p>
      </div>
      <Card className="w-full max-w-md bg-white/5 border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden group hover:border-indigo-500/50 transition-colors duration-500">
        <CardContent className="p-8 flex flex-col items-center justify-center space-y-6">
          <div className="relative">
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ background: "rgba(99,102,241,0.25)", filter: "blur(20px)" }}
              animate={isPlaying ? { scale: [1, 1.4, 1], opacity: [0.4, 0.7, 0.4] } : { scale: 1 }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            />
            <button
              onClick={toggle}
              aria-label={isPlaying ? "Pause demo" : "Play demo"}
              className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white text-indigo-900 hover:scale-105 active:scale-95 transition-transform duration-200 shadow-xl"
            >
              {isLoading ? <Loader2 className="h-7 w-7 animate-spin" /> :
               isPlaying ? <Pause className="h-8 w-8" fill="currentColor" /> :
                           <Play className="h-8 w-8 ml-1" fill="currentColor" />}
            </button>
          </div>
          <div className="w-full space-y-2">
            <div
              className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden cursor-pointer"
              onClick={(e) => {
                const el = audioRef.current;
                if (!el?.duration) return;
                const r = e.currentTarget.getBoundingClientRect();
                el.currentTime = ((e.clientX - r.left) / r.width) * el.duration;
              }}
            >
              <motion.div className="h-full bg-indigo-500 rounded-full" style={{ width: `${progress}%` }} transition={{ duration: 0.1 }} />
            </div>
            <div className="flex justify-between text-xs text-neutral-500 font-mono">
              <span>{currentTime}</span>
              <span>{duration || "—"}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.section>
  );
}

// ─── Pricing Slider ────────────────────────────────────────────────────────────
function PricingSlider() {
  const [activeIdx, setActiveIdx] = useState(0);
  const x = useMotionValue(0);
  const CARD_W = 384; // max-w-sm = 24rem = 384px

  const snapTo = (idx: number) => {
    setActiveIdx(idx);
    animate(x, -idx * CARD_W, { type: "spring", stiffness: 320, damping: 32 });
  };

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.velocity.x < -300 || info.offset.x < -(CARD_W / 3)) snapTo(1);
    else if (info.velocity.x > 300 || info.offset.x > (CARD_W / 3)) snapTo(0);
    else snapTo(activeIdx);
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      {/* Viewport */}
      <div className="overflow-hidden w-full max-w-sm rounded-2xl">
        <motion.div
          className="flex"
          drag="x"
          style={{ x }}
          dragConstraints={{ left: -CARD_W, right: 0 }}
          dragElastic={0.08}
          onDragEnd={handleDragEnd}
        >
          {/* ── Card 1: Monthly ── */}
          <div className="w-full max-w-sm flex-shrink-0 p-1">
            <div className="relative flex justify-center items-center rounded-2xl">
              {/* Rainbow aura — static pulse, no rotation */}
              <motion.div
                className="absolute rounded-3xl pointer-events-none"
                style={{
                  width: "145%", height: "145%",
                  background: "conic-gradient(from 45deg, #6366f1, #8b5cf6, #ec4899, #f43f5e, #f59e0b, #22c55e, #22d3ee, #3b82f6, #6366f1)",
                  filter: "blur(32px)",
                }}
                animate={{ scale: [1, 1.12, 1], opacity: [0.55, 0.85, 0.55] }}
                transition={{ duration: 3.5, ease: "easeInOut", repeat: Infinity }}
              />
              <Card className="relative w-full bg-[#0e1012] border-0 rounded-2xl overflow-hidden">
                <CardContent className="p-8 flex flex-col items-center space-y-5">
                  <motion.div
                    animate={{ scale: [1, 1.18, 1], opacity: [0.8, 1, 0.8] }}
                    transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}
                  >
                    <Brain className="h-10 w-10 text-indigo-400" />
                  </motion.div>
                  <div className="space-y-1 text-center">
                    <h3 className="text-xl font-bold text-white">Monthly</h3>
                    <p className="text-neutral-400 text-sm">100,000 characters/mo. Cancel anytime.</p>
                  </div>
                  <div className="text-5xl font-black text-white">
                    $29<span className="text-xl text-neutral-500 font-normal">/mo</span>
                  </div>
                  <form action={createCheckoutAction} className="w-full pt-2">
                    <CheckoutButton label="Start Monthly" />
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ── Card 2: 6-Month Deal (hidden, slide left to reveal) ── */}
          <div className="w-full max-w-sm flex-shrink-0 p-1">
            <div className="relative flex justify-center items-center rounded-2xl">
              {/* Gold/amber aura */}
              <motion.div
                className="absolute rounded-3xl pointer-events-none"
                style={{
                  width: "145%", height: "145%",
                  background: "conic-gradient(from 45deg, #f59e0b, #f97316, #ef4444, #f59e0b, #fbbf24, #f97316, #f59e0b)",
                  filter: "blur(32px)",
                }}
                animate={{ scale: [1, 1.14, 1], opacity: [0.5, 0.9, 0.5] }}
                transition={{ duration: 3.0, ease: "easeInOut", repeat: Infinity }}
              />
              <Card className="relative w-full bg-[#0e1012] border-0 rounded-2xl overflow-hidden">
                {/* Best Value badge */}
                <div className="absolute top-0 inset-x-0 flex justify-center">
                  <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-black text-xs font-black px-4 py-1 rounded-b-lg tracking-wide">
                    BEST VALUE — SAVE 40%
                  </div>
                </div>
                <CardContent className="pt-10 pb-8 px-8 flex flex-col items-center space-y-5">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
                    transition={{ duration: 2.0, ease: "easeInOut", repeat: Infinity }}
                  >
                    <Zap className="h-10 w-10 text-amber-400" />
                  </motion.div>
                  <div className="space-y-1 text-center">
                    <h3 className="text-xl font-bold text-white">6 Months</h3>
                    <p className="text-neutral-400 text-sm">Unlimited focus. One payment. Zero regrets.</p>
                  </div>
                  <div className="text-center">
                    <div className="text-5xl font-black text-white">
                      $69<span className="text-2xl">.99</span>
                    </div>
                    <p className="text-amber-400 text-sm font-medium mt-1">$11.67/mo — 6 months billed once</p>
                    <p className="text-neutral-600 text-xs mt-0.5 line-through">$174 if paid monthly</p>
                  </div>
                  <form action={createCheckoutAction} className="w-full pt-2">
                    <CheckoutButton label="Lock In the Deal" />
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Dot indicators + hint */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-3">
          <button onClick={() => snapTo(0)} aria-label="Monthly plan" className={`h-2 rounded-full transition-all duration-300 ${activeIdx === 0 ? "w-6 bg-indigo-500" : "w-2 bg-white/20 hover:bg-white/40"}`} />
          <button onClick={() => snapTo(1)} aria-label="6-month plan" className={`h-2 rounded-full transition-all duration-300 ${activeIdx === 1 ? "w-6 bg-amber-500" : "w-2 bg-white/20 hover:bg-white/40"}`} />
        </div>
        {activeIdx === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-1 text-xs text-neutral-600"
          >
            <ChevronLeft className="h-3 w-3" />
            swipe left for best deal
          </motion.div>
        )}
        {activeIdx === 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-1 text-xs text-neutral-600"
          >
            swipe right for monthly
            <ChevronRight className="h-3 w-3" />
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ─── Psychological Redesign Components ────────────────────────────────────────

function HeroInteractiveHook() {
  const [text, setText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleHook = () => {
    if (!text) return;
    setIsProcessing(true);
    setTimeout(() => {
      // Simulate quick processing then force signup modal open
      const btn = document.getElementById("hidden-signup-btn");
      if (btn) btn.click();
      setIsProcessing(false);
    }, 1200);
  };

  return (
    <div className="w-full max-w-lg mx-auto mt-6">
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative flex flex-col sm:flex-row items-center gap-2 p-2 bg-[#0b0d10]/80 border border-white/10 rounded-2xl backdrop-blur-xl shadow-2xl">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste a boring paragraph here..."
            className="flex-1 bg-transparent border-none text-white placeholder-neutral-500 focus:ring-0 px-4 py-3 sm:py-2 outline-none text-sm w-full"
            onKeyDown={(e) => e.key === "Enter" && handleHook()}
          />
          <Button
            onClick={handleHook}
            disabled={isProcessing || !text}
            className="w-full sm:w-auto rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-12 sm:h-10 px-6 whitespace-nowrap transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_30px_rgba(99,102,241,0.6)]"
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <span className="flex items-center gap-2">
                Make it Dopamine <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </Button>
          <div className="hidden">
            <SignUpButton mode="modal" fallbackRedirectUrl="/onboarding">
              <button id="hidden-signup-btn">hidden</button>
            </SignUpButton>
          </div>
        </div>
      </div>
      <p className="text-xs text-neutral-500 mt-3 text-center">
        Try it free. No credit card required.
      </p>
    </div>
  );
}

function PainSection() {
  return (
    <motion.section 
      className="mt-32 w-full max-w-4xl px-4 flex flex-col items-center"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8 }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-white/[0.02] border border-red-500/10 rounded-3xl p-8 md:p-12 shadow-2xl">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider">
            <Clock className="h-3 w-3" /> The Cost of Drifting
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            You are wasting <span className="text-red-400">14 hours a week</span> re-reading things your brain refuses to absorb.
          </h2>
          <p className="text-neutral-400 text-lg leading-relaxed">
            That is a part-time job you aren't getting paid for. Every time your eyes scan a page but your mind is somewhere else, you lose momentum, energy, and time you can never get back.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <Card className="bg-[#080a0c] border-white/5 shadow-inner">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <XCircle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Traditional Reading</p>
                <p className="text-xs text-neutral-500 mt-1">High friction, low retention, easy to abandon.</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[#080a0c] border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.1)]">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                <Brain className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">FocusReader</p>
                <p className="text-xs text-neutral-500 mt-1">Optimized audio delivery for immediate flow state.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.section>
  );
}

function AuthorityBanner() {
  return (
    <div className="w-full border-y border-white/5 bg-white/[0.01] py-8 my-20 flex flex-col items-center justify-center">
      <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-6 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4" /> Trusted by 10,000+ students and professionals at
      </p>
      <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-40 grayscale select-none">
        {/* Mocked logos using text for now to simulate the aesthetic */}
        <span className="text-xl font-black font-serif">HARVARD</span>
        <span className="text-xl font-bold font-sans">STANFORD</span>
        <span className="text-xl font-black italic tracking-tighter">MIT</span>
        <span className="text-xl font-black font-serif">Yale</span>
        <span className="text-xl font-bold tracking-widest">NYU</span>
      </div>
    </div>
  );
}

function DecoyPricing() {
  return (
    <div className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch px-4">
      {/* ── Tier 1: Monthly ── */}
      <Card className="bg-[#0b0d10] border-white/10 flex flex-col transition-all duration-300 hover:border-white/20">
        <CardContent className="p-8 flex flex-col h-full space-y-6">
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white">Monthly</h3>
            <p className="text-neutral-500 text-sm">For short-term projects.</p>
          </div>
          <div className="text-4xl font-black text-white">
            $29<span className="text-xl text-neutral-500 font-normal">/mo</span>
          </div>
          <ul className="space-y-3 text-sm text-neutral-300 flex-1 mt-4">
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-indigo-400" /> 100,000 chars/month</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-indigo-400" /> All premium voices</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-indigo-400" /> Cancel anytime</li>
          </ul>
          <form action={createCheckoutAction} className="w-full pt-4 mt-auto">
            <Button type="submit" className="w-full bg-white/10 hover:bg-white/20 text-white font-semibold h-11">
              Start Monthly
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Tier 2: 6 Months (The Irrational Steal) ── */}
      <div className="relative md:-translate-y-8 md:scale-105 z-10 mt-6 md:mt-0">
        <div className="absolute -inset-1 rounded-2xl bg-[linear-gradient(45deg,theme(colors.indigo.500),theme(colors.violet.500),theme(colors.cyan.400),theme(colors.indigo.500))] bg-[length:200%_auto] animate-[rainbow_4s_linear_infinite] opacity-60 blur-lg"></div>
        
        {/* Badge moved outside the Card so overflow-hidden doesn't clip it */}
        <div className="absolute top-0 inset-x-0 flex justify-center -translate-y-1/2 z-50">
          <span className="bg-[#111] border border-indigo-500/50 text-indigo-300 text-[10px] sm:text-xs font-black px-6 py-2 rounded-full tracking-[0.15em] shadow-[0_0_20px_rgba(99,102,241,0.4)] flex items-center gap-2">
            <Zap className="h-4 w-4 fill-indigo-400 text-indigo-400" /> BEST VALUE — SAVE 40% <Zap className="h-4 w-4 fill-indigo-400 text-indigo-400" />
          </span>
        </div>

        <Card className="relative bg-[#0b0d10] border border-indigo-500/30 h-full flex flex-col shadow-[0_0_40px_rgba(99,102,241,0.15)] overflow-hidden">
          {/* Shine effect overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent opacity-50 pointer-events-none"></div>
          
          <CardContent className="p-8 flex flex-col h-full space-y-6 pt-12">
            <div className="space-y-2 text-center">
              <h3 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 to-violet-300 drop-shadow-sm">6 Months</h3>
              <p className="text-neutral-400 text-sm font-bold">Unlimited focus. Zero regrets.</p>
            </div>
            <div className="text-center relative">
              <div className="text-6xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">$69<span className="text-3xl text-neutral-400">.99</span></div>
              <div className="absolute -right-2 top-0 rotate-6 border border-indigo-500/50 bg-indigo-500/10 text-indigo-300 text-[10px] font-black px-2 py-1 rounded-md shadow-lg backdrop-blur-md">STEAL</div>
              <p className="text-indigo-400 text-sm font-bold mt-3 tracking-wide">$11.67/mo — billed once</p>
              <p className="text-neutral-600 text-xs mt-1 line-through font-medium">$174 if paid monthly</p>
            </div>
            <ul className="space-y-4 text-sm text-neutral-200 flex-1 mt-6 bg-[#131619]/50 p-5 rounded-2xl border border-white/5">
              <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-indigo-400" /> <strong>600,000</strong> total chars</li>
              <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-indigo-400" /> Highest priority queue</li>
              <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-indigo-400" /> Hyperfocus Vault included</li>
            </ul>
            <form action={createCheckoutAction} className="w-full pt-6 mt-auto">
              <Button type="submit" className="relative group w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-lg h-14 rounded-xl shadow-[0_0_25px_rgba(99,102,241,0.4)] transition-all overflow-hidden border border-indigo-400/20">
                <span className="relative z-10 flex items-center justify-center gap-2">
                  UNLOCK HYPERFOCUS <Zap className="h-5 w-5 fill-white/80 text-transparent" />
                </span>
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* ── Tier 3: The Decoy ── */}
      <Card className="bg-[#080a0c] border-white/5 flex flex-col opacity-60 hover:opacity-100 transition-opacity duration-300">
        <CardContent className="p-8 flex flex-col h-full space-y-6">
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-neutral-400">Therapy / Tutoring</h3>
            <p className="text-neutral-600 text-sm">The traditional cost of ADHD.</p>
          </div>
          <div className="text-4xl font-black text-neutral-500">
            $150<span className="text-xl text-neutral-600 font-normal">/hr</span>
          </div>
          <ul className="space-y-3 text-sm text-neutral-500 flex-1 mt-4">
            <li className="flex items-center gap-2"><XCircle className="h-4 w-4 text-red-900/50" /> High friction</li>
            <li className="flex items-center gap-2"><XCircle className="h-4 w-4 text-red-900/50" /> Expensive over time</li>
            <li className="flex items-center gap-2"><XCircle className="h-4 w-4 text-red-900/50" /> Not available at 2 AM</li>
          </ul>
          <div className="w-full pt-4 mt-auto">
            <Button disabled className="w-full bg-white/5 text-neutral-600 font-semibold h-11 border border-white/5">
              Not Recommended
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ComparisonMatrix() {
  return (
    <motion.section
      className="mt-32 w-full max-w-5xl px-4 flex flex-col items-center"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
    >
      <div className="text-center mb-12 space-y-2">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">The ADHD Tool Landscape</h2>
        <p className="text-neutral-400 text-sm sm:text-base">Why cobble together 3 apps when you can use 1?</p>
      </div>

      <div className="w-full overflow-x-auto rounded-2xl border border-white/10 bg-[#0b0d10] shadow-2xl">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr>
              <th className="p-6 border-b border-white/10 text-neutral-400 font-medium">Feature</th>
              <th className="p-6 border-b border-white/10 bg-indigo-500/10 text-indigo-300 font-bold border-x border-x-indigo-500/20 text-center w-1/4">FocusReader</th>
              <th className="p-6 border-b border-white/10 text-neutral-500 font-medium text-center w-1/4">Generic TTS Apps<br/><span className="text-xs text-neutral-600 font-normal">(e.g. Speechify)</span></th>
              <th className="p-6 border-b border-white/10 text-neutral-500 font-medium text-center w-1/4">Focus Music Apps<br/><span className="text-xs text-neutral-600 font-normal">(e.g. Brain.fm)</span></th>
            </tr>
          </thead>
          <tbody className="text-sm">
            <tr className="border-b border-white/5">
              <td className="p-6 text-white font-medium">Reads your documents</td>
              <td className="p-6 bg-indigo-500/5 border-x border-x-indigo-500/10 text-center"><CheckCircle2 className="h-5 w-5 mx-auto text-indigo-400" /></td>
              <td className="p-6 text-center"><CheckCircle2 className="h-5 w-5 mx-auto text-neutral-500" /></td>
              <td className="p-6 text-center"><XCircle className="h-5 w-5 mx-auto text-neutral-700" /></td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="p-6 text-white font-medium">Built-in Brown Noise Floor</td>
              <td className="p-6 bg-indigo-500/5 border-x border-x-indigo-500/10 text-center"><CheckCircle2 className="h-5 w-5 mx-auto text-indigo-400" /></td>
              <td className="p-6 text-center"><XCircle className="h-5 w-5 mx-auto text-neutral-700" /></td>
              <td className="p-6 text-center"><CheckCircle2 className="h-5 w-5 mx-auto text-neutral-500" /></td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="p-6 text-white font-medium">Zero-Friction Interface</td>
              <td className="p-6 bg-indigo-500/5 border-x border-x-indigo-500/10 text-center"><CheckCircle2 className="h-5 w-5 mx-auto text-indigo-400" /></td>
              <td className="p-6 text-center"><XCircle className="h-5 w-5 mx-auto text-neutral-700" /></td>
              <td className="p-6 text-center"><CheckCircle2 className="h-5 w-5 mx-auto text-neutral-500" /></td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="p-6 text-white font-medium">Price</td>
              <td className="p-6 bg-indigo-500/10 border-x border-x-indigo-500/20 text-center text-white font-bold">$11.67 / mo</td>
              <td className="p-6 text-center text-neutral-500">~$11.58 / mo</td>
              <td className="p-6 text-center text-neutral-500">~$6.99 / mo</td>
            </tr>
            <tr>
              <td className="p-6 text-white font-medium">Total Cost to Focus</td>
              <td className="p-6 bg-indigo-500/10 border-x border-x-indigo-500/20 text-center text-indigo-300 font-black text-lg">$11.67</td>
              <td className="p-6 text-center text-neutral-500" colSpan={2}>
                $18.57 / mo <br/><span className="text-xs font-normal text-neutral-600">(if you buy both)</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </motion.section>
  );
}

