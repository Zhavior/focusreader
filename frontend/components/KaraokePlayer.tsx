"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildWordTimings, wordIndexAt } from "@/lib/karaoke";
import { Eye, Focus, X } from "lucide-react";

interface KaraokePlayerProps {
  src: string;
  text: string;
  autoPlay?: boolean;
  /** Seek here once metadata loads (resume position, seconds). */
  initialTime?: number;
  onTime?: (seconds: number) => void;
  onEnded?: () => void;
}

function renderWord(word: string, isBionic: boolean) {
  if (!isBionic || word.length <= 1) return word;
  
  // Bionic Reading rules: bold the first half of the word.
  // For short words (2-3 chars), bold the first 1-2.
  const mid = Math.ceil(word.length / 2);
  return (
    <>
      <strong className="font-extrabold opacity-100">{word.slice(0, mid)}</strong>
      <span className="opacity-70">{word.slice(mid)}</span>
    </>
  );
}

export default function KaraokePlayer({
  src,
  text,
  autoPlay = false,
  initialTime = 0,
  onTime,
  onEnded,
}: KaraokePlayerProps) {
  const tokens = useMemo(() => buildWordTimings(text), [text]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [activeIndex, setActiveIndex] = useState(-1);
  const [followAlong, setFollowAlong] = useState(true);
  
  // New Competitive Features
  const [bionicMode, setBionicMode] = useState(false);
  const [hyperfocusMode, setHyperfocusMode] = useState(false);
  const [isPlaying, setIsPlaying] = useState(autoPlay);

  useEffect(() => {
    let frame: number;
    const tick = () => {
      const el = audioRef.current;
      if (el && el.duration > 0 && !el.paused) {
        setActiveIndex(wordIndexAt(tokens, el.currentTime / el.duration));
        setIsPlaying(true);
      } else {
        setIsPlaying(false);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [tokens]);

  useEffect(() => {
    if (!followAlong || activeIndex < 0) return;
    const container = containerRef.current;
    const active = container?.querySelector<HTMLElement>(
      `[data-word-index="${activeIndex}"]`
    );
    active?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIndex, followAlong, hyperfocusMode]);

  const seekToWord = (index: number) => {
    const el = audioRef.current;
    if (!el || !el.duration) return;
    el.currentTime = tokens[index].startFrac * el.duration;
    setActiveIndex(index);
    el.play().catch(() => {});
  };

  const isVaultActive = hyperfocusMode && isPlaying;

  return (
    <div className={`space-y-4 ${isVaultActive ? "fixed inset-0 z-[100] bg-black p-8 md:p-24 flex flex-col justify-center animate-in fade-in duration-700" : ""}`}>
      
      {/* ── Control Bar ── */}
      <div className={`flex items-center justify-between ${isVaultActive ? "absolute top-8 left-8 right-8" : ""}`}>
        <div className="flex gap-2">
          <button
            onClick={() => setBionicMode(!bionicMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
              bionicMode 
                ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300" 
                : "bg-transparent border-white/10 text-neutral-400 hover:text-white"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            Bionic Font
          </button>
          
          <button
            onClick={() => setHyperfocusMode(!hyperfocusMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
              hyperfocusMode 
                ? "bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-[0_0_15px_rgba(243,24,105,0.4)]" 
                : "bg-transparent border-white/10 text-neutral-400 hover:text-white"
            }`}
          >
            <Focus className="h-3.5 w-3.5" />
            Hyperfocus Vault
          </button>
        </div>

        {isVaultActive && (
          <button 
            onClick={() => audioRef.current?.pause()}
            className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" /> Exit Vault
          </button>
        )}
      </div>

      {/* ── Text Container ── */}
      <div
        ref={containerRef}
        className={`overflow-y-auto rounded-xl border border-white/10 bg-[#0b0d10] transition-all duration-700
          ${isVaultActive 
            ? "max-h-[70vh] border-none bg-transparent p-4 text-3xl md:text-5xl leading-relaxed text-center font-serif tracking-tight" 
            : "max-h-64 p-5 leading-loose text-[15px]"
          }
        `}
        onWheel={() => setFollowAlong(false)}
        onTouchMove={() => setFollowAlong(false)}
      >
        <div className={isVaultActive ? "max-w-4xl mx-auto" : ""}>
          {tokens.map((token, i) => (
            <span key={i}>
              {token.paragraphStart && i > 0 && (
                <span className={`block ${isVaultActive ? "h-12" : "h-4"}`} aria-hidden />
              )}
              <span
                data-word-index={i}
                onClick={() => seekToWord(i)}
                className={
                  i === activeIndex
                    ? `cursor-pointer rounded transition-colors duration-100 ${isVaultActive ? "text-white font-bold drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]" : "bg-indigo-500/40 px-0.5 text-white"}`
                    : i < activeIndex
                      ? `cursor-pointer px-0.5 ${isVaultActive ? "text-neutral-800" : "text-neutral-500 hover:text-neutral-300"}`
                      : `cursor-pointer px-0.5 ${isVaultActive ? "text-neutral-700" : "text-neutral-300 hover:text-white"}`
                }
              >
                {renderWord(token.word, bionicMode)}
              </span>{" "}
            </span>
          ))}
        </div>
      </div>

      {/* ── Audio Player ── */}
      <div className={`flex items-center gap-3 ${isVaultActive ? "max-w-xl mx-auto w-full opacity-30 hover:opacity-100 transition-opacity" : ""}`}>
        <audio
          ref={audioRef}
          controls
          autoPlay={autoPlay}
          src={src}
          className="w-full"
          onLoadedMetadata={(e) => {
            const el = e.currentTarget;
            if (initialTime > 0 && initialTime < el.duration - 5) {
              el.currentTime = initialTime;
            }
          }}
          onTimeUpdate={(e) => onTime?.(e.currentTarget.currentTime)}
          onEnded={() => {
            setActiveIndex(tokens.length - 1);
            onEnded?.();
            setIsPlaying(false);
          }}
          onSeeked={(e) => {
            const el = e.currentTarget;
            if (el.duration > 0) {
              setActiveIndex(wordIndexAt(tokens, el.currentTime / el.duration));
            }
            setFollowAlong(true);
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
        {!followAlong && !isVaultActive && (
          <button
            onClick={() => setFollowAlong(true)}
            className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-400 transition hover:border-indigo-500/50 hover:text-indigo-300"
          >
            Follow
          </button>
        )}
      </div>
    </div>
  );
}
