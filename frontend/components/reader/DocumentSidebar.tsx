"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Folder, FileText, Upload, Trash2, Clock, CheckCircle2, 
  PanelLeftClose, PanelLeft, Search, Sparkles, BookOpen, Layers
} from "lucide-react";
import { ReaderDoc } from "@/lib/db";

interface DocumentSidebarProps {
  docs: ReaderDoc[];
  activeDocId: string | null;
  onSelectDoc: (doc: ReaderDoc) => void;
  onUploadClick: () => void;
  onDeleteDoc: (id: string, e: React.MouseEvent) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export default function DocumentSidebar({
  docs,
  activeDocId,
  onSelectDoc,
  onUploadClick,
  onDeleteDoc,
  isOpen,
  onToggleOpen
}: DocumentSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "pdf" | "docx">("all");

  const filteredDocs = docs.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === "all" ? true : doc.doc_type === filter;
    return matchesSearch && matchesFilter;
  });

  if (!isOpen) {
    return (
      <div className="w-14 border-r border-white/10 bg-[#111318] flex flex-col items-center py-4 gap-4 shrink-0 z-30">
        <button
          onClick={onToggleOpen}
          className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-all shadow-sm"
          title="Expand Document Library"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
        <button
          onClick={onUploadClick}
          className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.5)] transition-all"
          title="Upload Document"
        >
          <Upload className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <aside className="w-80 md:w-88 border-r border-white/10 bg-[#111318] flex flex-col shrink-0 z-30 font-sans select-none overflow-hidden transition-all duration-300">
      
      {/* 1. SIDEBAR HEADER */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#151821]/60">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-500 to-cyan-500 flex items-center justify-center shadow-md">
            <BookOpen className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-extrabold text-sm text-white tracking-tight">Focus Vault</span>
        </div>
        <button
          onClick={onToggleOpen}
          className="w-8 h-8 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
          title="Collapse Sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* 2. UPLOAD DROPZONE BUTTON */}
      <div className="p-4 border-b border-white/10">
        <button
          onClick={onUploadClick}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_-5px_rgba(168,85,247,0.6)] transform hover:scale-[1.02] transition-all border border-purple-400/30"
        >
          <Upload className="w-4 h-4" />
          <span>Upload New PDF / DOCX</span>
        </button>
      </div>

      {/* 3. SEARCH & FILTER PILLS */}
      <div className="px-4 py-3 space-y-2.5 border-b border-white/10 bg-[#0e1015]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            className="w-full bg-[#161922] border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {(["all", "pdf", "docx"] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`flex-1 py-1 rounded-lg text-[11px] font-bold uppercase transition-all ${
                filter === type
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm"
                  : "bg-white/5 text-neutral-400 hover:text-neutral-200 border border-transparent"
              }`}
            >
              {type === "all" ? "All Docs" : type}
            </button>
          ))}
        </div>
      </div>

      {/* 4. DOCUMENT LIST */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-white/10">
        {filteredDocs.length === 0 ? (
          <div className="text-center py-12 px-4 space-y-3 text-neutral-500 text-xs">
            <Layers className="w-8 h-8 mx-auto text-neutral-600 opacity-60" />
            <p className="font-semibold text-neutral-400">No documents found</p>
            <p className="text-[11px]">Upload a textbook, research paper, or essay to start reading with bionic anchors & binaural audio!</p>
          </div>
        ) : (
          filteredDocs.map(doc => {
            const isSelected = doc.id === activeDocId;
            const progressPct = Math.min(100, Math.round((doc.current_page / Math.max(1, doc.num_pages)) * 100));
            const estMin = Math.max(1, Math.ceil(doc.total_words / 200));

            return (
              <div
                key={doc.id}
                onClick={() => onSelectDoc(doc)}
                className={`group relative p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#1c202d] border-purple-500/60 shadow-[0_0_25px_rgba(168,85,247,0.15)]"
                    : "bg-[#141720]/80 hover:bg-[#181c26] border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase shrink-0 border ${
                      doc.doc_type === "pdf"
                        ? "bg-red-500/15 text-red-400 border-red-500/30"
                        : "bg-blue-500/15 text-blue-400 border-blue-500/30"
                    }`}>
                      {doc.doc_type}
                    </span>
                    <h4 className="font-bold text-xs text-neutral-200 truncate group-hover:text-white transition-colors">
                      {doc.title}
                    </h4>
                  </div>
                  <button
                    onClick={(e) => onDeleteDoc(doc.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-500/20 text-neutral-500 hover:text-red-400 transition-all shrink-0"
                    title="Delete Document"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="mt-2.5 flex items-center justify-between text-[10px] text-neutral-400 font-medium">
                  <span>Page {doc.current_page} of {doc.num_pages}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5 text-neutral-500" />
                    {estMin} min read
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mt-2 w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-all duration-300 rounded-full"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. SIDEBAR FOOTER STATS */}
      <div className="p-3.5 border-t border-white/10 bg-[#0c0d12] flex items-center justify-between text-[11px] text-neutral-400">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span className="font-semibold text-neutral-300">Hyperfi VIP Tier</span>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold text-[10px] border border-purple-500/30">
          PRO FOREVER
        </span>
      </div>
    </aside>
  );
}
