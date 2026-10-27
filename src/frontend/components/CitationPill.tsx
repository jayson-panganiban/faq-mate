import { BookOpen } from "lucide-react";
import React from "react";
import type { GroundedChunk } from "../../types/chat";
import { formatProductDoc } from "../utils/citations";

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
   * Whether to display in ultra-compact Answer Engine badge mode (default: true).
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
 * Inline clickable citation chip rendered inside the streaming assistant response.
 * In compact mode (Answer Engine design), it renders an ultra-compact numbered badge
 * linked to the Operative Sources Shelf, with full accessible text and tap targets.
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

  if (!compact) {
    return (
      <button
        type="button"
        data-testid="citation-pill"
        onClick={handleClick}
        aria-label={`View citation source: ${productDoc}, ${effectiveSection}`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 my-0.5 mx-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100 hover:border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/80 dark:hover:bg-sky-900/60 transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 focus-visible:outline-hidden cursor-pointer select-none align-middle touch-manipulation min-h-[32px] sm:min-h-[28px] ${className}`}
      >
        {typeof index === "number" && index > 0 && (
          <span
            data-testid="citation-index-badge"
            className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-sky-200 dark:bg-sky-800 text-[10px] font-bold text-sky-900 dark:text-sky-100 tabular-nums shrink-0"
          >
            {index}
          </span>
        )}
        <BookOpen
          className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 flex-shrink-0"
          aria-hidden="true"
        />
        <span className="truncate max-w-[280px] sm:max-w-[360px]">{displayText}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      data-testid="citation-pill"
      onClick={handleClick}
      aria-label={`View citation source: ${productDoc}, ${effectiveSection}`}
      className={`inline-flex items-center justify-center relative min-w-[20px] h-[20px] sm:min-w-[22px] sm:h-[22px] px-1.5 py-0 ml-1 mr-0 rounded-full text-xs font-semibold bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-200 border border-sky-300/90 dark:border-sky-700/80 hover:bg-sky-200 dark:hover:bg-sky-900 hover:border-sky-400 dark:hover:border-sky-600 transition-[color,background-color,border-color,transform] duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 focus-visible:outline-hidden cursor-pointer select-none align-baseline touch-manipulation after:absolute after:-inset-1.5 ${className}`}
    >
      {typeof index === "number" && index > 0 ? (
        <span
          data-testid="citation-index-badge"
          className="inline-flex items-center justify-center font-mono text-[10px] sm:text-[11px] font-bold tabular-nums shrink-0"
        >
          {index}
        </span>
      ) : (
        <BookOpen className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" aria-hidden="true" />
      )}
      {/* Screen reader & test DOM accessibility */}
      <span className="sr-only">{displayText}</span>
    </button>
  );
}
