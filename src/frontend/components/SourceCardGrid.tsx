import { BookOpen, ChevronRight, Shield } from "lucide-react";
import type { GroundedChunk } from "../../types/chat";
import { formatProductDoc } from "../utils/citations";

export interface SourceCardGridProps {
  /**
   * Retrieved grounded chunks to display in the sources shelf.
   */
  chunks?: GroundedChunk[];
  /**
   * Callback fired when a source card is clicked.
   */
  onSelectCitation?: (chunk: GroundedChunk) => void;
  /**
   * Optional custom styling classes.
   */
  className?: string;
}

/**
 * Formats relevance score (0.0 - 1.0) into a readable integer percentage.
 */
function formatRelevancePercent(score?: number): string {
  if (typeof score !== "number" || Number.isNaN(score)) return "";
  const pct = Math.min(100, Math.max(0, Math.round(score * 100)));
  return `${pct}% match`;
}

/**
 * SourceCardGrid Component
 *
 * Implements the Perplexity-style Answer Engine Sources Shelf.
 * Positioned at the top of an answer dossier, it renders interactive cards for
 * every retrieved PDS/SPDS policy section, displaying insurer brand, document title,
 * section hierarchy, match relevance, and a short snippet preview.
 */
export function SourceCardGrid({ chunks, onSelectCitation, className = "" }: SourceCardGridProps) {
  if (!chunks || chunks.length === 0) {
    return null;
  }

  return (
    <section
      data-testid="sources-shelf"
      aria-label="Operative Policy Sources"
      className={`mb-4 pb-3 border-b border-slate-200/80 dark:border-slate-800 ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-md bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            <BookOpen className="w-3.5 h-3.5" />
          </div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Operative Sources
          </h4>
          <span
            data-testid="sources-count-badge"
            className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 tabular-nums"
          >
            {chunks.length}
          </span>
        </div>

        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hidden sm:inline">
          Grounded in Australian General Insurance PDS
        </span>
      </div>

      {/* Responsive Sources Shelf: Horizontal Snap Carousel on Mobile, Grid on Tablet/Desktop */}
      <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-2.5 overflow-x-auto sm:overflow-visible pb-2 sm:pb-0 scrollbar-none snap-x -mx-1 px-1 sm:mx-0 sm:px-0">
        {chunks.map((chunk, idx) => {
          const productDoc = formatProductDoc(chunk.source.product, chunk.source.docType);
          const matchPercent = formatRelevancePercent(chunk.relevanceScore);
          const indexNumber = idx + 1;

          return (
            <button
              key={chunk.id || `chunk-${idx}`}
              type="button"
              data-testid={`source-card-${idx}`}
              onClick={() => onSelectCitation?.(chunk)}
              aria-label={`View source: ${productDoc}, ${chunk.source.section}`}
              className="group relative p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 hover:border-sky-400 dark:hover:border-sky-500 hover:shadow-xs transition-[border-color,box-shadow,transform] duration-150 active:scale-[0.99] text-left cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 focus-visible:outline-hidden flex flex-col justify-between gap-2 min-h-[96px] w-[230px] sm:w-auto shrink-0 sm:shrink snap-start"
            >
              {/* Card Header: Index Badge + Insurer Brand + Relevance */}
              <div className="flex items-center justify-between gap-1.5 w-full">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    data-testid={`source-card-badge-${idx}`}
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 tabular-nums shrink-0 group-hover:bg-sky-100 group-hover:text-sky-700 dark:group-hover:bg-sky-900/80 dark:group-hover:text-sky-300 transition-colors"
                  >
                    {indexNumber}
                  </span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 truncate max-w-[110px]">
                    <Shield
                      className="w-2.5 h-2.5 text-sky-600 dark:text-sky-400 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="truncate">{chunk.source.insurer}</span>
                  </span>
                </div>

                {matchPercent && (
                  <span className="text-[10px] tabular-nums font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded shrink-0">
                    {matchPercent}
                  </span>
                )}
              </div>

              {/* Card Middle: Product Doc & Section Hierarchy */}
              <div className="space-y-0.5 w-full">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                  {productDoc}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {chunk.source.section}
                </p>
              </div>

              {/* Card Bottom: Snippet Excerpt */}
              {chunk.content && (
                <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed text-left">
                  {chunk.content}
                </p>
              )}

              {/* Card Footer Hover Hint */}
              <div className="flex items-center justify-end text-[10px] font-medium text-sky-600 dark:text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity">
                <span>Inspect in drawer</span>
                <ChevronRight className="w-3 h-3 ml-0.5" aria-hidden="true" />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
