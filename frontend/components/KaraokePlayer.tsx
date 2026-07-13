"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildWordTimings, wordIndexAt } from "@/lib/karaoke";

interface KaraokePlayerProps {
  src: string;
  text: string;
  autoPlay?: boolean;
  /** Seek here once metadata loads (resume position, seconds). */
  initialTime?: number;
  onTime?: (seconds: number) => void;
  onEnded?: () => void;
}

/**
 * Read-along player: the current word highlights as the audio plays
 * (proportional alignment — see lib/karaoke.ts), clicking any word seeks to
 * it, and the view auto-scrolls to keep the active word centered.
 */
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

  // Drive highlighting off requestAnimationFrame while playing —
  // `timeupdate` only fires ~4x/second, which visibly lags at 2x speed.
  useEffect(() => {
    let frame: number;
    const tick = () => {
      const el = audioRef.current;
      if (el && el.duration > 0 && !el.paused) {
        setActiveIndex(wordIndexAt(tokens, el.currentTime / el.duration));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [tokens]);

  // Keep the active word in view.
  useEffect(() => {
    if (!followAlong || activeIndex < 0) return;
    const container = containerRef.current;
    const active = container?.querySelector<HTMLElement>(
      `[data-word-index="${activeIndex}"]`
    );
    active?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIndex, followAlong]);

  const seekToWord = (index: number) => {
    const el = audioRef.current;
    if (!el || !el.duration) return;
    el.currentTime = tokens[index].startFrac * el.duration;
    setActiveIndex(index);
    el.play().catch(() => {});
  };

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-[#0b0d10] p-5 leading-loose text-[15px]"
        onWheel={() => setFollowAlong(false)}
        onTouchMove={() => setFollowAlong(false)}
      >
        {tokens.map((token, i) => (
          <span key={i}>
            {token.paragraphStart && i > 0 && (
              <span className="block h-4" aria-hidden />
            )}
            <span
              data-word-index={i}
              onClick={() => seekToWord(i)}
              className={
                i === activeIndex
                  ? "cursor-pointer rounded bg-indigo-500/40 px-0.5 text-white transition-colors duration-100"
                  : i < activeIndex
                    ? "cursor-pointer px-0.5 text-neutral-500 hover:text-neutral-300"
                    : "cursor-pointer px-0.5 text-neutral-300 hover:text-white"
              }
            >
              {token.word}
            </span>{" "}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-3">
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
          }}
          onSeeked={(e) => {
            const el = e.currentTarget;
            if (el.duration > 0) {
              setActiveIndex(wordIndexAt(tokens, el.currentTime / el.duration));
            }
            setFollowAlong(true);
          }}
        />
        {!followAlong && (
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
