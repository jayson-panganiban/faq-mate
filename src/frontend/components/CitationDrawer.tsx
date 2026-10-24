import {
  BookOpen,
  Calendar,
  Check,
  ChevronRight,
  Copy,
  FileText,
  Layers,
  ShieldCheck,
  X,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import type { GroundedChunk } from "../../types/chat";
import { formatProductDoc } from "../utils/citations";

export interface CitationDrawerProps {
  /**
   * Whether the slide-over citation drawer is open.
   */
  isOpen: boolean;
  /**
   * Callback fired when closing the drawer (via X, overlay, or Escape key).
   */
  onClose: () => void;
  /**
   * List of retrieved grounded chunks for the active message.
   */
  chunks: GroundedChunk[];
  /**
   * ID of the currently selected or active chunk to inspect.
   */
  selectedChunkId?: string;
  /**
   * Callback fired when the user selects a chunk tab or list item.
   */
  onSelectChunk?: (id: string) => void;
}

/**
 * CitationDrawer Component
 *
 * Slide-over Grounding Inspector sheet displaying the exact operative policy wording
 * retrieved from R2 via Cloudflare AI Search hybrid retrieval.
 * Features:
 * - Operative section breadcrumb (Insurer > Product PDS > Section > Clause)
 * - Relevance confidence score pill (e.g. 96% Match)
 * - Chunk ID badge and Document Type badge (PDS, TMD)
 * - Effective date when present
 * - Operative text/markdown excerpt viewer with copy action
 * - Multi-chunk tab switcher
 * - Accessible dialog modal semantics (role="dialog", aria-modal="true", Escape key listener)
 * - Responsive layout down to 360px viewport
 */
export function CitationDrawer({
  isOpen,
  onClose,
  chunks,
  selectedChunkId,
  onSelectChunk,
}: CitationDrawerProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | undefined>(
    selectedChunkId ?? chunks[0]?.id
  );
  const [copied, setCopied] = useState(false);

  // Sync internal selected ID with props or fallback to first chunk
  useEffect(() => {
    if (selectedChunkId) {
      setInternalSelectedId(selectedChunkId);
    } else if (
      chunks.length > 0 &&
      (!internalSelectedId || !chunks.some((c) => c.id === internalSelectedId))
    ) {
      setInternalSelectedId(chunks[0].id);
    }
  }, [selectedChunkId, chunks, internalSelectedId]);

  // Listen for Escape key press to dismiss drawer
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const activeId = selectedChunkId ?? internalSelectedId ?? chunks[0]?.id;
  const currentChunk = chunks.find((c) => c.id === activeId) ?? chunks[0];

  const handleSelectTab = (chunkId: string) => {
    setInternalSelectedId(chunkId);
    onSelectChunk?.(chunkId);
  };

  const handleCopyExcerpt = async () => {
    if (!currentChunk?.content) return;
    try {
      await navigator.clipboard.writeText(currentChunk.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
    }
  };

  // Derive breadcrumb product document title
  const productDoc = currentChunk
    ? formatProductDoc(currentChunk.source.product, currentChunk.source.docType)
    : "";

  // Calculate percentage match
  const matchPercentage = currentChunk
    ? Math.round(
        currentChunk.relevanceScore <= 1
          ? currentChunk.relevanceScore * 100
          : currentChunk.relevanceScore
      )
    : 0;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="presentation">
      {/* Backdrop overlay */}
      <div
        data-testid="citation-drawer-backdrop"
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-300"
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-0 sm:pl-10">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="citation-drawer-title"
          className="w-screen max-w-full sm:max-w-md md:max-w-lg lg:max-w-xl bg-white shadow-2xl flex flex-col h-full transform transition-transform duration-300 ease-in-out border-l border-slate-200"
        >
          {/* Drawer Top Navigation Bar */}
          <div className="p-4 sm:px-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-sky-100 text-sky-700">
                <BookOpen className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h2
                  id="citation-drawer-title"
                  className="text-base sm:text-lg font-bold text-slate-900 tracking-tight"
                >
                  Grounding Inspector
                </h2>
                <p className="text-xs text-slate-500">Operative Insurance Policy Verification</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close citations"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          {/* Multi-chunk tab switcher if multiple chunks exist */}
          {chunks.length > 1 && (
            <div
              role="tablist"
              aria-label="Retrieved citations"
              className="flex border-b border-slate-200 overflow-x-auto px-4 py-1 gap-2 bg-slate-100/70 scrollbar-thin"
            >
              {chunks.map((chunk, idx) => {
                const isSelected = chunk.id === currentChunk?.id;
                const tabTitle = `${chunk.source.product || chunk.source.insurer}`;
                const tabSubtitle = chunk.source.section;

                return (
                  <button
                    key={chunk.id}
                    role="tab"
                    id={`tab-${chunk.id}`}
                    aria-selected={isSelected}
                    aria-controls={`panel-${chunk.id}`}
                    type="button"
                    onClick={() => handleSelectTab(chunk.id)}
                    className={`px-3 py-2 text-xs font-medium whitespace-nowrap min-h-[44px] flex items-center gap-2 rounded-md transition-all cursor-pointer ${
                      isSelected
                        ? "bg-white text-sky-800 shadow-xs border border-slate-200/80 font-semibold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                    }`}
                  >
                    <Layers
                      className="w-3.5 h-3.5 text-slate-400 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <span className="truncate max-w-[140px] sm:max-w-[180px]">{tabTitle}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                        isSelected ? "bg-sky-100 text-sky-700" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      #{idx + 1}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {!currentChunk ? (
              <div className="text-center py-12 text-slate-500">
                <FileText className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-medium">No citations available for this response.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Answers without grounding citations rely on general product guidelines.
                </p>
              </div>
            ) : (
              <div
                id={`panel-${currentChunk.id}`}
                role="tabpanel"
                aria-labelledby={`tab-${currentChunk.id}`}
                className="space-y-5"
              >
                {/* Operative Section Breadcrumb */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Operative Breadcrumb
                  </span>
                  <nav
                    aria-label="Operative section breadcrumb"
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center gap-1.5 text-xs sm:text-sm text-slate-700 font-medium flex-wrap"
                  >
                    <span className="text-slate-500 uppercase tracking-wide text-[11px] font-semibold">
                      {currentChunk.source.insurer}
                    </span>
                    <ChevronRight
                      className="w-3.5 h-3.5 text-slate-400 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <span className="text-slate-900 font-bold">{productDoc}</span>
                    <ChevronRight
                      className="w-3.5 h-3.5 text-slate-400 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <span className="text-sky-700 font-semibold">
                      {currentChunk.source.section}
                    </span>
                    {currentChunk.source.clauseId && (
                      <>
                        <ChevronRight
                          className="w-3.5 h-3.5 text-slate-400 flex-shrink-0"
                          aria-hidden="true"
                        />
                        <span className="text-slate-600 text-xs font-mono">
                          Clause {currentChunk.source.clauseId}
                        </span>
                      </>
                    )}
                  </nav>
                </div>

                {/* Evidence & Confidence Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Relevance Confidence Score */}
                  <div
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                      matchPercentage >= 85
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : matchPercentage >= 70
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : "bg-slate-50 text-slate-700 border-slate-200"
                    }`}
                  >
                    <ShieldCheck
                      className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <span>{matchPercentage}% Match</span>
                    <span className="text-[10px] opacity-75 font-mono">
                      (Score: {currentChunk.relevanceScore.toFixed(2)})
                    </span>
                  </div>

                  {/* Document Type Badge */}
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {currentChunk.source.docType}
                  </span>

                  {/* Chunk ID Badge */}
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-slate-100 text-slate-700 border border-slate-200">
                    {currentChunk.id}
                  </span>

                  {/* Effective Date if Present */}
                  {currentChunk.source.effectiveDate && (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-slate-600 bg-slate-100 border border-slate-200">
                      <Calendar
                        className="w-3 h-3 text-slate-500 flex-shrink-0"
                        aria-hidden="true"
                      />
                      <span>Effective: {currentChunk.source.effectiveDate}</span>
                    </div>
                  )}
                </div>

                {/* Operative Markdown/Text Excerpt Viewer */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Operative Policy Excerpt
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyExcerpt}
                      aria-label="Copy excerpt"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer min-h-[36px]"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                          <span className="text-emerald-700 font-semibold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <pre className="p-4 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words select-text overflow-y-auto max-h-[46vh] border border-slate-800 shadow-inner">
                    {currentChunk.content}
                  </pre>
                </div>

                {/* Statutory Grounding Guarantee Card */}
                <div className="p-3.5 rounded-lg bg-sky-50/70 border border-sky-100 text-xs text-sky-900 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5 text-sky-800">
                    <ShieldCheck className="w-4 h-4 text-sky-600 flex-shrink-0" />
                    <span>Verbatim Grounding Verification</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-sky-800/90">
                    This excerpt was retrieved directly from the insurer&apos;s operative disclosure
                    documents stored in R2 via Cloudflare AI Search hybrid retrieval. The generated
                    answer reflects these terms pursuant to ASIC RG 244 factual advice standards.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              {chunks.length} {chunks.length === 1 ? "retrieved chunk" : "retrieved chunks"}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md shadow-xs transition-colors cursor-pointer min-h-[44px]"
            >
              Done
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
