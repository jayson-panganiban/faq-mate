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
 * Inline references use small markers; standalone references keep their document names.
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

  // A standalone reference needs its document name; a superscript alone has no context.
  if (!compact) {
    const sourceTitle = chunk
      ? productDoc
      : (label
          ?.replace(/^\[\s*(?:Source:\s*)?/i, "")
          .replace(/\]$/, "")
          .replace(/[*_`]/g, "") ?? productDoc);
    const sourceDescription = chunk ? `${productDoc}, ${effectiveSection}` : sourceTitle;
    return (
      <button
        type="button"
        data-testid="citation-pill"
        onClick={handleClick}
        aria-label={`View source: ${sourceDescription}`}
        className={`inline-flex min-h-[44px] max-w-full items-center whitespace-normal break-words text-left text-sm text-slate-600 underline decoration-slate-400 underline-offset-2 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white focus-visible:outline-2 focus-visible:outline-teal-600 cursor-pointer ${className}`}
      >
        {sourceTitle}
      </button>
    );
  }

  return (
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
}
