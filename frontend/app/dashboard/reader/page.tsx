"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import DocumentSidebar from "@/components/reader/DocumentSidebar";
import ReaderViewport, { PageData, WordSpan } from "@/components/reader/ReaderViewport";
import AudioInspectorPanel from "@/components/reader/AudioInspectorPanel";
import FloatingStudioControls from "@/components/reader/FloatingStudioControls";
import { ReaderDoc } from "@/lib/db";
import { 
  buildWordTimings, 
  parseDocxParagraphsAsync, 
  extractPdfPagesAsync, 
  ChunkData 
} from "@/lib/documentParser";

const NEURAL_VOICES = [
  { name: "Samantha (US Female)", id: "Samantha", edgeId: "en-US-JennyNeural" },
  { name: "Evan (US Male Warm)", id: "Evan", edgeId: "en-US-GuyNeural" },
  { name: "Reed (US Standard Male)", id: "Reed (English (US))", edgeId: "en-US-ChristopherNeural" },
  { name: "Daniel (UK British Male)", id: "Daniel", edgeId: "en-GB-RyanNeural" },
  { name: "Flo (US Female Calm)", id: "Flo (English (US))", edgeId: "en-US-AriaNeural" }
];

export default function DocumentStudioPage() {
  // 1. Sidebar & Library State
  const [docs, setDocs] = useState<ReaderDoc[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);

  // 2. Document & Extraction State
  const [docType, setDocType] = useState<"pdf" | "docx" | "none">("none");
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pages, setPages] = useState<PageData[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(1);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // 3. Audio & Karaoke State
  const [chunks, setChunks] = useState<ChunkData[]>([]);
  const [currentChunkIdx, setCurrentChunkIdx] = useState<number>(0);
  const [activeWordIdx, setActiveWordIdx] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1.25);
  const [voiceIdx, setVoiceIdx] = useState<number>(0);
  const [isBionic, setIsBionic] = useState<boolean>(false);

  // 4. Studio Soundscapes & Notes State
  const [noiseIdx, setNoiseIdx] = useState<number>(0);
  const [noiseVolume, setNoiseVolume] = useState<number>(0.15);
  const [savedNotes, setSavedNotes] = useState<{ text: string; page: number; time: string }[]>([]);

  // 5. Refs for Rolling Audio Cache & WebAudio
  const audioElemRef = useRef<HTMLAudioElement | null>(null);
  const prefetchedBlobUrlsRef = useRef<{ [idx: number]: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const noiseNodeRef = useRef<AudioNode | null>(null);
  const noiseGainRef = useRef<GainNode | null>(null);

  // Load saved document sessions and pdf.js on mount
  useEffect(() => {
    if (typeof window !== "undefined" && !(window as any).pdfjsLib) {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.async = true;
      script.onload = () => {
        if ((window as any).pdfjsLib) {
          (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        }
      };
      document.body.appendChild(script);
    }

    fetch("/api/reader-docs")
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.docs)) {
          setDocs(data.docs);
          // If docs exist and none active, load the first one from local IndexedDB if cached
          if (data.docs.length > 0 && !activeDocId) {
            loadDocFromStorage(data.docs[0]);
          }
        }
      })
      .catch(err => console.error("Error loading reader vault:", err));
  }, []);

  // WebAudio Soundscape Engine Generator
  useEffect(() => {
    if (noiseIdx === 0) {
      if (noiseGainRef.current && audioCtxRef.current) {
        try { noiseGainRef.current.gain.setValueAtTime(0, audioCtxRef.current.currentTime); } catch {}
      }
      return;
    }

    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) audioCtxRef.current = new AudioCtx();
    }
    if (!audioCtxRef.current) return;
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();

    // Clean up old noise node if needed
    if (noiseNodeRef.current) {
      try { noiseNodeRef.current.disconnect(); } catch {}
    }

    const ctx = audioCtxRef.current;
    if (!noiseGainRef.current) {
      noiseGainRef.current = ctx.createGain();
      noiseGainRef.current.connect(ctx.destination);
    }
    noiseGainRef.current.gain.setValueAtTime(noiseVolume, ctx.currentTime);

    // Generate White / Pink / Brown noise buffer
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      if (noiseIdx === 1) { // Brown Noise (Deep focus)
        lastOut = (lastOut + (0.02 * white)) / 1.02;
        data[i] = lastOut * 3.5;
      } else if (noiseIdx === 2) { // Pink Noise (Relaxing)
        lastOut = (lastOut * 0.95) + (white * 0.05);
        data[i] = lastOut * 2.0;
      } else { // White Noise / Rain
        data[i] = white * 0.4;
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(noiseGainRef.current);
    source.start();
    noiseNodeRef.current = source;

    return () => {
      try { source.stop(); source.disconnect(); } catch {}
    };
  }, [noiseIdx]);

  useEffect(() => {
    if (noiseGainRef.current && audioCtxRef.current && noiseIdx !== 0) {
      try { noiseGainRef.current.gain.setValueAtTime(noiseVolume, audioCtxRef.current.currentTime); } catch {}
    }
  }, [noiseVolume, noiseIdx]);

  // Save document text/pages into IndexedDB for instant offline recovery
  const saveDocToStorage = async (doc: ReaderDoc, pageList: PageData[], chunkList: ChunkData[]) => {
    try {
      localStorage.setItem(`fr_doc_meta_${doc.id}`, JSON.stringify({ pageList, chunkList }));
    } catch {}
  };

  const loadDocFromStorage = async (doc: ReaderDoc) => {
    try {
      const cached = localStorage.getItem(`fr_doc_meta_${doc.id}`);
      if (cached) {
        setTimeout(() => {
          try {
            const { pageList, chunkList } = JSON.parse(cached);
            setPages(pageList);
            setChunks(chunkList);
            setNumPages(doc.num_pages);
            setCurrentPage(doc.current_page || 1);
            setCurrentChunkIdx(doc.current_chunk || 0);
            setDocType(doc.doc_type || "pdf");
            setActiveDocId(doc.id);
          } catch {}
        }, 10);
      }
    } catch {}
  };

  // Global Keyboard Navigation (`Space`, `←/→`, `B`, `S`)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        setCurrentChunkIdx(prev => Math.max(0, prev - 1));
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        setCurrentChunkIdx(prev => Math.min(chunks.length - 1, prev + 1));
      } else if (e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsBionic(prev => !prev);
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        setNoiseIdx(prev => (prev + 1) % 4);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [chunks.length]);

  // Upload Document Handler using Non-Blocking Document Parser
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);

    const isPdf = file.name.endsWith(".pdf");
    const isDocx = file.name.endsWith(".docx") || file.name.endsWith(".txt");

    if (!isPdf && !isDocx) {
      alert("Please upload a valid .pdf, .docx, or .txt file.");
      setIsUploading(false);
      return;
    }

    if (isDocx) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch("/api/extract", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to extract document.");

        const paragraphs: string[] = data.paragraphs || [data.text];
        const { pages: newPages, chunks: allChunks, totalWords } = await parseDocxParagraphsAsync(paragraphs, 1);

        setPages(newPages);
        setChunks(allChunks);
        setNumPages(1);
        setCurrentPage(1);
        setCurrentChunkIdx(0);
        setDocType("docx");
        setPdfDoc(null);

        // Register document in vault
        const saveRes = await fetch("/api/reader-docs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: file.name, docType: "docx", numPages: 1, totalWords })
        });
        const savedData = await saveRes.json();
        if (savedData.success) {
          setDocs(prev => [savedData.doc, ...prev.filter(d => d.id !== savedData.doc.id)]);
          setActiveDocId(savedData.doc.id);
          saveDocToStorage(savedData.doc, newPages, allChunks);
        }
      } catch (err: any) {
        alert("Error loading DOCX: " + err.message);
      } finally {
        setIsUploading(false);
      }
      return;
    }

    // PDF Processing with exact word coordinates via pdf.js & non-blocking yielding
    if (isPdf && (window as any).pdfjsLib) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await (window as any).pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setCurrentPage(1);
        setDocType("pdf");

        // Extract using our non-blocking helper
        const { pages: allPages, chunks: allChunks, totalWords } = await extractPdfPagesAsync(
          pdf,
          60,
          (progressPages, progressChunks, curPage, total) => {
            setPages(progressPages);
            setChunks(progressChunks);
            if (curPage === 1) {
              setCurrentChunkIdx(0);
              setIsUploading(false); // Unblock UI immediately after Page 1 renders!
            }
          }
        );

        setPages(allPages);
        setChunks(allChunks);

        const saveRes = await fetch("/api/reader-docs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: file.name, docType: "pdf", numPages: pdf.numPages, totalWords })
        });
        const savedData = await saveRes.json();
        if (savedData.success) {
          setDocs(prev => [savedData.doc, ...prev.filter(d => d.id !== savedData.doc.id)]);
          setActiveDocId(savedData.doc.id);
          saveDocToStorage(savedData.doc, allPages, allChunks);
        }
      } catch (err: any) {
        alert("Error parsing PDF: " + err.message);
        setIsUploading(false);
      }
    } else {
      setIsUploading(false);
    }
  };

  // Audio Synthesizer & Pre-buffer Engine
  // Audio Synthesizer & Pre-buffer Engine
  const fetchAudioBlob = async (idx: number): Promise<string | null> => {
    if (prefetchedBlobUrlsRef.current[idx]) {
      return prefetchedBlobUrlsRef.current[idx];
    }
    const chunk = chunks[idx];
    if (!chunk) return null;

    const activeVoiceObj = NEURAL_VOICES[voiceIdx] || NEURAL_VOICES[0];
    // Keep backend credentials server-side through the authenticated TTS proxy.
    const endpoints = ["/api/tts"];

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: chunk.text,
            voiceId: activeVoiceObj.id,
            voice: activeVoiceObj.edgeId,
            rate: speed !== 1.0 ? `${Math.round((speed - 1) * 100)}%` : "+0%"
          })
        });

        if (res.ok) {
          const blob = await res.blob();
          if (blob && blob.size > 100) {
            const url = URL.createObjectURL(blob);
            prefetchedBlobUrlsRef.current[idx] = url;
            return url;
          }
        }
      } catch (err) {}
    }

    // Fallback: Local browser WebSpeech synthesis if backend unreachable
    return "WEBSPEECH_LOCAL";
  };

  // Play Active Chunk with State-of-the-Art Acoustic Sub-Word Sync
  useEffect(() => {
    if (!isPlaying) {
      if (audioElemRef.current) audioElemRef.current.pause();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      return;
    }

    const chunk = chunks[currentChunkIdx];
    if (!chunk) {
      setIsPlaying(false);
      return;
    }

    // Update current page if section jumped
    if (chunk.pageIdx !== currentPage) {
      setCurrentPage(chunk.pageIdx);
    }
    setActiveWordIdx(chunk.startWordIdx);

    // Sync progress to backend
    if (activeDocId) {
      fetch("/api/reader-docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_progress", id: activeDocId, currentPage: chunk.pageIdx, currentChunk: currentChunkIdx })
      }).catch(() => {});
    }

    let isAborted = false;
    let animationFrameId: number | null = null;

    // Build acoustic word weights precisely from central documentParser helper
    const wordTokens = buildWordTimings(chunk.text);

    fetchAudioBlob(currentChunkIdx).then(audioSrc => {
      if (isAborted || !isPlaying) return;

      if (audioSrc === "WEBSPEECH_LOCAL" || !audioSrc) {
        // Local WebSpeech
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(chunk.text);
          utterance.rate = speed;
          utterance.onboundary = (e) => {
            if (e.name === "word") {
              const approxWordOffset = Math.floor((e.charIndex / Math.max(1, chunk.text.length)) * (chunk.endWordIdx - chunk.startWordIdx));
              setActiveWordIdx(chunk.startWordIdx + approxWordOffset);
            }
          };
          utterance.onend = () => {
            if (!isAborted && isPlaying) {
              if (currentChunkIdx + 1 < chunks.length) {
                setCurrentChunkIdx(prev => prev + 1);
              } else {
                setIsPlaying(false);
              }
            }
          };
          window.speechSynthesis.speak(utterance);
        }
      } else {
        // Play High-Fidelity Audio Buffer
        if (!audioElemRef.current) {
          audioElemRef.current = new Audio();
        }
        const audio = audioElemRef.current;
        audio.src = audioSrc;
        audio.playbackRate = speed;

        const step = () => {
          if (!audio || audio.paused || audio.ended || isAborted) {
            animationFrameId = null;
            return;
          }
          let duration = audio.duration;
          if (!duration || isNaN(duration) || !isFinite(duration) || duration <= 0) {
            duration = Math.max(1, chunk.text.length / (14 * speed));
          }
          const frac = Math.min(1, Math.max(0, audio.currentTime / duration));
          if (wordTokens.length > 0) {
            let lo = 0, hi = wordTokens.length - 1;
            while (lo < hi) {
              const mid = (lo + hi) >> 1;
              if (wordTokens[mid].endFrac <= frac) lo = mid + 1;
              else hi = mid;
            }
            setActiveWordIdx(chunk.startWordIdx + lo);
          }
          animationFrameId = requestAnimationFrame(step);
        };

        audio.onplay = () => {
          if (animationFrameId) cancelAnimationFrame(animationFrameId);
          animationFrameId = requestAnimationFrame(step);
        };

        audio.onended = () => {
          if (animationFrameId) cancelAnimationFrame(animationFrameId);
          if (!isAborted && isPlaying) {
            if (currentChunkIdx + 1 < chunks.length) {
              setCurrentChunkIdx(prev => prev + 1);
            } else {
              setIsPlaying(false);
            }
          }
        };
        audio.play().catch(() => setIsPlaying(false));
      }

      // Pre-buffer next chunk for zero latency
      if (currentChunkIdx + 1 < chunks.length) {
        fetchAudioBlob(currentChunkIdx + 1);
      }
    });

    return () => {
      isAborted = true;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (audioElemRef.current) {
        audioElemRef.current.pause();
      }
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isPlaying, currentChunkIdx, speed, voiceIdx]);

  const handleDeleteDoc = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Remove document from your Focus Vault?")) return;
    try {
      await fetch(`/api/reader-docs?id=${id}`, { method: "DELETE" });
      setDocs(prev => prev.filter(d => d.id !== id));
      localStorage.removeItem(`fr_doc_meta_${id}`);
      if (activeDocId === id) {
        setActiveDocId(null);
        setPages([]);
        setChunks([]);
        setDocType("none");
      }
    } catch {}
  };

  const activeWordSpan = chunks[currentChunkIdx]?.text || "";

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        onChange={handleFileUpload}
        className="hidden"
      />

      <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-[#0a0b0e] text-white font-sans">
        
        {/* LEFT: DOCUMENT LIBRARY SIDEBAR */}
        <DocumentSidebar
          docs={docs}
          activeDocId={activeDocId}
          onSelectDoc={(doc) => {
            setActiveDocId(doc.id);
            loadDocFromStorage(doc);
          }}
          onUploadClick={() => fileInputRef.current?.click()}
          onDeleteDoc={handleDeleteDoc}
          isOpen={isSidebarOpen}
          onToggleOpen={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {/* CENTER: READER VIEWPORT */}
        <ReaderViewport
          docType={docType}
          pages={pages}
          currentPage={currentPage}
          numPages={numPages}
          onPageChange={(p) => setCurrentPage(p)}
          activeWordIdx={activeWordIdx}
          onWordClick={(gIdx) => {
            const matchChunk = chunks.find(c => gIdx >= c.startWordIdx && gIdx <= c.endWordIdx);
            if (matchChunk) {
              setCurrentChunkIdx(matchChunk.chunkIdx);
              setActiveWordIdx(gIdx);
            }
          }}
          isBionic={isBionic}
          onToggleBionic={() => setIsBionic(!isBionic)}
          pdfDoc={pdfDoc}
        />

        {/* RIGHT: STUDIO AUDIO & AI INSPECTOR PANEL */}
        <AudioInspectorPanel
          chunks={chunks}
          currentChunkIdx={currentChunkIdx}
          onSelectChunk={(idx) => setCurrentChunkIdx(idx)}
          speed={speed}
          onSpeedChange={(s) => setSpeed(s)}
          voiceIdx={voiceIdx}
          onVoiceChange={(idx) => setVoiceIdx(idx)}
          noiseIdx={noiseIdx}
          onNoiseChange={(idx) => setNoiseIdx(idx)}
          noiseVolume={noiseVolume}
          onNoiseVolumeChange={(v) => setNoiseVolume(v)}
          savedNotes={savedNotes}
          onSaveNote={() => {
            const text = chunks[currentChunkIdx]?.text;
            if (text) {
              setSavedNotes(prev => [{
                text,
                page: currentPage,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }, ...prev]);
            }
          }}
          onDeleteNote={(idx) => setSavedNotes(prev => prev.filter((_, i) => i !== idx))}
          currentPage={currentPage}
          isOpen={isInspectorOpen}
          onToggleOpen={() => setIsInspectorOpen(!isInspectorOpen)}
        />

        {/* BOTTOM: FLOATING TITANIUM CONTROLS BAR */}
        <FloatingStudioControls
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying(!isPlaying)}
          onPrevChunk={() => setCurrentChunkIdx(prev => Math.max(0, prev - 1))}
          onNextChunk={() => setCurrentChunkIdx(prev => Math.min(chunks.length - 1, prev + 1))}
          activeChunkText={activeWordSpan}
          speed={speed}
          onSpeedChange={(s) => setSpeed(s)}
          isBionic={isBionic}
          onToggleBionic={() => setIsBionic(!isBionic)}
          isInspectorOpen={isInspectorOpen}
          onToggleInspector={() => setIsInspectorOpen(!isInspectorOpen)}
        />
      </div>

      {isUploading && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center gap-4 text-white">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="font-extrabold text-sm tracking-wide">Extracting layout & generating bionic anchors...</p>
        </div>
      )}
    </>
  );
}
