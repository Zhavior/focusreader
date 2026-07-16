"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { buildWordTimings, wordIndexAt } from "@/lib/karaoke";
import {
  FOCUS_SOUNDSCAPE_PRESETS,
  FocusSoundscapeEngine,
  type FocusSoundscapeId,
} from "@/lib/audio/FocusSoundscapeEngine";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Check,
  ChevronRight,
  FileText,
  Headphones,
  LockKeyhole,
  Pause,
  Play,
  Sparkles,
  Upload,
  Volume2,
} from "lucide-react";
import { SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/nextjs";
import Footer from "@/components/Footer";

const ease = [0.16, 1, 0.3, 1] as const;

const steps = [
  {
    number: "01",
    title: "Upload your reading",
    description:
      "Add a PDF, article, or study document without setting up a complicated workspace.",
    icon: Upload,
  },
  {
    number: "02",
    title: "Choose your voice",
    description:
      "Pick a natural voice and playback pace that feels comfortable to follow.",
    icon: Volume2,
  },
  {
    number: "03",
    title: "Press play",
    description:
      "Listen while FocusReader keeps your place and makes progress easy to see.",
    icon: Headphones,
  },
];

const trustPoints = [
  "Your reading stays private.",
  "No long setup before your first listen.",
  "Sound and motion stay under your control.",
];

const comparisonRows = [
  {
    feature: "Spoken-word follow-along",
    focusReader: "Built into the reader",
    basicTts: "Usually audio only",
  },
  {
    feature: "Focus soundscapes",
    focusReader: "Built in and optional",
    basicTts: "Not typically included",
  },
  {
    feature: "Distraction-light reading view",
    focusReader: "Core experience",
    basicTts: "Not the main focus",
  },
  {
    feature: "Upload-to-listen workflow",
    focusReader: "PDFs, articles, and study material",
    basicTts: "Varies by tool",
  },
];

const landingPlans = [
  {
    name: "Monthly",
    price: "$19.99",
    detail: "per month",
    note: "100,000 characters each month",
    badge: null,
  },
  {
    name: "6 months",
    price: "$89.99",
    detail: "billed once",
    note: "About $15/month · Save 25%",
    badge: "Popular",
  },
  {
    name: "2 years",
    price: "$199.99",
    detail: "billed once",
    note: "About $8.33/month · Save 58%",
    badge: "Best value",
  },
];

function PrimaryAction({ signedIn }: { signedIn: boolean }) {
  const className =
    "group inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-white px-6 text-sm font-medium text-black transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-black";

  const content = (
    <>
      <Upload className="h-4 w-4" aria-hidden="true" />
      {signedIn ? "Upload a reading" : "Start with a reading"}
      <ArrowRight
        className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
        aria-hidden="true"
      />
    </>
  );

  if (signedIn) {
    return (
      <Link href="/dashboard" className={className}>
        {content}
      </Link>
    );
  }

  return (
    <SignUpButton mode="modal" fallbackRedirectUrl="/dashboard">
      <button type="button" className={className}>
        {content}
      </button>
    </SignUpButton>
  );
}

function PricingAction({
  signedIn,
  label,
}: {
  signedIn: boolean;
  label: string;
}) {
  const className =
    "inline-flex min-h-11 w-full items-center justify-center rounded-md border border-white/15 bg-white px-5 text-sm font-semibold text-black transition hover:scale-[0.99] hover:bg-[#e9eee8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";

  if (signedIn) {
    return (
      <Link href="/dashboard/billing" className={className}>
        {label}
      </Link>
    );
  }

  return (
    <SignUpButton mode="modal" fallbackRedirectUrl="/dashboard/billing">
      <button type="button" className={className}>
        {label}
      </button>
    </SignUpButton>
  );
}

const DEMO_TEXT =
  "Reading takes more than recognizing words. It requires holding your place, filtering distractions, and returning when attention moves. FocusReader turns dense material into clear narration while keeping the current passage visible, so you can stay oriented and continue without starting over.";

function ReaderPreview() {
  const [playing, setPlaying] = useState(false);
  const [selectedSoundscape, setSelectedSoundscape] =
    useState<FocusSoundscapeId | null>("deep-brown");
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wordsRef = useRef<HTMLDivElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const elapsedRef = useRef<HTMLSpanElement | null>(null);
  const karaokeFrameRef = useRef<number | null>(null);
  const soundscapeEngineRef = useRef<FocusSoundscapeEngine | null>(null);
  const selectedSoundscapeRef = useRef<FocusSoundscapeId | null>(
    "deep-brown"
  );
  const demoTokens = useMemo(() => buildWordTimings(DEMO_TEXT), []);

  const getSoundscapeEngine = () => {
    if (!soundscapeEngineRef.current) {
      soundscapeEngineRef.current = new FocusSoundscapeEngine();
    }

    return soundscapeEngineRef.current;
  };

  const stopSoundscape = () => {
    soundscapeEngineRef.current?.stop();
  };

  const startSoundscape = async () => {
    const preset = selectedSoundscapeRef.current;
    if (!preset) return;

    await getSoundscapeEngine().play(preset);
  };

  const stopKaraoke = () => {
    if (karaokeFrameRef.current !== null) {
      cancelAnimationFrame(karaokeFrameRef.current);
      karaokeFrameRef.current = null;
    }
  };

  const startKaraoke = () => {
    stopKaraoke();

    let lastWordIndex = -1;

    const step = () => {
      const audio = audioRef.current;

      if (!audio || audio.paused || audio.ended) {
        karaokeFrameRef.current = null;
        return;
      }

      const validDuration =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : 0;

      if (validDuration > 0) {
        const fraction = Math.min(
          1,
          Math.max(0, audio.currentTime / validDuration)
        );

        const nextWordIndex = wordIndexAt(demoTokens, fraction);

        if (nextWordIndex !== lastWordIndex) {
          const previousWord =
            lastWordIndex >= 0
              ? wordsRef.current?.querySelector<HTMLElement>(
                  `[data-word-index="${lastWordIndex}"]`
                )
              : null;

          const nextWord = wordsRef.current?.querySelector<HTMLElement>(
            `[data-word-index="${nextWordIndex}"]`
          );

          previousWord?.classList.remove("active");
          nextWord?.classList.add("active");
          lastWordIndex = nextWordIndex;
        }

        if (progressBarRef.current) {
          progressBarRef.current.style.transform =
            `scaleX(${Math.max(fraction, 0.02)})`;
        }

        if (elapsedRef.current) {
          elapsedRef.current.textContent = formatTime(audio.currentTime);
        }
      }

      karaokeFrameRef.current = requestAnimationFrame(step);
    };

    karaokeFrameRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const syncMetadata = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };

    const handlePlay = () => {
      setPlaying(true);
      startKaraoke();
      void startSoundscape();
    };

    const handlePause = () => {
      setPlaying(false);
      stopKaraoke();
      stopSoundscape();
    };

    const handleEnded = () => {
      stopKaraoke();
      stopSoundscape();
      setPlaying(false);

      wordsRef.current
        ?.querySelectorAll<HTMLElement>("[data-word-index].active")
        .forEach((word) => word.classList.remove("active"));

      audio.currentTime = 0;

      if (progressBarRef.current) {
        progressBarRef.current.style.transform = "scaleX(0.02)";
      }

      if (elapsedRef.current) {
        elapsedRef.current.textContent = "0:00";
      }
    };

    audio.addEventListener("loadedmetadata", syncMetadata);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      stopKaraoke();
      stopSoundscape();
      void soundscapeEngineRef.current?.dispose();
      soundscapeEngineRef.current = null;
      audio.removeEventListener("loadedmetadata", syncMetadata);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [demoTokens]);

  const toggleAudio = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    } else {
      audio.pause();
      setPlaying(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remaining = Math.floor(seconds % 60);
    return `${minutes}:${remaining.toString().padStart(2, "0")}`;
  };

  return (
    <div className="relative mx-auto w-full max-w-[620px]">
      <audio ref={audioRef} preload="metadata" src="/audio/focusreader-demo.mp3" />
      <div className="absolute -inset-16 -z-10 rounded-full bg-[rgba(157,179,155,0.065)] blur-3xl" />

      <div className="overflow-hidden rounded-lg border border-white/10 bg-[#0d0e11]/96 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-3xl translate-z-0">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/[0.04]">
              <FileText className="h-5 w-5 text-[#d9d9d5]" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#f0efeb]">
                Cognitive Psychology — Week 4.pdf
              </p>
              <p className="mt-0.5 text-xs text-[#7f838d]">
                32 pages · Ready to listen
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-[#a4a7af] sm:flex">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Interface preview
          </div>
        </div>

        <div className="grid gap-6 p-5 sm:p-7 md:grid-cols-[1fr_176px]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#757984]">
              Now listening
            </p>
            <h3 className="mt-3 max-w-md text-xl font-semibold leading-snug tracking-[-0.025em] text-[#f1f0ec] sm:text-2xl">
              How working memory shapes sustained attention
            </h3>

            <div
              ref={wordsRef}
              className="landing-focus-passage mt-7 rounded-lg border border-white/10 bg-black/15 p-4 pl-7 text-sm leading-7 text-[#91959f]"
              aria-label={DEMO_TEXT}
            >
              <span className="landing-focus-rail" aria-hidden="true" />
              {demoTokens.map((token, index) => (
                <span key={`${token.word}-${index}`}>
                  <span
                    data-word-index={index}
                    className="landing-karaoke-word inline rounded px-0.5 text-[#a6a9b1]"
                  >
                    {token.word}
                  </span>{" "}
                </span>
              ))}
            </div>

            <div className="mt-6">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  ref={progressBarRef}
                  className="h-full origin-left scale-x-[0.02] rounded-full bg-[#9db39b] shadow-[0_0_18px_rgba(157,179,155,0.18)] will-change-transform"
                />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-[#6f737d]">
                <span ref={elapsedRef}>0:00</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={toggleAudio}
                aria-label={playing ? "Pause audio sample" : "Play audio sample"}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-[#efeee9] text-[#111216] transition hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {playing ? (
                  <Pause className="h-5 w-5" fill="currentColor" />
                ) : (
                  <Play className="ml-0.5 h-5 w-5" fill="currentColor" />
                )}
              </button>
              <div>
                <p className="text-sm font-medium text-[#e2e1dc]">
                  {playing ? "Playing audio sample" : "Hear a short sample"}
                </p>
                <p className="mt-0.5 text-xs text-[#777b84]">
                  Real FocusReader narration
                </p>

                <div className="mt-3">
                  <p className="text-[11px] text-[#777b84]">
                    Choose a background that feels comfortable.
                  </p>

                  <div
                    className="mt-2 flex max-w-md flex-wrap gap-1.5"
                    role="group"
                    aria-label="Background soundscape"
                  >
                    <button
                      type="button"
                      aria-pressed={selectedSoundscape === null}
                      onClick={() => {
                        selectedSoundscapeRef.current = null;
                        setSelectedSoundscape(null);
                        stopSoundscape();
                      }}
                      className={[
                        "min-h-8 rounded-md border px-2.5 text-[11px] font-medium transition",
                        selectedSoundscape === null
                          ? "border-[#9db39b]/50 bg-[#9db39b]/[0.12] text-[#dce8da]"
                          : "border-white/10 bg-white/[0.02] text-[#858993] hover:border-white/20 hover:text-[#d9d7cf]",
                      ].join(" ")}
                    >
                      Off
                    </button>

                    {FOCUS_SOUNDSCAPE_PRESETS.map((preset) => {
                      const active = selectedSoundscape === preset.id;

                      return (
                        <button
                          key={preset.id}
                          type="button"
                          aria-pressed={active}
                          title={preset.description}
                          onClick={() => {
                            selectedSoundscapeRef.current = preset.id;
                            setSelectedSoundscape(preset.id);

                            if (playing) {
                              void getSoundscapeEngine().play(preset.id);
                            }
                          }}
                          className={[
                            "min-h-8 rounded-md border px-2.5 text-[11px] font-medium transition",
                            active
                              ? "border-[#9db39b]/50 bg-[#9db39b]/[0.12] text-[#dce8da]"
                              : "border-white/10 bg-white/[0.02] text-[#858993] hover:border-white/20 hover:text-[#d9d7cf]",
                          ].join(" ")}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#70747e]">
              Live demo
            </p>

            <div className="mt-5 space-y-5">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={[
                      "h-2 w-2 rounded-full",
                      playing ? "bg-[#9db39b]" : "bg-[#666a73]",
                    ].join(" ")}
                  />
                  <p className="text-sm font-medium text-[#dce8da]">
                    {playing ? "Playing now" : "Ready to play"}
                  </p>
                </div>
                <p className="mt-2 text-xs text-[#747881]">
                  {duration > 0 ? `${formatTime(duration)} sample` : "Audio sample"}
                </p>
              </div>

              <div className="h-px bg-white/[0.07]" />

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#70747e]">
                  Background
                </p>
                <p className="mt-2 text-sm font-medium text-[#d5d4cf]">
                  {selectedSoundscape === null
                    ? "Off"
                    : FOCUS_SOUNDSCAPE_PRESETS.find(
                        (preset) => preset.id === selectedSoundscape
                      )?.label ?? "Selected"}
                </p>
              </div>

              <div className="h-px bg-white/[0.07]" />

              <div>
                <p className="text-sm font-medium text-[#d5d4cf]">
                  Spoken-word follow-along
                </p>
                <p className="mt-1 text-xs leading-5 text-[#777b84]">
                  The active word stays visible as narration moves.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const reducedMotion = useReducedMotion();

  const reveal = {
    initial: reducedMotion
      ? { opacity: 1 }
      : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
  };

  return (
    <div className="landing-shell min-h-screen overflow-x-hidden bg-[#08090b] text-[#efeee9] selection:bg-[#9db39b]/30">
      <header className="relative z-50 mx-auto flex max-w-[1440px] items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <Link href="/" className="flex items-center gap-3" aria-label="FocusReader home">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.05]">
            <Headphones className="h-4 w-4" aria-hidden="true" />
          </div>
          <span className="text-sm font-semibold tracking-[-0.02em]">
            FocusReader
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {!isLoaded ? null : !isSignedIn ? (
            <>
              <SignInButton mode="modal">
                <button className="rounded-full px-3 py-2 text-sm text-[#a4a7af] transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:px-4">
                  Log in
                </button>
              </SignInButton>
              <SignUpButton mode="modal" fallbackRedirectUrl="/dashboard">
                <button className="rounded-full border border-white/[0.11] bg-white/[0.06] px-4 py-2 text-sm font-medium transition hover:bg-white/[0.10] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:px-5">
                  Get started
                </button>
              </SignUpButton>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <UserButton />
              <Link
                href="/dashboard"
                className="rounded-md border border-white/[0.11] bg-white/[0.06] px-4 py-2 text-sm font-medium transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Open reader
              </Link>
            </div>
          )}
        </div>
      </header>

      <main>
        <section className="landing-hero relative mx-auto grid min-h-[calc(100vh-80px)] max-w-[1440px] items-center gap-10 px-5 pb-16 pt-4 sm:px-8 sm:pt-10 lg:grid-cols-[0.96fr_1.04fr] lg:px-10 lg:pb-16 lg:pt-0">
          <div className="relative z-10 max-w-[47rem]">
            <motion.div
              {...reveal}
              transition={{ duration: 0.42, ease }}
              className="inline-flex items-center gap-2 rounded-full border border-[#9db39b]/25 bg-[#9db39b]/[0.07] px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b8cbb6]"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#9db39b]" aria-hidden="true" />
              Listen · Follow · Finish
            </motion.div>

            <motion.h1
              {...reveal}
              transition={{
                duration: 0.5,
                delay: reducedMotion ? 0 : 0.08,
                ease,
              }}
              className="mt-6 text-[clamp(3.1rem,5.6vw,5.7rem)] font-black leading-[0.94] tracking-[-0.05em] text-[#f4f3ef] antialiased"
            >
              Turn dense readings into audio you can actually finish.
            </motion.h1>

            <motion.p
              {...reveal}
              transition={{
                duration: 0.48,
                delay: reducedMotion ? 0 : 0.16,
                ease,
              }}
              className="mt-6 max-w-2xl text-base leading-7 text-[#b0b3bb] sm:text-lg sm:leading-8"
            >
              Upload a PDF, article, or study document and listen in a natural
              voice—without fighting through another wall of text.
            </motion.p>

            <motion.div
              {...reveal}
              transition={{
                duration: 0.48,
                delay: reducedMotion ? 0 : 0.24,
                ease,
              }}
              className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center"
            >
              <PrimaryAction signedIn={Boolean(isSignedIn)} />
              <a
                href="#how-it-works"
                className="group inline-flex min-h-12 items-center gap-2 rounded-md border border-white/10 px-4 text-sm font-medium text-[#b8bbc2] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[0.98] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                See how it works
                <ChevronRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </a>
            </motion.div>

            <motion.div
              {...reveal}
              transition={{
                duration: 0.85,
                delay: reducedMotion ? 0 : 0.32,
                ease,
              }}
              className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-[#8f939c]"
            >
              {trustPoints.map((point) => (
                <span key={point} className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  {point}
                </span>
              ))}
            </motion.div>
          </div>

          <motion.div
            className="lg:-translate-y-2 lg:scale-[1.03]"
            initial={
              reducedMotion
                ? { opacity: 1 }
                : { opacity: 0, x: 24, scale: 0.985 }
            }
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{
              duration: 0.58,
              delay: reducedMotion ? 0 : 0.14,
              ease,
            }}
          >
            <ReaderPreview />
          </motion.div>
        </section>

        <section
          id="how-it-works"
          className="border-y border-white/10 bg-white/[0.01]"
        >
          <div className="mx-auto max-w-[1440px] px-5 py-24 sm:px-8 lg:px-10 lg:py-28">
            <div className="max-w-2xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#777b84]">
                How it works
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[#eeede9] sm:text-5xl">
                Three steps. Nothing to figure out first.
              </h2>
            </div>

            <div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 md:grid-cols-3">
              {steps.map(({ number, title, description, icon: Icon }) => (
                <article key={number} className="bg-[#0a0a0b] p-7 sm:p-8">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#666a73]">
                      {number}
                    </span>
                    <Icon className="h-5 w-5 text-[#aaaeb6]" aria-hidden="true" />
                  </div>
                  <h3 className="mt-12 text-xl font-semibold tracking-[-0.025em] text-[#e9e8e4]">
                    {title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[#858992]">
                    {description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="pricing"
          className="border-b border-white/10 bg-white/[0.012]"
        >
          <div className="mx-auto max-w-[1440px] px-5 py-24 sm:px-8 lg:px-10 lg:py-32">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#8da393]">
                  Why FocusReader
                </p>
                <h2 className="mt-4 max-w-xl text-3xl font-black tracking-[-0.04em] text-[#f3f2ee] sm:text-5xl">
                  More than text turned into audio.
                </h2>
                <p className="mt-5 max-w-xl text-base leading-7 text-[#8e929b]">
                  Basic text-to-speech helps you hear the words. FocusReader is
                  designed around staying connected to the reading while it plays.
                </p>
              </div>

              <div className="overflow-hidden rounded-lg border border-white/10">
                <div className="grid grid-cols-[1.25fr_1fr_1fr] bg-white/[0.04] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#777b84] sm:px-6">
                  <span>Experience</span>
                  <span>FocusReader</span>
                  <span>Basic TTS</span>
                </div>

                {comparisonRows.map((row) => (
                  <div
                    key={row.feature}
                    className="grid grid-cols-[1.25fr_1fr_1fr] gap-3 border-t border-white/10 px-4 py-4 text-xs sm:px-6 sm:text-sm"
                  >
                    <span className="font-medium text-[#e5e4df]">
                      {row.feature}
                    </span>
                    <span className="text-[#a8c0ad]">{row.focusReader}</span>
                    <span className="text-[#747881]">{row.basicTts}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-24">
              <div className="max-w-2xl">
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#8da393]">
                  Transparent beta pricing
                </p>
                <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] text-[#f3f2ee] sm:text-5xl">
                  Choose the commitment that fits.
                </h2>
                <p className="mt-5 text-sm leading-7 text-[#8e929b] sm:text-base">
                  Every paid option includes 100,000 text-to-voice characters
                  each month. No mystery pricing after signup.
                </p>
              </div>

              <div className="mt-12 grid gap-4 lg:grid-cols-3">
                {landingPlans.map((plan) => (
                  <article
                    key={plan.name}
                    className={`relative flex min-h-[330px] flex-col rounded-lg border p-7 ${
                      plan.badge === "Best value"
                        ? "border-[#8da393]/60 bg-[#101512]"
                        : "border-white/10 bg-[#0b0b0d]"
                    }`}
                  >
                    {plan.badge && (
                      <span className="absolute right-5 top-5 rounded-full border border-[#8da393]/35 bg-[#8da393]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#aec3b2]">
                        {plan.badge}
                      </span>
                    )}

                    <p className="text-sm font-semibold text-[#d9d8d3]">
                      {plan.name}
                    </p>

                    <div className="mt-10">
                      <span className="text-4xl font-black tracking-[-0.04em] text-white">
                        {plan.price}
                      </span>
                      <p className="mt-2 text-xs text-[#747881]">
                        {plan.detail}
                      </p>
                    </div>

                    <div className="mt-8 flex items-start gap-2 text-sm leading-6 text-[#9b9fa7]">
                      <Check
                        className="mt-1 h-4 w-4 shrink-0 text-[#9ab09f]"
                        aria-hidden="true"
                      />
                      <span>{plan.note}</span>
                    </div>

                    <div className="mt-auto pt-10">
                      <PricingAction
                        signedIn={Boolean(isSignedIn)}
                        label={
                          plan.name === "Monthly"
                            ? "Start monthly"
                            : `Choose ${plan.name}`
                        }
                      />
                    </div>
                  </article>
                ))}
              </div>

              <p className="mt-6 text-center text-xs text-[#686c74]">
                Cancel recurring plans from your billing portal. Payments are
                processed securely by Stripe.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-5 py-24 sm:px-8 lg:px-10 lg:py-32">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#777b84]">
                Built for calm momentum
              </p>
              <h2 className="mt-4 max-w-xl text-3xl font-black tracking-[-0.04em] text-[#f3f2ee] sm:text-5xl">
                A reader that keeps the path steady.
              </h2>
            </div>
            <div className="space-y-5 text-base leading-7 text-[#8e929b]">
              <p>
                FocusReader reduces the setup, choices, and visual noise between
                you and the material you need to understand.
              </p>
              <p>
                Progress stays visible, your place stays saved, and the
                interface does not demand more attention than the reading itself.
              </p>
            </div>
          </div>

          <div className="mt-20 rounded-lg border border-white/10 bg-[#0b0b0d] px-6 py-12 text-center sm:px-10 sm:py-16">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#777b84]">
              Start with one reading
            </p>
            <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-black tracking-[-0.04em] text-[#f3f2ee] sm:text-5xl">
              You do not need to set everything up today.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-[#8b8f98] sm:text-base">
              Upload one document, choose one voice, and begin from there.
            </p>
            <div className="mt-8 flex justify-center">
              <PrimaryAction signedIn={Boolean(isSignedIn)} />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
