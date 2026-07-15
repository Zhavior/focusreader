"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { 
  Play, Pause, SkipForward, RotateCcw, Volume2, VolumeX, 
  Sparkles, Sliders, Maximize2, Headphones, Sparkle
} from "lucide-react";

interface FloatingStudioControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onPrevChunk: () => void;
  onNextChunk: () => void;
  activeChunkText: string;
  speed: number;
  onSpeedChange: (s: number) => void;
  isBionic: boolean;
  onToggleBionic: () => void;
  isInspectorOpen: boolean;
  onToggleInspector: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
}

export default function FloatingStudioControls({
  isPlaying,
  onTogglePlay,
  onPrevChunk,
  onNextChunk,
  activeChunkText,
  speed,
  onSpeedChange,
  isBionic,
  onToggleBionic,
  isInspectorOpen,
  onToggleInspector,
  isMuted = false,
  onToggleMute
}: FloatingStudioControlsProps) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-4xl bg-[#111318]/95 backdrop-blur-xl border border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.8)] rounded-3xl p-3 md:py-3.5 md:px-6 flex items-center justify-between gap-4 transition-all duration-300">
      
      {/* 1. LEFT: ACTIVE SECTION TICKER & BIONIC QUICK-TOGGLE */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          onClick={onToggleBionic}
          className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border transition-all ${
            isBionic
              ? "bg-gradient-to-tr from-purple-600 to-blue-600 text-white border-purple-400/40 shadow-[0_0_15px_rgba(168,85,247,0.5)]"
              : "bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white border-white/10"
          }`}
          title="Toggle Bionic Anchors"
        >
          <Sparkles className="w-4 h-4" />
        </button>

        <div className="min-w-0 pr-2">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              {isPlaying && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isPlaying ? "bg-purple-500" : "bg-neutral-600"}`} />
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">
              {isPlaying ? "Binaural Narrator Playing" : "Paused"}
            </span>
          </div>
          <p className="font-bold text-xs text-white truncate max-w-xs md:max-w-md mt-0.5">
            {activeChunkText || "Ready to read document..."}
          </p>
        </div>
      </div>

      {/* 2. CENTER: PLAYBACK TRANSPORT BUTTONS */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onPrevChunk}
          className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-neutral-300 hover:text-white transition-all shadow-sm"
          title="Previous Section / Restart"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          onClick={onTogglePlay}
          className={`h-11 px-6 rounded-2xl font-extrabold text-xs flex items-center justify-center gap-2.5 transition-all shadow-lg transform active:scale-95 ${
            isPlaying
              ? "bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white shadow-[0_0_25px_rgba(168,85,247,0.6)] border border-purple-400/40"
              : "bg-white text-[#111318] hover:bg-neutral-200 shadow-md"
          }`}
        >
          {isPlaying ? (
            <>
              <Pause className="w-4 h-4 fill-white" />
              <span>PAUSE</span>
              {/* Waveform Bars */}
              <span className="flex items-center gap-0.5 ml-1">
                <span className="w-0.5 h-3 bg-white animate-pulse" />
                <span className="w-0.5 h-4 bg-white animate-pulse delay-75" />
                <span className="w-0.5 h-2 bg-white animate-pulse delay-150" />
              </span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-[#111318]" />
              <span>LISTEN</span>
            </>
          )}
        </button>

        <button
          onClick={onNextChunk}
          className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-neutral-300 hover:text-white transition-all shadow-sm"
          title="Next Section"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      {/* 3. RIGHT: SPEED & STUDIO INSPECTOR TOGGLE */}
      <div className="flex items-center gap-2 shrink-0">
        
        {/* Speed Quick Pill */}
        <button
          onClick={() => {
            const nextSpeed = speed === 1.0 ? 1.25 : speed === 1.25 ? 1.5 : speed === 1.5 ? 2.0 : 1.0;
            onSpeedChange(nextSpeed);
          }}
          className="h-10 px-3 rounded-2xl bg-[#171a22] hover:bg-[#1f232e] border border-white/10 font-extrabold text-xs text-purple-300 hover:text-white transition-all flex items-center justify-center shadow-sm"
          title="Change Speed"
        >
          {speed}x
        </button>

        {/* Studio Inspector Toggle */}
        <button
          onClick={onToggleInspector}
          className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all border ${
            isInspectorOpen
              ? "bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
              : "bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white border-white/10"
          }`}
          title="Toggle Studio Inspector"
        >
          <Sliders className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
