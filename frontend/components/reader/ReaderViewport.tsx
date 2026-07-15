"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { 
  ZoomIn, ZoomOut, Maximize2, Sparkles, Type, Moon, Sun, 
  Palette, ChevronLeft, ChevronRight, Layout, BookOpen, Sliders
} from "lucide-react";

export interface WordSpan {
  globalIdx: number;
  pageIdx: number;
  itemIdx: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageData {
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

interface ReaderViewportProps {
  docType: "pdf" | "docx" | "none";
  pages: PageData[];
  currentPage: number;
  numPages: number;
  onPageChange: (page: number) => void;
  activeWordIdx: number;
  onWordClick: (globalIdx: number) => void;
  isBionic: boolean;
  onToggleBionic: () => void;
  pdfDoc: any;
}

const FONTS = [
  { name: "Inter (Sans)", class: "font-sans" },
  { name: "Merriweather (Serif)", class: "font-serif" },
  { name: "JetBrains (Mono)", class: "font-mono" },
  { name: "OpenDyslexic", class: "font-sans tracking-wide word-spacing-wide" }
];

const THEMES = [
  { name: "Brushed Titanium", bg: "#13161c", text: "#e2e8f0", border: "#222733", highlight: "bg-purple-500/80 text-white shadow-[0_0_15px_rgba(168,85,247,0.8)]" },
  { name: "Sandblasted Slate", bg: "#181c24", text: "#cbd5e1", border: "#2a313f", highlight: "bg-blue-500/80 text-white shadow-[0_0_15px_rgba(59,130,246,0.8)]" },
  { name: "OLED Deep Black", bg: "#07080a", text: "#f8fafc", border: "#1e222a", highlight: "bg-purple-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.9)]" },
  { name: "Sepia Parchment", bg: "#28231d", text: "#e8ded1", border: "#3c352c", highlight: "bg-amber-600/90 text-white shadow-[0_0_15px_rgba(217,119,6,0.8)]" }
];

const MemoizedParagraph = React.memo(({ item, hasActiveWord, renderWordSpan }: any) => {
  return (
    <p className="mb-4 md:mb-6 text-justify leading-relaxed">
      {item.words.map((w: WordSpan) => renderWordSpan(w))}
    </p>
  );
}, (prev, next) => {
  return prev.item === next.item && prev.hasActiveWord === next.hasActiveWord && prev.renderWordSpan === next.renderWordSpan;
});

export default function ReaderViewport({
  docType,
  pages,
  currentPage,
  numPages,
  onPageChange,
  activeWordIdx,
  onWordClick,
  isBionic,
  onToggleBionic,
  pdfDoc
}: ReaderViewportProps) {
  const [viewMode, setViewMode] = useState<"original" | "reflow">("original");
  const [zoom, setZoom] = useState<number>(1.25);
  const [fontIdx, setFontIdx] = useState<number>(0);
  const [themeIdx, setThemeIdx] = useState<number>(0);
  const [lineSpacing, setLineSpacing] = useState<"snug" | "relaxed" | "spacious">("relaxed");

  const canvasRefs = useRef<{ [page: number]: HTMLCanvasElement | null }>({});
  const renderedBitmapCacheRef = useRef<{ [page: number]: string }>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<{ [page: number]: HTMLDivElement | null }>({});
  const isAutoScrollingRef = useRef<boolean>(false);

  const activeTheme = THEMES[themeIdx] || THEMES[0];
  const activeFont = FONTS[fontIdx] || FONTS[0];

  // Auto-switch to reflow mode for DOCX
  useEffect(() => {
    if (docType === "docx") {
      setViewMode("reflow");
    }
  }, [docType]);

  // Smoothly and instantly scroll viewport to the active page when currentPage changes
  useEffect(() => {
    const el = pageRefs.current[currentPage];
    if (el && containerRef.current) {
      isAutoScrollingRef.current = true;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      const timer = setTimeout(() => {
        isAutoScrollingRef.current = false;
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [currentPage]);

  // Automatically update currentPage when scrolling through document pages
  const handleScroll = () => {
    if (isAutoScrollingRef.current || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const containerMidY = containerRect.top + containerRect.height / 3;

    let closestPage = currentPage;
    let minDistance = Infinity;

    pages.forEach((page) => {
      const el = pageRefs.current[page.pageNumber];
      if (el) {
        const rect = el.getBoundingClientRect();
        const distance = Math.abs(rect.top - containerMidY);
        if (distance < minDistance) {
          minDistance = distance;
          closestPage = page.pageNumber;
        }
      }
    });

    if (closestPage !== currentPage && Math.abs(closestPage - currentPage) === 1) {
      onPageChange(closestPage);
    }
  };

  // Virtualized Canvas Rendering for PDF in Original Mode
  useEffect(() => {
    if (docType !== "pdf" || !pdfDoc || pages.length === 0 || viewMode !== "original") return;

    const pagesToRender = [currentPage - 1, currentPage, currentPage + 1].filter(p => p >= 1 && p <= numPages);

    pagesToRender.forEach(async (pNum) => {
      const canvas = canvasRefs.current[pNum];
      if (!canvas || canvas.getAttribute("data-rendered") === "true") return;

      const cachedImg = renderedBitmapCacheRef.current[pNum];
      if (cachedImg) {
        const img = new Image();
        img.onload = () => {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            canvas.setAttribute("data-rendered", "true");
          }
        };
        img.src = cachedImg;
        return;
      }

      try {
        const page = await pdfDoc.getPage(pNum);
        const viewport = page.getViewport({ scale: zoom * 1.3 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
          canvas.setAttribute("data-rendered", "true");
          try {
            renderedBitmapCacheRef.current[pNum] = canvas.toDataURL("image/webp", 0.85);
          } catch {}
        }
      } catch (err) {
        console.error(`Error rendering page ${pNum}:`, err);
      }
    });
  }, [currentPage, docType, pages, numPages, viewMode, zoom, pdfDoc]);

  // Handle Zoom Reset
  const handleSetZoom = (delta: number) => {
    const next = Math.min(2.5, Math.max(0.75, zoom + delta));
    setZoom(next);
    // Clear cache to re-render sharp canvas at new scale
    renderedBitmapCacheRef.current = {};
    Object.values(canvasRefs.current).forEach(c => {
      if (c) c.removeAttribute("data-rendered");
    });
  };

  // Helper to render individual Bionic/Karaoke word
  const renderWordSpan = (w: WordSpan) => {
    const isActive = w.globalIdx === activeWordIdx;
    
    if (!isBionic || w.text.length <= 3) {
      return (
        <span
          key={w.globalIdx}
          onClick={(e) => { e.stopPropagation(); onWordClick(w.globalIdx); }}
          className={`cursor-pointer transition-all duration-150 rounded px-0.5 inline-block ${
            isActive ? `${activeTheme.highlight} font-bold scale-110 z-10` : "hover:bg-white/10"
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
        onClick={(e) => { e.stopPropagation(); onWordClick(w.globalIdx); }}
        className={`cursor-pointer transition-all duration-150 rounded px-0.5 inline-block ${
          isActive ? `${activeTheme.highlight} font-bold scale-110 z-10` : "hover:bg-white/10"
        }`}
      >
        <b className="font-extrabold text-blue-400">{boldPart}</b>{restPart}{" "}
      </span>
    );
  };

  const lineSpacingClasses = {
    snug: "leading-relaxed space-y-3",
    relaxed: "leading-8 space-y-5",
    spacious: "leading-10 space-y-7"
  }[lineSpacing];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0b0e] relative select-none">
      
      {/* 1. TOP TYPOGRAPHY & VIEW CONTROLLER TOOLBAR */}
      <div className="h-13 border-b border-white/10 bg-[#12141a]/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-3 z-20 shrink-0">
        
        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-[#171a22] border border-white/10 p-1 rounded-xl">
          {docType === "pdf" && (
            <button
              onClick={() => setViewMode("original")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                viewMode === "original"
                  ? "bg-purple-500 text-white shadow-md"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Layout className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Original PDF</span>
            </button>
          )}
          <button
            onClick={() => setViewMode("reflow")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              viewMode === "reflow"
                ? "bg-purple-500 text-white shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Reflow Typography</span>
          </button>
        </div>

        {/* Formatting Controls Bar */}
        <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-end">
          
          {/* Bionic Toggle Pill */}
          <button
            onClick={onToggleBionic}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all ${
              isBionic
                ? "bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                : "bg-white/5 text-neutral-400 border-white/10 hover:border-white/20"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Bionic: {isBionic ? "ON" : "OFF"}</span>
          </button>

          {/* Zoom Controls (Original Mode) */}
          {viewMode === "original" && docType === "pdf" && (
            <div className="hidden sm:flex items-center gap-1 bg-[#171a22] border border-white/10 rounded-xl px-2 py-1 text-xs text-neutral-300 font-bold">
              <button onClick={() => handleSetZoom(-0.15)} className="p-1 hover:text-white"><ZoomOut className="w-3.5 h-3.5" /></button>
              <span className="w-11 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => handleSetZoom(0.15)} className="p-1 hover:text-white"><ZoomIn className="w-3.5 h-3.5" /></button>
            </div>
          )}

          {/* Font Selector (Reflow Mode) */}
          {viewMode === "reflow" && (
            <>
              <select
                value={fontIdx}
                onChange={(e) => setFontIdx(Number(e.target.value))}
                className="bg-[#171a22] border border-white/10 rounded-xl px-3 py-1.5 text-xs font-semibold text-neutral-300 focus:outline-none cursor-pointer max-w-[140px]"
              >
                {FONTS.map((f, i) => (
                  <option key={f.name} value={i} className="bg-[#111318] text-white">{f.name}</option>
                ))}
              </select>

              <select
                value={lineSpacing}
                onChange={(e: any) => setLineSpacing(e.target.value)}
                className="hidden sm:block bg-[#171a22] border border-white/10 rounded-xl px-3 py-1.5 text-xs font-semibold text-neutral-300 focus:outline-none cursor-pointer"
              >
                <option value="snug">Snug Lines</option>
                <option value="relaxed">Relaxed Lines</option>
                <option value="spacious">Spacious Lines</option>
              </select>

              <select
                value={themeIdx}
                onChange={(e) => setThemeIdx(Number(e.target.value))}
                className="bg-[#171a22] border border-white/10 rounded-xl px-3 py-1.5 text-xs font-semibold text-neutral-300 focus:outline-none cursor-pointer max-w-[150px]"
              >
                {THEMES.map((t, i) => (
                  <option key={t.name} value={i} className="bg-[#111318] text-white">{t.name}</option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      {/* 2. MAIN DOCUMENT VIEWPORT AREA */}
      <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto reader-viewport-container p-4 md:p-8 flex flex-col items-center gap-8 scrollbar-thin scrollbar-thumb-white/10">
        
        {pages.length === 0 ? (
          <div className="my-auto text-center space-y-3 text-neutral-500">
            <BookOpen className="w-10 h-10 mx-auto opacity-50" />
            <p className="text-sm">Select or upload a document from the vault to begin.</p>
          </div>
        ) : (
          pages.map((page) => {
            const isWindowActive = Math.abs(page.pageNumber - currentPage) <= 1;
            const isCurrent = page.pageNumber === currentPage;

            if (viewMode === "original" && docType === "pdf") {
              // PDF Canvas with Exact Word Overlay
              return (
                <div
                  key={page.pageNumber}
                  ref={(el) => { pageRefs.current[page.pageNumber] = el; }}
                  onClick={() => onPageChange(page.pageNumber)}
                  className={`reader-page-item relative rounded-2xl shadow-2xl transition-all duration-300 border ${
                    isCurrent ? "border-purple-500/60 shadow-[0_0_40px_rgba(168,85,247,0.2)]" : "border-white/10 opacity-75 hover:opacity-100"
                  }`}
                  style={{
                    width: Math.min(page.width * (zoom / 1.25), 1000),
                    minHeight: page.height * (zoom / 1.25),
                    backgroundColor: "#13161c"
                  }}
                >
                  <div className="absolute top-4 right-4 z-20 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-xs font-bold text-neutral-300">
                    Page {page.pageNumber}
                  </div>

                  {isWindowActive && (
                    <canvas
                      ref={(el) => {
                        canvasRefs.current[page.pageNumber] = el;
                        if (el && renderedBitmapCacheRef.current[page.pageNumber] && el.getAttribute("data-rendered") !== "true") {
                          const img = new Image();
                          img.onload = () => {
                            const ctx = el.getContext("2d");
                            if (ctx) {
                              el.width = page.width * (zoom / 1.25);
                              el.height = page.height * (zoom / 1.25);
                              ctx.drawImage(img, 0, 0, el.width, el.height);
                              el.setAttribute("data-rendered", "true");
                            }
                          };
                          img.src = renderedBitmapCacheRef.current[page.pageNumber];
                        }
                      }}
                      className="w-full h-auto rounded-2xl block"
                    />
                  )}

                  {/* DOM Word Overlay for Karaoke Highlights (Virtualized for high performance) */}
                  {isWindowActive ? (
                    <div className="p-8 md:p-12 text-neutral-200 leading-relaxed font-serif text-base md:text-lg">
                      {page.items.map((item, idx) => {
                        const startIdx = item.words[0]?.globalIdx ?? -1;
                        const endIdx = item.words[item.words.length - 1]?.globalIdx ?? -1;
                        const hasActiveWord = activeWordIdx >= startIdx && activeWordIdx <= endIdx;
                        return (
                          <MemoizedParagraph
                            key={idx}
                            item={item}
                            hasActiveWord={hasActiveWord}
                            renderWordSpan={renderWordSpan}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-24 text-center space-y-3 text-neutral-500">
                      <BookOpen className="w-8 h-8 mx-auto opacity-30" />
                      <p className="text-sm font-semibold">Page {page.pageNumber} (Virtualized for 60fps Performance)</p>
                      <span className="text-xs text-purple-400/80 underline cursor-pointer">Click to jump directly to Page {page.pageNumber}</span>
                    </div>
                  )}
                </div>
              );
            }

            // REFLOWABLE TYPOGRAPHY MODE (Sleek Titanium/Slate surface)
            return (
              <div
                key={page.pageNumber}
                ref={(el) => { pageRefs.current[page.pageNumber] = el; }}
                onClick={() => onPageChange(page.pageNumber)}
                className={`reader-page-item w-full max-w-3xl rounded-3xl p-8 md:p-14 transition-all duration-300 border shadow-2xl ${
                  isCurrent ? "border-purple-500/50 shadow-[0_0_50px_rgba(0,0,0,0.6)] scale-[1.01]" : "border-white/10 opacity-80 hover:opacity-100"
                }`}
                style={{
                  backgroundColor: activeTheme.bg,
                  color: activeTheme.text,
                  borderColor: isCurrent ? undefined : activeTheme.border
                }}
              >
                <div className="flex items-center justify-between pb-6 mb-6 border-b border-white/10 text-xs font-bold text-neutral-400">
                  <span className="tracking-widest uppercase">Page {page.pageNumber} of {numPages}</span>
                  <span className="text-purple-400 font-extrabold">HYPERFI STUDIO</span>
                </div>

                {isWindowActive ? (
                  <div className={`${activeFont.class} ${lineSpacingClasses} text-base md:text-xl`}>
                    {page.items.map((item, idx) => {
                      const startIdx = item.words[0]?.globalIdx ?? -1;
                      const endIdx = item.words[item.words.length - 1]?.globalIdx ?? -1;
                      const hasActiveWord = activeWordIdx >= startIdx && activeWordIdx <= endIdx;
                      return (
                        <MemoizedParagraph
                          key={idx}
                          item={item}
                          hasActiveWord={hasActiveWord}
                          renderWordSpan={renderWordSpan}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-24 text-center space-y-3 text-neutral-500">
                    <BookOpen className="w-8 h-8 mx-auto opacity-30" />
                    <p className="text-sm font-semibold">Page {page.pageNumber} (Virtualized for 60fps Performance)</p>
                    <span className="text-xs text-purple-400/80 underline cursor-pointer">Click to jump directly to Page {page.pageNumber}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 3. BOTTOM PAGE NAVIGATION BAR */}
      {numPages > 1 && (
        <div className="h-12 bg-[#12141a]/90 border-t border-white/10 px-6 flex items-center justify-between text-xs text-neutral-400 font-semibold shrink-0 z-20">
          <Button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            variant="ghost"
            size="sm"
            className="text-neutral-300 hover:text-white gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </Button>

          <div className="flex items-center gap-2">
            <span>Page</span>
            <input
              type="number"
              min={1}
              max={numPages}
              value={currentPage}
              onChange={(e) => {
                const p = Number(e.target.value);
                if (p >= 1 && p <= numPages) onPageChange(p);
              }}
              className="w-12 bg-[#1c1f28] border border-white/10 rounded-lg py-1 text-center font-bold text-white focus:outline-none focus:border-purple-500"
            />
            <span>of {numPages}</span>
          </div>

          <Button
            onClick={() => onPageChange(Math.min(numPages, currentPage + 1))}
            disabled={currentPage >= numPages}
            variant="ghost"
            size="sm"
            className="text-neutral-300 hover:text-white gap-1"
          >
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
