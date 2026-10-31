import type { GroundedChunk } from "../../types/chat";
import { formatProductDoc } from "../utils/citations";

export interface SourceCardGridProps {
  /**
   * Retrieved grounded chunks to display in the sources shelf.
   */
  chunks?: GroundedChunk[];
  /**
   * Callback fired when a source document is selected.
   */
  onSelectCitation?: (chunk: GroundedChunk) => void;
  /**
   * Optional custom styling classes.
   */
  className?: string;
}

/** Plain-text previews only; opening a source always uses the untouched chunk. */
function plainSnippet(markdown: string): string {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/```[^\n]*\n([\s\S]*?)```/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^\s]*(?:\s+[^)]*)?\)/g, "$1")
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s*|[-+*]\s+|\d+[.)]\s+)/gm, "")
    .replace(/\s+#+\s*$/gm, "")
    .replace(/^\s*\|?[\s:|-]*-{3}[\s:|-]*\|?\s*$/gm, " ")
    .replace(/<https?:\/\/[^>]+>/g, "")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/https?:\/\/[^\s]+/g, "")
    .replace(/[*_`~]+/g, "")
    .replace(/\|/g, " · ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Compact source list above the answer. Titles open the citation drawer;
 * snippets are plain-text previews without cards or relevance badges.
 */
export function SourceCardGrid({ chunks, onSelectCitation, className = "" }: SourceCardGridProps) {
  if (!chunks?.length) return null;

  return (
    <section
      data-testid="sources-shelf"
      aria-label="Sources"
      className={`mb-4 min-w-0 ${className}`}
    >
      <h4 className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">Sources</h4>
      <ul className="space-y-1">
        {chunks.map((chunk, index) => {
          const title = plainSnippet(formatProductDoc(chunk.source.product, chunk.source.docType));
          const snippet = plainSnippet(chunk.content);
          return (
            <li key={chunk.id || index} className="min-w-0">
              <button
                type="button"
                data-testid={`source-card-${index}`}
                onClick={() => onSelectCitation?.(chunk)}
                aria-label={`View source: ${title}, ${chunk.source.section}`}
                title={`${title}, ${chunk.source.section}`}
                className="group block min-h-[44px] w-full min-w-0 py-1 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-600"
              >
                <span className="block truncate text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 group-hover:text-slate-950 dark:text-slate-200 dark:decoration-slate-600 dark:group-hover:text-white">
                  {title}
                </span>
                {snippet && (
                  <span className="mt-0.5 line-clamp-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {snippet}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
