"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  School,
  BookOpen,
  Award,
  BrainCircuit,
  RefreshCcw,
  Wind,
  Play,
  FileText,
  Newspaper,
  ScrollText,
  Globe,
  Timer,
  AlarmClock,
  Clock,
  Infinity,
  Volume2,
  Waves,
  Radio,
  VolumeX,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = {
  id: string;
  question: string;
  subtitle: string;
  options: { label: string; description: string; icon: React.ReactNode; value: string }[];
};

// ─── Onboarding Steps ─────────────────────────────────────────────────────────
const STEPS: Step[] = [
  {
    id: "level",
    question: "What are you studying?",
    subtitle: "We'll tune your audio experience to match your material.",
    options: [
      {
        label: "University",
        description: "Degree coursework, research papers, dense textbooks",
        icon: <GraduationCap className="h-7 w-7" />,
        value: "university",
      },
      {
        label: "High School",
        description: "Exams, assigned reading, study guides",
        icon: <School className="h-7 w-7" />,
        value: "highschool",
      },
      {
        label: "Self-Learning",
        description: "Books, blogs, personal growth, online courses",
        icon: <BookOpen className="h-7 w-7" />,
        value: "selflearning",
      },
      {
        label: "Professional Cert",
        description: "Industry exams, technical documentation, certification prep",
        icon: <Award className="h-7 w-7" />,
        value: "professional",
      },
    ],
  },
  {
    id: "struggle",
    question: "What kills your focus?",
    subtitle: "Be honest. We've heard it all.",
    options: [
      {
        label: "My mind drifts",
        description: "I'm reading but I'm not actually reading",
        icon: <Wind className="h-7 w-7" />,
        value: "drifting",
      },
      {
        label: "I re-read the same line",
        description: "Words go in but nothing sticks",
        icon: <RefreshCcw className="h-7 w-7" />,
        value: "rereading",
      },
      {
        label: "I can't even start",
        description: "The blank page or open PDF defeats me before I begin",
        icon: <Play className="h-7 w-7" />,
        value: "starting",
      },
      {
        label: "I lose the thread",
        description: "I get it paragraph by paragraph but never the whole picture",
        icon: <BrainCircuit className="h-7 w-7" />,
        value: "comprehension",
      },
    ],
  },
  {
    id: "material",
    question: "What are you reading?",
    subtitle: "So we can set the right pacing and voice tone.",
    options: [
      {
        label: "Textbooks",
        description: "Dense, structured, chapter-by-chapter",
        icon: <BookOpen className="h-7 w-7" />,
        value: "textbooks",
      },
      {
        label: "Research Papers",
        description: "Academic journals, studies, citations",
        icon: <ScrollText className="h-7 w-7" />,
        value: "papers",
      },
      {
        label: "Articles & PDFs",
        description: "Reports, notes, online reading material",
        icon: <FileText className="h-7 w-7" />,
        value: "articles",
      },
      {
        label: "Mixed everything",
        description: "Whatever the course or week throws at me",
        icon: <Newspaper className="h-7 w-7" />,
        value: "mixed",
      },
    ],
  },
  {
    id: "focus_window",
    question: "How long before you lose it?",
    subtitle: "Your honest focus window. We'll build around it, not against it.",
    options: [
      {
        label: "Under 5 minutes",
        description: "Short bursts only — I need constant novelty",
        icon: <AlarmClock className="h-7 w-7" />,
        value: "under5",
      },
      {
        label: "5 – 15 minutes",
        description: "One good Pomodoro chunk before I drift",
        icon: <Timer className="h-7 w-7" />,
        value: "5to15",
      },
      {
        label: "15 – 30 minutes",
        description: "Decent sessions when conditions are right",
        icon: <Clock className="h-7 w-7" />,
        value: "15to30",
      },
      {
        label: "30+ minutes",
        description: "I just need the right audio environment",
        icon: <Infinity className="h-7 w-7" />,
        value: "30plus",
      },
    ],
  },
  {
    id: "background",
    question: "What's your sound layer?",
    subtitle: "This runs quietly behind the voice. Choose what your brain likes.",
    options: [
      {
        label: "Silence",
        description: "Just the voice, nothing else",
        icon: <VolumeX className="h-7 w-7" />,
        value: "silence",
      },
      {
        label: "Brown Noise",
        description: "Low rumble. Like rain on a window. Blocks distraction",
        icon: <Volume2 className="h-7 w-7" />,
        value: "brown_noise",
      },
      {
        label: "Binaural Beats",
        description: "Frequency-based focus. Headphones required",
        icon: <Waves className="h-7 w-7" />,
        value: "binaural",
      },
      {
        label: "Lo-fi Ambient",
        description: "Soft background texture. Gentle and familiar",
        icon: <Radio className="h-7 w-7" />,
        value: "lofi",
      },
    ],
  },
];

// ─── Slide animation variants ─────────────────────────────────────────────────
const variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -60 : 60,
    opacity: 0,
  }),
};

// ─── Page Component ────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);

  const step = STEPS[stepIndex];
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  // ── One-time aura: fires once per browser session ──────────────────────────
  const [hasPlayedAura, setHasPlayedAura] = useState(true); // start true → hidden
  useEffect(() => {
    const key = "focusreader_aura_shown";
    if (!sessionStorage.getItem(key)) {
      setHasPlayedAura(false);
      sessionStorage.setItem(key, "1");
    }
  }, []);

  const handleSelect = (value: string) => {
    setSelected(value);
    // Short delay so the user sees the selection highlight before moving
    setTimeout(() => {
      const newAnswers = { ...answers, [step.id]: value };
      setAnswers(newAnswers);

      if (stepIndex < STEPS.length - 1) {
        setDirection(1);
        setStepIndex((i) => i + 1);
        setSelected(null);
      } else {
        // Save to localStorage and redirect
        localStorage.setItem("focusreader_prefs", JSON.stringify(newAnswers));
        router.push("/dashboard");
      }
    }, 280);
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#080a0c] px-4 overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[800px] rounded-full bg-indigo-600/10 blur-[120px]" />

      {/* Progress bar */}
      <div className="fixed top-0 inset-x-0 z-10 h-[3px] bg-white/5">
        <motion.div
          className="h-full bg-indigo-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />
      </div>

      {/* Step counter */}
      <div className="fixed top-6 right-6 text-xs font-mono text-neutral-600">
        {stepIndex + 1} / {STEPS.length}
      </div>

      {/* Logo */}
      <div className="fixed top-5 left-6 flex items-center space-x-2">
        <div className="h-6 w-6 rounded-full bg-indigo-600 flex items-center justify-center">
          <Globe className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-sm font-semibold text-neutral-400 tracking-tight">FocusReader</span>
      </div>

      {/* Step content */}
      <div className="w-full max-w-2xl">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={stepIndex}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="flex flex-col items-center text-center"
          >
            {/* Question */}
            <div className="mb-10 space-y-3">
              {/* Aura rings — only on first visit, only on step 0 */}
              <div className="relative flex items-center justify-center">
                {!hasPlayedAura && stepIndex === 0 && (
                  <>
                    {/* Ring 1 — fastest */}
                    <motion.span
                      className="pointer-events-none absolute inset-0 rounded-full"
                      style={{
                        background:
                          "radial-gradient(ellipse at center, rgba(99,102,241,0.35) 0%, transparent 70%)",
                      }}
                      initial={{ scale: 0.4, opacity: 0.9 }}
                      animate={{ scale: 3.5, opacity: 0 }}
                      transition={{ duration: 1.6, ease: "easeOut", delay: 0.1 }}
                    />
                    {/* Ring 2 — medium */}
                    <motion.span
                      className="pointer-events-none absolute inset-0 rounded-full"
                      style={{
                        background:
                          "radial-gradient(ellipse at center, rgba(129,140,248,0.25) 0%, transparent 65%)",
                      }}
                      initial={{ scale: 0.4, opacity: 0.8 }}
                      animate={{ scale: 5, opacity: 0 }}
                      transition={{ duration: 2.2, ease: "easeOut", delay: 0.25 }}
                    />
                    {/* Ring 3 — slowest, widest */}
                    <motion.span
                      className="pointer-events-none absolute inset-0 rounded-full"
                      style={{
                        background:
                          "radial-gradient(ellipse at center, rgba(167,139,250,0.15) 0%, transparent 60%)",
                      }}
                      initial={{ scale: 0.4, opacity: 0.6 }}
                      animate={{ scale: 7, opacity: 0 }}
                      transition={{ duration: 3.0, ease: "easeOut", delay: 0.4 }}
                    />
                    {/* Text shimmer on the heading itself */}
                    <motion.span
                      className="pointer-events-none absolute inset-0"
                      initial={{ opacity: 0.6 }}
                      animate={{ opacity: 0 }}
                      transition={{ duration: 1.8, ease: "easeOut" }}
                      style={{
                        background:
                          "radial-gradient(ellipse at center, rgba(99,102,241,0.2) 0%, transparent 55%)",
                        filter: "blur(8px)",
                      }}
                    />
                  </>
                )}

                <motion.h1
                  className="relative text-3xl sm:text-4xl font-bold tracking-tight text-neutral-50"
                  initial={!hasPlayedAura && stepIndex === 0 ? { opacity: 0, y: 8 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                >
                  {step.question}
                </motion.h1>
              </div>
              <p className="text-neutral-500 text-base sm:text-lg">{step.subtitle}</p>
            </div>

            {/* Options Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              {step.options.map((option) => {
                const isSelected = selected === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => handleSelect(option.value)}
                    className={`group relative flex items-start gap-4 rounded-2xl border p-5 text-left transition-all duration-200 focus:outline-none
                      ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-500/15 shadow-[0_0_30px_-5px_rgba(99,102,241,0.4)]"
                          : "border-white/8 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                      }`}
                  >
                    {/* Icon bubble */}
                    <div
                      className={`flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-xl transition-colors duration-200
                        ${isSelected ? "bg-indigo-500/30 text-indigo-300" : "bg-white/5 text-neutral-500 group-hover:text-neutral-300"}`}
                    >
                      {option.icon}
                    </div>

                    {/* Text */}
                    <div className="min-w-0 pt-0.5">
                      <p className={`font-semibold text-sm sm:text-base leading-snug ${isSelected ? "text-indigo-200" : "text-neutral-200"}`}>
                        {option.label}
                      </p>
                      <p className={`mt-1 text-xs sm:text-sm leading-relaxed ${isSelected ? "text-indigo-400/80" : "text-neutral-600"}`}>
                        {option.description}
                      </p>
                    </div>

                    {/* Selected ring */}
                    {isSelected && (
                      <motion.div
                        layoutId="selected-ring"
                        className="absolute inset-0 rounded-2xl border-2 border-indigo-500"
                        transition={{ duration: 0.15 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dot indicators */}
      <div className="fixed bottom-8 flex items-center gap-2">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`rounded-full transition-all duration-300 ${
              i === stepIndex
                ? "w-5 h-1.5 bg-indigo-500"
                : i < stepIndex
                ? "w-1.5 h-1.5 bg-indigo-500/40"
                : "w-1.5 h-1.5 bg-white/10"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
