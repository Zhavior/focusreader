"use client";

import { useState } from "react";
import Link from "next/link";
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

function ReaderPreview() {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="relative mx-auto w-full max-w-[620px]">
      <div className="absolute -inset-16 -z-10 rounded-full bg-white/[0.02] blur-3xl" />

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

            <div className="mt-7 rounded-lg border border-white/10 bg-black/15 p-4 text-sm leading-7 text-[#91959f]">
              Working memory helps us hold and organize information while
              completing a task. When cognitive load rises,
              <span className="rounded bg-[#d9d7cf] px-1.5 py-0.5 font-medium text-[#111216]">
                {" "}
                clear structure can reduce the effort required to stay oriented.
              </span>
            </div>

            <div className="mt-6">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                <div className="h-full w-[38%] rounded-full bg-[#d9d7cf]" />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-[#6f737d]">
                <span>08:42</span>
                <span>22:18</span>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPlaying((value) => !value)}
                aria-label={playing ? "Pause interface preview" : "Play interface preview"}
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
                  {playing ? "Previewing player state" : "Interface preview paused"}
                </p>
                <p className="mt-0.5 text-xs text-[#777b84]">
                  Demo interaction · no audio plays
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#70747e]">
              Session
            </p>
            <div className="mt-5 space-y-5">
              <div>
                <p className="text-2xl font-semibold tracking-[-0.04em] text-[#efeee9]">
                  38%
                </p>
                <p className="mt-1 text-xs text-[#747881]">Reading complete</p>
              </div>
              <div className="h-px bg-white/[0.07]" />
              <div>
                <p className="text-sm font-medium text-[#d5d4cf]">Place saved</p>
                <p className="mt-1 text-xs leading-5 text-[#777b84]">
                  Come back without finding your spot again.
                </p>
              </div>
              <div className="h-px bg-white/[0.07]" />
              <div className="flex items-center gap-2 text-xs text-[#969aa3]">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                Calm mode on
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
      : { opacity: 0, y: 18, filter: "blur(10px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-[#efeee9] selection:bg-white/20">
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
        <section className="relative mx-auto grid min-h-[calc(100vh-80px)] max-w-[1440px] items-center gap-12 px-5 pb-16 pt-10 sm:px-8 sm:pt-16 lg:grid-cols-[0.82fr_1.18fr] lg:px-10 lg:pb-20 lg:pt-8">
          <div className="relative z-10 max-w-[42rem]">
            <motion.div
              {...reveal}
              transition={{ duration: 0.75, ease }}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a4a7af]"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Reading, made listenable
            </motion.div>

            <motion.h1
              {...reveal}
              transition={{
                duration: 0.9,
                delay: reducedMotion ? 0 : 0.08,
                ease,
              }}
              className="mt-7 text-[clamp(3.2rem,7vw,6.6rem)] font-black leading-[0.92] tracking-[-0.055em] text-[#f4f3ef] antialiased"
            >
              Turn dense readings into audio you can actually finish.
            </motion.h1>

            <motion.p
              {...reveal}
              transition={{
                duration: 0.85,
                delay: reducedMotion ? 0 : 0.16,
                ease,
              }}
              className="mt-7 max-w-xl text-base leading-7 text-[#979aa3] sm:text-lg sm:leading-8"
            >
              Upload a PDF, article, or study document and listen in a natural
              voice—without fighting through another wall of text.
            </motion.p>

            <motion.div
              {...reveal}
              transition={{
                duration: 0.85,
                delay: reducedMotion ? 0 : 0.24,
                ease,
              }}
              className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center"
            >
              <PrimaryAction signedIn={Boolean(isSignedIn)} />
              <a
                href="#how-it-works"
                className="group inline-flex min-h-12 items-center gap-2 rounded-full px-2 text-sm font-medium text-[#a8abb3] transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
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
              className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#747882]"
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
            initial={
              reducedMotion
                ? { opacity: 1 }
                : { opacity: 0, x: 22, filter: "blur(12px)" }
            }
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            transition={{
              duration: 1,
              delay: reducedMotion ? 0 : 0.18,
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
