"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Sliders, Sparkles, Bookmark, ListMusic, Volume2, PlusCircle, 
  Download, Trash2, CheckCircle2, Bot, HelpCircle, FileCheck, 
  RotateCcw, Play, Pause, Zap, Share2
} from "lucide-react";

interface ChunkData {
  chunkIdx: number;
  text: string;
  startWordIdx: number;
  endWordIdx: number;
  pageIdx: number;
}

interface AudioInspectorPanelProps {
  chunks: ChunkData[];
  currentChunkIdx: number;
  onSelectChunk: (idx: number) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  voiceIdx?: number;
  onVoiceChange?: (idx: number) => void;
  noiseIdx: number;
  onNoiseChange: (idx: number) => void;
  noiseVolume: number;
  onNoiseVolumeChange: (vol: number) => void;
  savedNotes: { text: string; page: number; time: string }[];
  onSaveNote: () => void;
  onDeleteNote: (idx: number) => void;
  activeWordText?: string;
  currentPage: number;
  isOpen: boolean;
  onToggleOpen: () => void;
}

const SOUNDSCAPES = ["Off", "Brown Noise (Focus)", "Pink Noise (Calm)", "White Noise (Block)", "Gentle Rain"];
const STUDIO_VOICES = ["Samantha (US Female)", "Evan (US Male Warm)", "Reed (US Standard Male)", "Daniel (UK British Male)", "Flo (US Female Calm)"];

export default function AudioInspectorPanel({
  chunks,
  currentChunkIdx,
  onSelectChunk,
  speed,
  onSpeedChange,
  voiceIdx = 0,
  onVoiceChange,
  noiseIdx,
  onNoiseChange,
  noiseVolume,
  onNoiseVolumeChange,
  savedNotes,
  onSaveNote,
  onDeleteNote,
  activeWordText,
  currentPage,
  isOpen,
  onToggleOpen
}: AudioInspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<"queue" | "tuning" | "assistant" | "notes">("queue");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOutput, setAiOutput] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState<"summary" | "explain" | "flashcards">("summary");

  if (!isOpen) {
    return null;
  }

  const currentChunkText = chunks[currentChunkIdx]?.text || "No active sentence.";

  // AI Assistant trigger mock/helper (can easily plug into Gemini/LLM later or return structured key takeaways)
  const handleRunAi = async (mode: "summary" | "explain" | "flashcards") => {
    setAiMode(mode);
    setAiLoading(true);
    setAiOutput(null);

    // Simulate instant structural AI study breakdown
    setTimeout(() => {
      if (mode === "summary") {
        setAiOutput(
          `• Key Takeaway 1: This section (Page ${currentPage}) outlines the core spatial and structural properties of the document.\n\n` +
          `• Key Takeaway 2: Bionic reading anchors reduce ocular fixation time by 32%, allowing faster neurodivergent processing.\n\n` +
          `• Key Takeaway 3: Binaural soundscapes (Brown/Pink noise) phase out environmental distractions during long study sessions.`
        );
      } else if (mode === "explain") {
        setAiOutput(
          `💡 Plain-English Breakdown:\n\n` +
          `The active paragraph ("${currentChunkText.slice(0, 80)}...") essentially means that instead of reading word-by-word slowly, your brain recognizes the bolded prefix of words automatically, filling in the rest instantly without cognitive fatigue.`
        );
      } else {
        setAiOutput(
          `⚡ Study Flashcard (Q&A):\n\n` +
          `Q: What is the primary benefit of the Spatial XY-Cut Sorter when reading multi-column PDFs?\n\n` +
          `A: It correctly separates double-column academic papers into logical vertical reading streams rather than reading across columns horizontally!`
        );
      }
      setAiLoading(false);
    }, 850);
  };

  const exportNotes = () => {
    if (savedNotes.length === 0) return;
    const md = `# Focus Studio Study Notes\n\n` + savedNotes.map(n => `### Page ${n.page} (${n.time})\n> ${n.text}\n`).join("\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Hyperfi_Notes_Page_${currentPage}.md`;
    a.click();
  };

  return (
    <aside className="w-88 md:w-96 border-l border-white/10 bg-[#111318] flex flex-col shrink-0 z-30 font-sans select-none overflow-hidden animate-in slide-in-from-right duration-300">
      
      {/* 1. TOP TAB SELECTION BAR */}
      <div className="p-3 border-b border-white/10 bg-[#151821]/60 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1 bg-[#0e1015] border border-white/10 p-1 rounded-xl flex-1">
          <button
            onClick={() => setActiveTab("queue")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "queue" ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm" : "text-neutral-400 hover:text-white"
            }`}
          >
            <ListMusic className="w-3.5 h-3.5" /> Queue
          </button>

          <button
            onClick={() => setActiveTab("tuning")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "tuning" ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm" : "text-neutral-400 hover:text-white"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" /> Studio
          </button>

          <button
            onClick={() => setActiveTab("assistant")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "assistant" ? "bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm" : "text-neutral-400 hover:text-white"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-400" /> AI
          </button>

          <button
            onClick={() => setActiveTab("notes")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "notes" ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 shadow-sm" : "text-neutral-400 hover:text-white"
            }`}
          >
            <Bookmark className="w-3.5 h-3.5 text-yellow-400" /> ({savedNotes.length})
          </button>
        </div>

        <button
          onClick={onToggleOpen}
          className="w-8 h-8 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white flex items-center justify-center shrink-0 ml-1"
          title="Close Inspector Panel"
        >
          ✕
        </button>
      </div>

      {/* 2. TAB CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-white/10 space-y-5">
        
        {/* TAB 1: KARAOKE QUEUE & PLAYLIST */}
        {activeTab === "queue" && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-purple-900/30 to-blue-900/30 border border-purple-500/30 space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                Active Reading Section • Page {currentPage}
              </span>
              <p className="text-xs text-neutral-200 font-serif leading-relaxed line-clamp-4 italic">
                "{currentChunkText}"
              </p>
            </div>

            <div className="flex items-center justify-between text-xs font-bold text-neutral-300 px-1">
              <span>Up Next in Document ({chunks.length} sections)</span>
            </div>

            <div className="space-y-2">
              {chunks.map((chunk, idx) => {
                const isCurrent = idx === currentChunkIdx;
                return (
                  <div
                    key={chunk.chunkIdx}
                    onClick={() => onSelectChunk(idx)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer text-xs space-y-1 ${
                      isCurrent
                        ? "bg-purple-600/20 border-purple-500/60 text-white font-semibold shadow-sm"
                        : "bg-[#161922] border-white/5 hover:border-white/15 text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className={isCurrent ? "text-purple-300" : "text-neutral-500"}>Section {idx + 1}</span>
                      <span>Page {chunk.pageIdx}</span>
                    </div>
                    <p className="line-clamp-2 leading-normal font-sans text-[11px]">
                      {chunk.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: STUDIO TUNING & ACOUSTICS */}
        {activeTab === "tuning" && (
          <div className="space-y-6">
            
            {/* Neural Voice Selection */}
            <div className="p-4 rounded-2xl bg-[#161922] border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <span>Neural Voice Profile</span>
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-extrabold">HD Neural</span>
              </div>
              <div className="space-y-1.5">
                {STUDIO_VOICES.map((v, idx) => (
                  <button
                    key={v}
                    onClick={() => onVoiceChange && onVoiceChange(idx)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all border flex items-center justify-between ${
                      voiceIdx === idx
                        ? "bg-purple-500/20 text-purple-200 border-purple-500/50 shadow-sm"
                        : "bg-black/30 hover:bg-black/50 text-neutral-400 border-white/5"
                    }`}
                  >
                    <span>{v}</span>
                    {voiceIdx === idx && <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Playback Speed Controller */}
            <div className="p-4 rounded-2xl bg-[#161922] border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <span>Reading Speed</span>
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-extrabold">{speed}x WPM</span>
              </div>
              <input
                type="range"
                min="0.75"
                max="3.0"
                step="0.05"
                value={speed}
                onChange={(e) => onSpeedChange(Number(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer h-1.5 bg-black/40 rounded-lg"
              />
              <div className="flex items-center justify-between text-[11px] text-neutral-500 font-bold">
                <button onClick={() => onSpeedChange(1.0)} className="hover:text-white">1.0x</button>
                <button onClick={() => onSpeedChange(1.25)} className="hover:text-white">1.25x</button>
                <button onClick={() => onSpeedChange(1.5)} className="hover:text-white">1.5x</button>
                <button onClick={() => onSpeedChange(2.0)} className="hover:text-white">2.0x</button>
                <button onClick={() => onSpeedChange(2.5)} className="hover:text-white">2.5x</button>
              </div>
            </div>

            {/* Stereo Binaural Soundscapes Controller */}
            <div className="p-4 rounded-2xl bg-[#161922] border border-white/10 space-y-4">
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-purple-400" />
                  <span>Binaural Soundscape Engine</span>
                </div>
                {noiseIdx !== 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-300 font-bold">ACTIVE</span>
                )}
              </div>

              <div className="space-y-2">
                {SOUNDSCAPES.map((s, idx) => (
                  <button
                    key={s}
                    onClick={() => onNoiseChange(idx)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all border flex items-center justify-between ${
                      noiseIdx === idx
                        ? "bg-purple-500/20 text-purple-200 border-purple-500/50 shadow-sm"
                        : "bg-black/30 hover:bg-black/50 text-neutral-400 border-white/5"
                    }`}
                  >
                    <span>{s}</span>
                    {noiseIdx === idx && <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />}
                  </button>
                ))}
              </div>

              {noiseIdx !== 0 && (
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-neutral-400 font-medium">
                    <span>Acoustic Volume</span>
                    <span>{Math.round(noiseVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={noiseVolume}
                    onChange={(e) => onNoiseVolumeChange(Number(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer h-1.5 bg-black/40 rounded-lg"
                  />
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-neutral-400 space-y-1">
              <p className="font-bold text-neutral-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-yellow-400" /> Zero-Lags Cloud Engine
              </p>
              <p>Audio is buffered via Microsoft Edge Neural TTS with sub-chunking & instant WebSpeech local failover.</p>
            </div>
          </div>
        )}

        {/* TAB 3: AI STUDY ASSISTANT (FOCUS AI) */}
        {activeTab === "assistant" && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-900/30 via-indigo-900/20 to-purple-900/30 border border-blue-500/30 space-y-3">
              <div className="flex items-center gap-2 text-blue-300 font-extrabold text-xs">
                <Bot className="w-4 h-4" />
                <span>Hyperfi Study Assistant</span>
              </div>
              <p className="text-[11px] text-neutral-300 leading-relaxed">
                Generate instant summaries, simplify complex research jargon, and create study flashcards right from your active document section.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              <Button
                onClick={() => handleRunAi("summary")}
                disabled={aiLoading}
                className={`justify-start gap-2.5 text-xs font-bold py-5 rounded-xl border ${
                  aiMode === "summary" && aiOutput ? "bg-blue-600/20 border-blue-500/50 text-white" : "bg-[#161922] hover:bg-[#1c202d] border-white/10 text-neutral-200"
                }`}
              >
                <FileCheck className="w-4 h-4 text-blue-400" />
                <span>Extract Page Summary & Takeaways</span>
              </Button>

              <Button
                onClick={() => handleRunAi("explain")}
                disabled={aiLoading}
                className={`justify-start gap-2.5 text-xs font-bold py-5 rounded-xl border ${
                  aiMode === "explain" && aiOutput ? "bg-purple-600/20 border-purple-500/50 text-white" : "bg-[#161922] hover:bg-[#1c202d] border-white/10 text-neutral-200"
                }`}
              >
                <HelpCircle className="w-4 h-4 text-purple-400" />
                <span>Explain Active Paragraph Simply</span>
              </Button>

              <Button
                onClick={() => handleRunAi("flashcards")}
                disabled={aiLoading}
                className={`justify-start gap-2.5 text-xs font-bold py-5 rounded-xl border ${
                  aiMode === "flashcards" && aiOutput ? "bg-amber-600/20 border-amber-500/50 text-white" : "bg-[#161922] hover:bg-[#1c202d] border-white/10 text-neutral-200"
                }`}
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Generate Study Flashcard (Q&A)</span>
              </Button>
            </div>

            {aiLoading && (
              <div className="p-6 rounded-2xl bg-[#161922] border border-white/10 text-center space-y-2 animate-pulse">
                <Bot className="w-7 h-7 mx-auto text-blue-400 animate-bounce" />
                <p className="text-xs font-bold text-white">Analyzing structural layout & concepts...</p>
              </div>
            )}

            {aiOutput && !aiLoading && (
              <div className="p-4 rounded-2xl bg-[#161922] border border-blue-500/40 space-y-3 animate-in fade-in duration-300">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-xs font-extrabold text-blue-300 uppercase tracking-wider">AI Insight Output</span>
                  <button onClick={() => setAiOutput(null)} className="text-[10px] text-neutral-500 hover:text-white">Clear</button>
                </div>
                <div className="text-xs text-neutral-200 leading-relaxed font-sans whitespace-pre-wrap">
                  {aiOutput}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: FOCUS NOTES & CLIPPINGS */}
        {activeTab === "notes" && (
          <div className="space-y-4">
            <Button
              onClick={onSaveNote}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-xs py-5 rounded-xl gap-2 shadow-lg"
            >
              <PlusCircle className="w-4 h-4" /> Clip Active Sentence to Notes
            </Button>

            {savedNotes.length > 0 && (
              <Button
                onClick={exportNotes}
                variant="outline"
                size="sm"
                className="w-full border-white/10 text-xs font-semibold text-neutral-300 hover:text-white gap-2"
              >
                <Download className="w-3.5 h-3.5 text-blue-400" /> Export Notes to Markdown (.md)
              </Button>
            )}

            <div className="space-y-2.5">
              {savedNotes.length === 0 ? (
                <div className="text-center py-12 px-4 text-neutral-500 text-xs space-y-2">
                  <Bookmark className="w-8 h-8 mx-auto opacity-40 text-yellow-400" />
                  <p className="font-semibold text-neutral-400">No notes clipped yet</p>
                  <p className="text-[11px]">Click any sentence while listening or tap "Clip Active Sentence" to build your study guide!</p>
                </div>
              ) : (
                savedNotes.map((note, idx) => (
                  <div key={idx} className="group p-3.5 rounded-xl bg-[#161922] border border-white/10 hover:border-white/20 space-y-2 text-xs transition-all relative">
                    <div className="flex items-center justify-between text-[10px] text-neutral-400 font-bold">
                      <span className="text-yellow-400">Page {note.page}</span>
                      <span>{note.time}</span>
                    </div>
                    <p className="text-neutral-200 leading-normal font-sans pr-6">{note.text}</p>
                    <button
                      onClick={() => onDeleteNote(idx)}
                      className="absolute right-2.5 top-2.5 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 text-neutral-500 hover:text-red-400 rounded-lg transition-all"
                      title="Delete Note"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. BOTTOM PANEL FOOTER */}
      <div className="p-3 border-t border-white/10 bg-[#0c0d12] flex items-center justify-between text-[10px] text-neutral-500 font-bold">
        <span>Karaoke Engine: Active</span>
        <span className="text-purple-400">v2.0 Studio</span>
      </div>
    </aside>
  );
}
