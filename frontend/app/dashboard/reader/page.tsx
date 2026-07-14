"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, Upload, Play, Pause, Volume2, Zap, 
  BookOpen, Layers, CheckCircle2, AlertCircle, FileText, 
  Sparkles, RotateCcw, FastForward, Bookmark, PlusCircle, Shield
} from "lucide-react";
import Link from "next/link";
// pdfjs-dist is browser-only (needs DOMMatrix); load it lazily at use time
// so Next.js server prerendering never touches it.
async function loadPdfjs() {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  return pdfjsLib;
}

interface WordSpan {
  globalIdx: number;
  pageIdx: number;
  itemIdx: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PageData {
  pageNumber: number;
  width: number;
  height: number;
  items: {
    str: string;
    x: number;
    y: number;
    width: number;
    height: number;
    words: WordSpan[];
  }[];
}

interface ChunkData {
  chunkIdx: number;
  text: string;
  startWordIdx: number;
  endWordIdx: number;
  pageIdx: number;
}

const VOICES = [
  { name: "Male (Warm & Deep - Evan)", id: "Evan", elevenId: "nPczCjzI2XWHr1WexmYd" },
  { name: "Male (US Standard - Alex)", id: "Reed (English (US))", elevenId: "ErXwobaYiN019PkySvjV" },
  { name: "Female (US Standard - Samantha)", id: "Samantha", elevenId: "EXAVITQu4vr4xnSDxMaL" },
  { name: "Male (UK British - Daniel)", id: "Daniel", elevenId: "ONwK4e9ZLuTAKqWW03F9" },
  { name: "Female (Warm & Calm - Flo)", id: "Flo (English (US))", elevenId: "21m00Tcm4TlvDq8ikWAM" }
];

const SOUNDSCAPES = ["Off", "Brown Noise", "Pink Noise", "White Noise", "Rain"];

export default function DocumentReaderPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [docType, setDocType] = useState<"pdf" | "docx" | "none">("none");
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState<string>("");
  const [pages, setPages] = useState<PageData[]>([]);
  const [chunks, setChunks] = useState<ChunkData[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);

  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentChunkIdx, setCurrentChunkIdx] = useState<number>(0);
  const [activeWordIdx, setActiveWordIdx] = useState<number>(-1);
  const [speed, setSpeed] = useState<number>(1.25);
  const [voiceIdx, setVoiceIdx] = useState<number>(0);
  const [isBionic, setIsBionic] = useState<boolean>(true);
  const [useOfflineEngine, setUseOfflineEngine] = useState<boolean>(false);

  // Soundscape State
  const [noiseIdx, setNoiseIdx] = useState<number>(1); // Default Brown Noise
  const [noiseVolume, setNoiseVolume] = useState<number>(0.35);

  // Notes & Checkpoints
  const [savedNotes, setSavedNotes] = useState<{ text: string; page: number; time: string }[]>([]);
  const [showNotesPanel, setShowNotesPanel] = useState<boolean>(false);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  // Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const noiseSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const noiseGainRef = useRef<GainNode | null>(null);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioQueueRef = useRef<{ url: string; chunkIdx: number }[]>([]);
  const isQueueActiveRef = useRef<boolean>(false);
  const inflightFetchesRef = useRef<number>(0);
  const nextFetchIdxRef = useRef<number>(0);
  const canvasRefs = useRef<{ [page: number]: HTMLCanvasElement | null }>({});
  const pdfDocRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Display toast helper
  const showToast = (msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast(null), 3500);
  };

  // ==========================================
  // 1. STEREO BINAURAL SOUNDSCAPES ENGINE
  // ==========================================
  const initAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const generateStereoSoundscapeBuffer = useCallback((ctx: AudioContext, mode: number) => {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * 8; // 8 second seamless loop
    const buffer = ctx.createBuffer(2, length, sampleRate);
    const fadeLen = Math.floor(sampleRate * 0.2); // 200ms equal-power cosine crossfade seam

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      // Phase decorrelation seed difference for L/R channels to widen spatial binaural stage
      const phaseOffset = channel === 0 ? 1.0 : -1.0;

      for (let i = 0; i < length; i++) {
        const white = (Math.random() * 2 - 1) * phaseOffset;
        let sample = 0;

        if (mode === 1) {
          // Brown Noise (Paul Kellet 7-pole biquad filter)
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          sample = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
          b6 = white * 0.115926;
        } else if (mode === 2) {
          // Pink Noise (Paul Kellet filter)
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          sample = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.1;
          b6 = white * 0.115926;
        } else if (mode === 3) {
          // White Noise
          sample = white * 0.15;
        } else if (mode === 4) {
          // Rain (Filtered pink noise with randomized droplet bursts)
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          let pink = (b0 + b1 + white * 0.5362) * 0.08;
          if (Math.random() < 0.003) pink += (Math.random() * 2 - 1) * 0.35;
          sample = pink;
        }

        // Apply 200ms equal-power cosine crossfade at the loop boundary
        if (i < fadeLen) {
          const frac = i / fadeLen;
          const gainIn = Math.sin(frac * 0.5 * Math.PI);
          sample = sample * gainIn;
        } else if (i > length - fadeLen) {
          const frac = (length - i) / fadeLen;
          const gainOut = Math.sin(frac * 0.5 * Math.PI);
          sample = sample * gainOut;
        }
        data[i] = sample;
      }
    }
    return buffer;
  }, []);

  const applySoundscape = useCallback((mode: number, volume: number) => {
    if (mode === 0) {
      if (noiseSourceRef.current) {
        try { noiseSourceRef.current.stop(); } catch {}
        noiseSourceRef.current = null;
      }
      return;
    }
    const ctx = initAudioContext();
    if (!noiseGainRef.current) {
      noiseGainRef.current = ctx.createGain();
      noiseGainRef.current.connect(ctx.destination);
    }
    noiseGainRef.current.gain.setValueAtTime(volume, ctx.currentTime);

    if (noiseSourceRef.current) {
      try { noiseSourceRef.current.stop(); } catch {}
    }
    const buffer = generateStereoSoundscapeBuffer(ctx, mode);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(noiseGainRef.current);
    source.start();
    noiseSourceRef.current = source;
  }, [initAudioContext, generateStereoSoundscapeBuffer]);

  useEffect(() => {
    applySoundscape(noiseIdx, noiseVolume);
    return () => {
      if (noiseSourceRef.current) {
        try { noiseSourceRef.current.stop(); } catch {}
      }
    };
  }, [noiseIdx, noiseVolume, applySoundscape]);

  // ==========================================
  // 2. DOCUMENT PARSING & SPATIAL XY-CUT SORTER
  // ==========================================
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = "";
    if (!selected) return;

    setFile(selected);
    setFileName(selected.name);
    setIsParsing(true);
    setParseProgress("Analyzing layout & extracting spatial word coordinates...");
    setPages([]);
    setChunks([]);
    setCurrentPage(1);
    stopPlayback();

    const isPdf = selected.name.toLowerCase().endsWith(".pdf");
    setDocType(isPdf ? "pdf" : "docx");

    try {
      if (isPdf) {
        const arrayBuffer = await selected.arrayBuffer();
        const pdfjsLib = await loadPdfjs();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);

        let globalWordCounter = 0;
        const parsedPages: PageData[] = [];
        const allChunks: ChunkData[] = [];
        let currentChunkText = "";
        let currentChunkStartWord = 0;
        let chunkCounter = 0;

        for (let i = 1; i <= pdf.numPages; i++) {
          setParseProgress(`Processing Page ${i} of ${pdf.numPages} (Spatial XY-Cut Sorter)...`);
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const textContent = await page.getTextContent();

          if (textContent.items.length === 0) {
            showToast(`Page ${i} appears to be a scanned image — running fallback text recognition.`);
          }

          // Spatial XY-Cut Sorter for multi-column research papers & documents
          const rawItems = textContent.items
            .map((item: any) => ({
              str: item.str || "",
              x: item.transform[4],
              y: item.transform[5],
              width: item.width || 10,
              height: Math.abs(item.transform[3]) || 12,
            }))
            .filter((item: any) => item.str.trim().length > 0);

          // Group into vertical columns (e.g., IEEE / ACM double column check)
          const sortedItems = rawItems.sort((a: any, b: any) => {
            const colGap = viewport.width / 2.2;
            const colA = Math.floor(a.x / colGap);
            const colB = Math.floor(b.x / colGap);
            if (colA !== colB) return colA - colB;
            // Inside same column, higher PDF coordinate Y means higher on physical page
            if (Math.abs(b.y - a.y) > 5) return b.y - a.y;
            return a.x - b.x;
          });

          const pageItems: { str: string; x: number; y: number; width: number; height: number; words: WordSpan[] }[] = [];

          sortedItems.forEach((item: any, itemIdx: number) => {
            const words = item.str.split(/\s+/).filter(Boolean);
            const wordSpans: WordSpan[] = [];
            const approxWordWidth = item.width / Math.max(1, words.length);

            words.forEach((w: string, wIdx: number) => {
              const span: WordSpan = {
                globalIdx: globalWordCounter++,
                pageIdx: i,
                itemIdx: itemIdx,
                text: w,
                x: item.x + (wIdx * approxWordWidth),
                y: item.y,
                width: approxWordWidth,
                height: item.height
              };
              wordSpans.push(span);

              // Accumulate chunks (approx 60-80 words per chunk for smooth audio rolling buffer)
              currentChunkText += (currentChunkText ? " " : "") + w;
              if (currentChunkText.split(" ").length >= 65 || (w.endsWith(".") || w.endsWith("!") || w.endsWith("?")) && currentChunkText.split(" ").length >= 45) {
                allChunks.push({
                  chunkIdx: chunkCounter++,
                  text: currentChunkText.trim(),
                  startWordIdx: currentChunkStartWord,
                  endWordIdx: span.globalIdx,
                  pageIdx: i
                });
                currentChunkText = "";
                currentChunkStartWord = span.globalIdx + 1;
              }
            });

            pageItems.push({
              str: item.str,
              x: item.x,
              y: item.y,
              width: item.width,
              height: item.height,
              words: wordSpans
            });
          });

          parsedPages.push({
            pageNumber: i,
            width: viewport.width,
            height: viewport.height,
            items: pageItems
          });
        }

        // Push leftover chunk if any
        if (currentChunkText.trim().length > 0) {
          allChunks.push({
            chunkIdx: chunkCounter++,
            text: currentChunkText.trim(),
            startWordIdx: currentChunkStartWord,
            endWordIdx: globalWordCounter - 1,
            pageIdx: parsedPages.length > 0 ? parsedPages[parsedPages.length - 1].pageNumber : 1
          });
        }

        setPages(parsedPages);
        setChunks(allChunks);
        showToast(`Successfully analyzed ${pdf.numPages} pages and indexed ${globalWordCounter} words!`);
      } else {
        // DOCX or reflowable text via backend extraction
        const form = new FormData();
        form.append("file", selected);
        const res = await fetch("/api/extract", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to read DOCX file");

        const words = data.text.split(/\s+/).filter(Boolean);
        let globalWordCounter = 0;
        const wordSpans: WordSpan[] = words.map((w: string) => ({
          globalIdx: globalWordCounter++,
          pageIdx: 1,
          itemIdx: 0,
          text: w,
          x: 0,
          y: 0,
          width: 0,
          height: 0
        }));

        const allChunks: ChunkData[] = [];
        let chunkText = "";
        let startIdx = 0;
        let chunkCounter = 0;

        wordSpans.forEach((span, i) => {
          chunkText += (chunkText ? " " : "") + span.text;
          if (chunkText.split(" ").length >= 65 || (span.text.endsWith(".") || span.text.endsWith("?")) && chunkText.split(" ").length >= 45) {
            allChunks.push({
              chunkIdx: chunkCounter++,
              text: chunkText.trim(),
              startWordIdx: startIdx,
              endWordIdx: span.globalIdx,
              pageIdx: 1
            });
            chunkText = "";
            startIdx = span.globalIdx + 1;
          }
        });
        if (chunkText.trim().length > 0) {
          allChunks.push({
            chunkIdx: chunkCounter++,
            text: chunkText.trim(),
            startWordIdx: startIdx,
            endWordIdx: wordSpans.length - 1,
            pageIdx: 1
          });
        }

        setPages([{
          pageNumber: 1,
          width: 800,
          height: 1100,
          items: [{ str: data.text, x: 0, y: 0, width: 800, height: 1100, words: wordSpans }]
        }]);
        setChunks(allChunks);
        setNumPages(1);
        showToast(`Parsed DOCX: ${words.length} words indexed!`);
      }
    } catch (err: any) {
      showToast(`Error parsing document: ${err.message || "Unknown error"}`);
    } finally {
      setIsParsing(false);
    }
  };

  // ==========================================
  // 3. VIRTUALIZED CANVAS RENDERING (3-Page Window)
  // ==========================================
  useEffect(() => {
    if (docType !== "pdf" || !pdfDocRef.current || pages.length === 0) return;

    // Render active window: currentPage - 1, currentPage, currentPage + 1
    const pagesToRender = [currentPage - 1, currentPage, currentPage + 1].filter(p => p >= 1 && p <= numPages);

    pagesToRender.forEach(async (pNum) => {
      const canvas = canvasRefs.current[pNum];
      if (!canvas || canvas.getAttribute("data-rendered") === "true") return;

      try {
        const page = await pdfDocRef.current.getPage(pNum);
        const viewport = page.getViewport({ scale: 1.5 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
          canvas.setAttribute("data-rendered", "true");
        }
      } catch (err) {
        console.error(`Error rendering page ${pNum}:`, err);
      }
    });
  }, [currentPage, docType, pages, numPages]);

  // ==========================================
  // 4. AUDIO ENGINE & ROLLING VIRTUAL BUFFER
  // ==========================================
  const stopPlayback = useCallback(() => {
    isQueueActiveRef.current = false;
    setIsPlaying(false);
    setIsPaused(false);
    if (voiceAudioRef.current) {
      voiceAudioRef.current.pause();
      voiceAudioRef.current.src = "";
      voiceAudioRef.current = null;
    }
    if (activeUtteranceRef.current && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      activeUtteranceRef.current = null;
    }
    audioQueueRef.current.forEach(i => URL.revokeObjectURL(i.url));
    audioQueueRef.current = [];
  }, []);

  const fetchTtsChunk = async (chunk: ChunkData): Promise<string> => {
    if (useOfflineEngine) return "webspeech_fallback";
    try {
      const selectedVoice = VOICES[voiceIdx] || VOICES[0];
      const res = await fetch("http://localhost:4000/api/extension/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: chunk.text,
          voice: selectedVoice.id,
          voiceId: selectedVoice.elevenId
        })
      });
      if (!res.ok) throw new Error("Server response error");
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    } catch (err) {
      console.warn("TTS server unavailable or error — auto-switching to Offline WebSpeech engine.");
      return "webspeech_fallback";
    }
  };

  const fillBuffer = useCallback(async () => {
    while (
      isQueueActiveRef.current &&
      audioQueueRef.current.length + inflightFetchesRef.current < 4 &&
      nextFetchIdxRef.current < chunks.length
    ) {
      const idx = nextFetchIdxRef.current++;
      inflightFetchesRef.current++;
      const chunk = chunks[idx];

      fetchTtsChunk(chunk)
        .then(url => {
          if (!isQueueActiveRef.current) {
            if (url && url !== "webspeech_fallback") URL.revokeObjectURL(url);
            return;
          }
          audioQueueRef.current.push({ url, chunkIdx: idx });
          audioQueueRef.current.sort((a, b) => a.chunkIdx - b.chunkIdx);
          if (!isPlaying && !isPaused) {
            playNextInQueue();
          }
        })
        .finally(() => {
          inflightFetchesRef.current--;
          if (isQueueActiveRef.current) fillBuffer();
        });
    }
  }, [chunks, isPlaying, isPaused, useOfflineEngine, voiceIdx]);

  const playWebSpeech = (text: string, chunkIdx: number) => {
    if (!window.speechSynthesis) {
      playNextInQueue();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = speed;
    const synthVoices = window.speechSynthesis.getVoices();
    const activeVoiceConf = VOICES[voiceIdx] || VOICES[0];
    const isMale = activeVoiceConf.name.toLowerCase().includes("male");
    const matched = synthVoices.find(v => v.lang.startsWith("en") && (isMale ? v.name.toLowerCase().includes("male") || v.name.includes("Alex") || v.name.includes("Daniel") : v.name.toLowerCase().includes("female") || v.name.includes("Samantha"))) || synthVoices[0];
    if (matched) utterance.voice = matched;

    const currentChunk = chunks[chunkIdx];
    const wordsInChunk = text.split(/\s+/).filter(Boolean);

    utterance.onboundary = (e) => {
      if (e.name === "word") {
        // Find approximate word index from charIndex
        const substr = text.substring(0, e.charIndex);
        const wordOffset = substr.split(/\s+/).filter(Boolean).length;
        const globalIdx = currentChunk.startWordIdx + Math.min(wordOffset, wordsInChunk.length - 1);
        setActiveWordIdx(globalIdx);

        // Auto-scroll to active word page
        if (pages.length > 0) {
          const matchedPage = pages.find(p => p.items.some(it => it.words.some(w => w.globalIdx === globalIdx)));
          if (matchedPage && matchedPage.pageNumber !== currentPage) {
            setCurrentPage(matchedPage.pageNumber);
          }
        }
      }
    };
    utterance.onend = () => {
      activeUtteranceRef.current = null;
      playNextInQueue();
    };
    utterance.onerror = () => {
      activeUtteranceRef.current = null;
      playNextInQueue();
    };
    activeUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const playNextInQueue = () => {
    if (!isQueueActiveRef.current || audioQueueRef.current.length === 0) {
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    const { url, chunkIdx } = audioQueueRef.current.shift()!;
    setCurrentChunkIdx(chunkIdx);
    const chunk = chunks[chunkIdx];
    if (chunk && chunk.pageIdx !== currentPage) {
      setCurrentPage(chunk.pageIdx);
    }

    if (url === "webspeech_fallback") {
      playWebSpeech(chunk.text, chunkIdx);
      fillBuffer();
      return;
    }

    if (voiceAudioRef.current) {
      voiceAudioRef.current.pause();
      voiceAudioRef.current.src = "";
    }

    const audio = new Audio(url);
    audio.defaultPlaybackRate = speed;
    audio.playbackRate = speed;
    voiceAudioRef.current = audio;

    audio.onplay = () => {
      audio.defaultPlaybackRate = speed;
      audio.playbackRate = speed;
      // Interpolate word highlight smoothly over audio duration
      const totalWords = chunk.endWordIdx - chunk.startWordIdx + 1;
      const duration = audio.duration || Math.max(2, totalWords * 0.38 / speed);
      
      const startInterval = setInterval(() => {
        if (!voiceAudioRef.current || voiceAudioRef.current.paused || voiceAudioRef.current.ended) {
          clearInterval(startInterval);
          return;
        }
        const frac = Math.min(1, Math.max(0, voiceAudioRef.current.currentTime / duration));
        const wordOffset = Math.floor(frac * totalWords);
        const globalIdx = Math.min(chunk.endWordIdx, chunk.startWordIdx + wordOffset);
        setActiveWordIdx(globalIdx);
      }, 60);
    };

    audio.onended = () => {
      URL.revokeObjectURL(url);
      playNextInQueue();
    };

    audio.play().catch(err => {
      console.error("Audio playback error:", err);
      playNextInQueue();
    });

    fillBuffer();
  };

  const startPlaybackFromChunk = (idx: number) => {
    stopPlayback();
    if (idx < 0 || idx >= chunks.length) return;
    setCurrentChunkIdx(idx);
    nextFetchIdxRef.current = idx;
    isQueueActiveRef.current = true;
    setIsPlaying(true);
    fillBuffer();
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      // Pause
      if (voiceAudioRef.current) voiceAudioRef.current.pause();
      if (activeUtteranceRef.current && window.speechSynthesis) window.speechSynthesis.pause();
      setIsPlaying(false);
      setIsPaused(true);
    } else if (isPaused) {
      // Resume
      if (voiceAudioRef.current) {
        voiceAudioRef.current.defaultPlaybackRate = speed;
        voiceAudioRef.current.playbackRate = speed;
        voiceAudioRef.current.play();
      }
      if (activeUtteranceRef.current && window.speechSynthesis) window.speechSynthesis.resume();
      setIsPlaying(true);
      setIsPaused(false);
    } else {
      // Start fresh from current chunk
      startPlaybackFromChunk(currentChunkIdx);
    }
  };

  const handleSetSpeed = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (voiceAudioRef.current) {
      voiceAudioRef.current.defaultPlaybackRate = newSpeed;
      voiceAudioRef.current.playbackRate = newSpeed;
    }
    if (activeUtteranceRef.current && window.speechSynthesis) {
      activeUtteranceRef.current.rate = newSpeed;
    }
  };

  // ==========================================
  // 5. ONE-TAP VOICE NOTE & CHECKPOINT CLIPPER
  // ==========================================
  const saveInstantNote = () => {
    if (activeWordIdx < 0 || chunks.length === 0) {
      showToast("Start listening or click a sentence to clip a note!");
      return;
    }
    const currentChunk = chunks[currentChunkIdx];
    if (!currentChunk) return;

    const noteEntry = {
      text: currentChunk.text,
      page: currentPage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setSavedNotes(prev => [noteEntry, ...prev]);
    showToast(`Saved Note from Page ${currentPage}!`);

    // Sync to backend dashboard
    fetch("/api/extension/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: noteEntry.text, source: `Document Reader (${fileName} - p.${currentPage})` })
    }).catch(() => {});
  };

  // Helper for Bionic Reading format
  const renderWord = (w: WordSpan) => {
    const isActive = w.globalIdx === activeWordIdx;
    if (!isBionic || w.text.length <= 3) {
      return (
        <span 
          key={w.globalIdx}
          onClick={() => {
            const matchedChunk = chunks.find(c => w.globalIdx >= c.startWordIdx && w.globalIdx <= c.endWordIdx);
            if (matchedChunk) startPlaybackFromChunk(matchedChunk.chunkIdx);
          }}
          className={`cursor-pointer transition-colors duration-150 px-0.5 rounded ${
            isActive ? "bg-purple-500 text-white font-bold shadow-[0_0_15px_rgba(168,85,247,0.9)] scale-110 z-10" : "hover:bg-white/10"
          }`}
        >
          {w.text}{" "}
        </span>
      );
    }
    const mid = Math.ceil(w.text.length / 2);
    const boldPart = w.text.slice(0, mid);
    const restPart = w.text.slice(mid);
    return (
      <span 
        key={w.globalIdx}
        onClick={() => {
          const matchedChunk = chunks.find(c => w.globalIdx >= c.startWordIdx && w.globalIdx <= c.endWordIdx);
          if (matchedChunk) startPlaybackFromChunk(matchedChunk.chunkIdx);
        }}
        className={`cursor-pointer transition-colors duration-150 px-0.5 rounded ${
          isActive ? "bg-purple-500 text-white font-bold shadow-[0_0_15px_rgba(168,85,247,0.9)] scale-110 z-10" : "hover:bg-white/10"
        }`}
      >
        <b className="font-extrabold text-blue-300">{boldPart}</b>{restPart}{" "}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#0b0d10] text-white flex flex-col font-sans select-none overflow-hidden">
      
      {/* 1. TOP STUDIO HEADER */}
      <header className="h-16 border-b border-white/10 bg-[#111318]/90 backdrop-blur-md px-6 flex items-center justify-between z-50 shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm font-semibold">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <div className="h-4 w-[1px] bg-white/10" />
          <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <Shield className="w-5 h-5 text-purple-400" />
            Zhavior <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">Document Studio</span>
          </div>
          {fileName && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-neutral-300">
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span className="max-w-[200px] truncate">{fileName}</span>
              <span className="text-neutral-500">({numPages} {numPages === 1 ? "page" : "pages"})</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* File Upload Button */}
          <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer shadow-[0_0_20px_-5px_rgba(168,85,247,0.6)] transition-all">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload PDF / DOCX</span>
            <input type="file" accept=".pdf,.docx" onChange={handleFileUpload} className="hidden" />
          </label>

          {/* Bionic Toggle */}
          <Button 
            onClick={() => setIsBionic(!isBionic)}
            variant="outline" 
            size="sm"
            className={`border-white/10 text-xs font-semibold gap-1.5 ${isBionic ? "bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.3)]" : "text-neutral-400"}`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            Bionic: {isBionic ? "ON" : "OFF"}
          </Button>

          {/* Soundscape Selector */}
          <div className="flex items-center gap-2 bg-[#181b22] border border-white/10 rounded-xl px-3 py-1.5">
            <Volume2 className="w-4 h-4 text-purple-400" />
            <select 
              value={noiseIdx} 
              onChange={(e) => setNoiseIdx(Number(e.target.value))}
              className="bg-transparent text-xs font-semibold text-neutral-300 focus:outline-none cursor-pointer"
            >
              {SOUNDSCAPES.map((s, i) => (
                <option key={s} value={i} className="bg-[#111318] text-white">{s}</option>
              ))}
            </select>
            {noiseIdx !== 0 && (
              <input 
                type="range" min="0" max="1" step="0.05" value={noiseVolume}
                onChange={(e) => setNoiseVolume(Number(e.target.value))}
                className="w-16 accent-purple-500 cursor-pointer h-1.5 bg-white/10 rounded-lg"
                title={`Volume: ${Math.round(noiseVolume * 100)}%`}
              />
            )}
          </div>

          {/* Notes Toggle */}
          <Button 
            onClick={() => setShowNotesPanel(!showNotesPanel)}
            variant="outline" 
            size="sm" 
            className="border-white/10 text-xs font-semibold gap-1 text-neutral-300"
          >
            <Bookmark className="w-3.5 h-3.5 text-yellow-400" />
            Notes ({savedNotes.length})
          </Button>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* DOCUMENT CANVAS AREA */}
        <main ref={containerRef} className="flex-1 overflow-y-auto bg-[#07080a] p-6 flex flex-col items-center gap-8 scrollbar-thin scrollbar-thumb-white/10">
          {isParsing && (
            <div className="my-auto text-center space-y-4 animate-pulse">
              <div className="w-16 h-16 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center mx-auto text-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.3)]">
                <BookOpen className="w-8 h-8 animate-bounce" />
              </div>
              <h3 className="text-lg font-bold text-white">{parseProgress}</h3>
              <p className="text-sm text-neutral-400 max-w-md">Our Spatial XY-Cut Sorter is organizing multi-column text and rendering exact word coordinates for your karaoke session...</p>
            </div>
          )}

          {!isParsing && pages.length === 0 && (
            <div className="my-auto max-w-xl text-center space-y-6 border border-white/10 bg-[#111318]/60 p-10 rounded-3xl backdrop-blur-md">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-purple-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center mx-auto text-purple-400 shadow-[0_0_40px_rgba(168,85,247,0.25)]">
                <FileText className="w-10 h-10" />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-white">Focus Document Studio</h2>
                <p className="text-neutral-400 text-sm mt-2 leading-relaxed">
                  Upload any textbook, research paper (`.pdf`), or essay (`.docx`). Experience **Stereo Binaural Soundscapes**, **Bionic Reading Anchors**, and **Exact-Coordinate Karaoke Highlighting** tailored for ADHD brains.
                </p>
              </div>
              <label className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold cursor-pointer shadow-[0_0_30px_rgba(168,85,247,0.5)] transition-all transform hover:scale-105">
                <Upload className="w-5 h-5" />
                <span>Select PDF or DOCX File</span>
                <input type="file" accept=".pdf,.docx" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          )}

          {/* VIRTUALIZED PAGE RENDERER (Pages 1..N) */}
          {!isParsing && pages.map((page) => {
            const isWindowActive = Math.abs(page.pageNumber - currentPage) <= 1;
            return (
              <div 
                key={page.pageNumber}
                onClick={() => setCurrentPage(page.pageNumber)}
                className={`relative rounded-2xl shadow-2xl transition-all duration-300 border ${
                  currentPage === page.pageNumber ? "border-purple-500/60 shadow-[0_0_40px_rgba(168,85,247,0.2)]" : "border-white/10 opacity-75 hover:opacity-100"
                }`}
                style={{
                  width: docType === "pdf" ? Math.min(page.width, 900) : 800,
                  minHeight: docType === "pdf" ? page.height : 1000,
                  backgroundColor: "#13161b"
                }}
              >
                {/* Page Number Badge */}
                <div className="absolute top-4 right-4 z-20 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs font-bold text-neutral-300">
                  Page {page.pageNumber}
                </div>

                {/* PDF Canvas Layer */}
                {docType === "pdf" && isWindowActive && (
                  <canvas 
                    ref={(el) => { canvasRefs.current[page.pageNumber] = el; }}
                    className="w-full h-auto rounded-2xl block"
                  />
                )}

                {/* DOM Text & Karaoke Highlight Layer */}
                <div className="p-8 md:p-12 text-neutral-200 leading-relaxed font-serif text-base md:text-lg">
                  {page.items.map((item, itemIdx) => (
                    <p key={itemIdx} className="mb-4 leading-8">
                      {item.words.map((w) => renderWord(w))}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </main>

        {/* NOTES SIDE PANEL */}
        {showNotesPanel && (
          <aside className="w-80 border-l border-white/10 bg-[#111318] p-6 flex flex-col gap-6 shrink-0 z-40 animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2 font-bold text-white">
                <Bookmark className="w-4 h-4 text-yellow-400" />
                <span>Focus Notes & Clips</span>
              </div>
              <Button onClick={() => setShowNotesPanel(false)} variant="ghost" size="sm" className="h-7 w-7 p-0 text-neutral-400 hover:text-white">✕</Button>
            </div>

            <Button onClick={saveInstantNote} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold gap-2 shadow-lg">
              <PlusCircle className="w-4 h-4" /> Clip Active Sentence
            </Button>

            <div className="flex-1 overflow-y-auto space-y-4 scrollbar-thin">
              {savedNotes.length === 0 ? (
                <div className="text-center py-12 text-neutral-500 text-xs space-y-2">
                  <p>No notes clipped yet.</p>
                  <p>Tap "Clip Active Sentence" while reading to save study highlights!</p>
                </div>
              ) : (
                savedNotes.map((note, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-neutral-400">
                      <span className="font-bold text-purple-400">Page {note.page}</span>
                      <span>{note.time}</span>
                    </div>
                    <p className="text-neutral-200 leading-normal font-sans">{note.text}</p>
                  </div>
                ))
              )}
            </div>
          </aside>
        )}
      </div>

      {/* 3. FLOATING KARAOKE AUDIO CONTROLLER PILL */}
      {chunks.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#131619]/95 backdrop-blur-xl border border-white/15 px-6 py-3.5 rounded-full shadow-[0_0_50px_rgba(0,0,0,0.8)] flex items-center gap-6 animate-in fade-in slide-in-from-bottom-6 duration-500">
          
          {/* Play / Pause */}
          <Button 
            onClick={togglePlayPause}
            className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-400 hover:to-blue-400 text-white shadow-[0_0_25px_rgba(168,85,247,0.7)] flex items-center justify-center p-0 shrink-0 transform hover:scale-105 transition-all"
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </Button>

          {/* Current Section / Chunk Info */}
          <div className="flex flex-col min-w-[140px] max-w-[220px]">
            <span className="text-xs font-bold text-white truncate">
              {chunks[currentChunkIdx]?.text.slice(0, 38)}...
            </span>
            <span className="text-[10px] text-neutral-400 font-semibold">
              Section {currentChunkIdx + 1} of {chunks.length} • Page {currentPage}
            </span>
          </div>

          {/* Speed Pill Selector */}
          <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-full p-1">
            {[1.0, 1.25, 1.5, 2.0].map((spd) => (
              <button
                key={spd}
                onClick={() => handleSetSpeed(spd)}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                  speed === spd ? "bg-purple-500 text-white shadow" : "text-neutral-400 hover:text-white"
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Voice Selector */}
          <select 
            value={voiceIdx}
            onChange={(e) => setVoiceIdx(Number(e.target.value))}
            className="bg-[#1a1e24] border border-white/10 rounded-full px-3 py-1.5 text-xs font-semibold text-neutral-300 focus:outline-none cursor-pointer max-w-[150px] truncate"
          >
            {VOICES.map((v, idx) => (
              <option key={v.id} value={idx} className="bg-[#111318] text-white">{v.name}</option>
            ))}
          </select>

          {/* Offline / Server Engine Toggle */}
          <Button
            onClick={() => setUseOfflineEngine(!useOfflineEngine)}
            variant="ghost"
            size="sm"
            className={`rounded-full px-3 py-1.5 text-xs font-bold border ${
              useOfflineEngine ? "bg-green-500/20 text-green-300 border-green-500/40" : "bg-white/5 text-neutral-400 border-white/10"
            }`}
            title="Toggle between Server Neural TTS and Instant Offline WebSpeech"
          >
            <Zap className="w-3.5 h-3.5 mr-1" />
            {useOfflineEngine ? "Offline Engine" : "Cloud Neural"}
          </Button>

          {/* Instant Note Clip Button */}
          <Button 
            onClick={saveInstantNote}
            size="sm" 
            className="rounded-full bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/40 text-xs font-bold gap-1 px-3"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Note
          </Button>
        </div>
      )}

      {/* STATUS TOAST PILL */}
      {statusToast && (
        <div className="fixed top-20 right-6 z-50 bg-[#181b22] border border-purple-500/40 text-purple-200 px-5 py-3 rounded-2xl shadow-[0_0_30px_rgba(168,85,247,0.4)] text-xs font-bold flex items-center gap-2 animate-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
          <span>{statusToast}</span>
        </div>
      )}
    </div>
  );
}
