import React from "react";
import { BookOpen } from "lucide-react";
import type { GroundedChunk } from "../../types/chat";
import { formatProductDoc } from "../utils/citations";

export interface CitationPillProps {
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
 * Formats policy references (e.g. `[Source: Suncorp Classic Home PDS, Section 1]`)
 * and triggers opening the Citation Drawer for verified grounding inspection.
 */
export function CitationPill({
  chunk,
  chunkId,
  label,
  product,
  docType,
  section,
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
  const displayText =
    label ?? `[Source: ${productDoc}, ${effectiveSection}]`;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onClick?.();
    if (resolvedChunkId) {
      onSelect?.(resolvedChunkId);
    }
  };

  return (
    <button
      type="button"
      data-testid="citation-pill"
      onClick={handleClick}
      aria-label={`View citation source: ${productDoc}, ${effectiveSection}`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 my-0.5 mx-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100 hover:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-colors cursor-pointer select-none align-middle touch-manipulation min-h-[32px] sm:min-h-[28px] ${className}`}
    >
      <BookOpen className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" aria-hidden="true" />
      <span className="truncate max-w-[280px] sm:max-w-[360px]">{displayText}</span>
    </button>
  );
}
