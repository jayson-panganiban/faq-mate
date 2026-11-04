import { BookOpen } from "lucide-react";
import type React from "react";
import type { GroundedChunk } from "../../types/chat";
import { formatProductDoc } from "../utils/citations";
import { PeekCard } from "./PeekCard";

export interface CitationPillProps {
  /**
   * 1-based index in the sources shelf (if available).
   */
  index?: number;
  /**
   * The retrieved grounded chunk associated with this citation.
   */
  chunk?: GroundedChunk;
  /**
   * Optional chunk ID if chunk object is not provided directly.
   */
  chunkId?: string;
  /**
   * Optional custom label overriding the default formatted text.
   */
  label?: string;
  /**
   * Insurer product name (used when chunk is not provided).
   */
  product?: string;
  /**
   * Document type e.g. PDS, TMD, SPDS.
   */
  docType?: string;
  /**
   * Operative policy section e.g. "Section 1" or "General Exclusions".
   */
  section?: string;
  /**
   * Whether the reference is inline with prose (default: true). Standalone references show the document name.
   */
  compact?: boolean;
  /**
   * Callback fired when pill is clicked (opens citation drawer).
   */
  onClick?: () => void;
  /**
   * Callback fired with the selected chunk ID when pill is clicked.
   */
  onSelect?: (chunkId: string) => void;
  /**
   * Optional additional CSS classes.
   */
  className?: string;
}

/**
 * CitationPill Component
 *
 * Clickable source reference rendered inside the assistant response.
 * Enhanced with EasyUI PeekCard: hovering over the citation pill reveals an origin-anchored
 * preview of the operative clause, underwriter, and relevance match score without
 * needing to slide open the full inspector drawer.
 */
export function CitationPill({
  index,
  chunk,
  chunkId,
  label,
  product,
  docType,
  section,
  compact = true,
  onClick,
  onSelect,
  className = "",
}: CitationPillProps) {
  const resolvedChunkId = chunk?.id ?? chunkId;

  // Derive display metadata
  const effectiveProduct = chunk?.source.product ?? product;
  const effectiveDocType = chunk?.source.docType ?? docType;
  const effectiveSection = chunk?.source.section ?? section ?? "General Terms";

  // Build document reference, avoiding duplicate docType if product already includes it
  const productDoc = formatProductDoc(effectiveProduct, effectiveDocType);

  // Formatted display text
  const displayText = label ?? `[Source: ${productDoc}, ${effectiveSection}]`;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onClick?.();
    if (resolvedChunkId) {
      onSelect?.(resolvedChunkId);
    }
  };

  const sourceTitle = chunk
    ? productDoc
    : (label
        ?.replace(/^\[\s*(?:Source:\s*)?/i, "")
        .replace(/\]$/, "")
        .replace(/[*_`]/g, "") ?? productDoc);
  const sourceDescription = chunk ? `${productDoc}, ${effectiveSection}` : sourceTitle;

  const pillButton = !compact ? (
    <button
      type="button"
      data-testid="citation-pill"
      onClick={handleClick}
      aria-label={`View source: ${sourceDescription}`}
      className={`citation-standalone inline text-left text-sm text-slate-600 underline decoration-slate-400 underline-offset-2 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white focus-visible:outline-2 focus-visible:outline-teal-600 cursor-pointer ${className}`.trim()}
    >
      {sourceTitle}
    </button>
  ) : (
    <button
      type="button"
      data-testid="citation-pill"
      onClick={handleClick}
      aria-label={`View citation source: ${productDoc}, ${effectiveSection}`}
      className={`citation-inline text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:underline focus-visible:outline-2 focus-visible:outline-teal-600 cursor-pointer ${className}`}
    >
      {typeof index === "number" && index > 0 ? (
        <span data-testid="citation-index-badge">[{index}]</span>
      ) : (
        <span>[source]</span>
      )}
      <span className="sr-only">{displayText}</span>
    </button>
  );

  // When no chunk or product metadata exists to preview, render button directly
  if (!chunk && !effectiveProduct) {
    return pillButton;
  }

  const peekContent = (
    <div className="flex flex-col gap-2 p-3 text-left">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {chunk?.source.insurer && (
            <span className="inline-flex items-center rounded-md bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700 ring-1 ring-inset ring-teal-600/20 dark:bg-teal-950/60 dark:text-teal-300 dark:ring-teal-500/30">
              {chunk.source.insurer}
            </span>
          )}
          <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {effectiveDocType}
          </span>
        </div>
        {typeof chunk?.relevanceScore === "number" && (
          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            {Math.round(chunk.relevanceScore * 100)}% match
          </span>
        )}
      </div>

      {/* Title & Section */}
      <div>
        <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
          {effectiveProduct}
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
          {effectiveSection}
        </p>
      </div>

      {/* Snippet Excerpt */}
      {chunk?.content && (
        <div className="rounded-lg bg-slate-50 p-2 text-xs leading-relaxed text-slate-600 line-clamp-3 dark:bg-slate-800/60 dark:text-slate-300 font-normal">
          {chunk.content}
        </div>
      )}

      {/* Footer Call to Action */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
        {chunk?.source.effectiveDate ? (
          <span className="text-slate-400 dark:text-slate-500 text-[10px]">
            Eff. {chunk.source.effectiveDate}
          </span>
        ) : (
          <span className="text-slate-400 dark:text-slate-500 text-[10px]">Operative clause</span>
        )}
        <span className="inline-flex items-center gap-1 font-medium text-teal-600 dark:text-teal-400 hover:underline">
          <BookOpen className="h-3 w-3" />
          <span>View in drawer</span>
        </span>
      </div>
    </div>
  );

  return (
    <PeekCard
      content={peekContent}
      onOpenFull={() => {
        onClick?.();
        if (resolvedChunkId) {
          onSelect?.(resolvedChunkId);
        }
      }}
    >
      {pillButton}
    </PeekCard>
  );
}
