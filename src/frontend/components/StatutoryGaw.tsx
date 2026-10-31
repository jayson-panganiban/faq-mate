import { ChevronDown, Shield } from "lucide-react";
import { useState } from "react";
import { STATUTORY_GAW } from "../../constants/statutory";

export interface StatutoryGawProps {
  className?: string;
  compact?: boolean;
  variant?: "footer" | "message" | "default";
}

/**
 * Statutory General Advice Warning under Section 949A of the Corporations Act 2001 (Cth).
 * Canonical copy derived from GLOSSARY.md § 2 and src/constants/statutory.ts.
 * Non-negotiable invariant: Copy must NEVER be altered or paraphrased.
 *
 * Supports an expandable micro-copy drawer when docked in the footer (Perplexity-style)
 * to prevent UI occlusion while maintaining 100% regulatory compliance.
 */
export function StatutoryGaw({
  className = "",
  compact = false,
  variant = "default",
}: StatutoryGawProps) {
  const isFooter = variant === "footer";
  const isCompact = compact || isFooter;
  const [isExpanded, setIsExpanded] = useState(false);

  // Discreet single-line micro-copy footer with expandable legal drawer
  if (isFooter) {
    return (
      <aside
        role="note"
        aria-label="General Advice Warning"
        data-testid="statutory-gaw"
        className={`text-xs text-slate-500 dark:text-slate-400 transition-all ${className}`}
      >
        <div className="flex items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-1.5 min-w-0">
            <Shield
              className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500"
              aria-hidden="true"
            />
            <span className="font-semibold text-slate-600 dark:text-slate-300 text-[11px] sm:text-xs">
              <span>General advice warning</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            aria-label={
              isExpanded
                ? "Hide General Advice Warning details"
                : "View General Advice Warning legal terms"
            }
            className="inline-flex items-center gap-1 min-h-[44px] px-2 py-1 rounded text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
          >
            <span>{isExpanded ? "Hide details" : "View details"}</span>
            <ChevronDown
              className={`w-3 h-3 transition-transform duration-150 ${isExpanded ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
        </div>

        {/* Verbatim statutory copy: rendered in drawer when expanded, accessible via sr-only when collapsed */}
        <div
          className={`overflow-hidden transition-all duration-200 ${
            isExpanded ? "mt-2 block" : "sr-only"
          }`}
        >
          <div className="p-2.5 rounded-lg border border-slate-200/80 bg-slate-50/90 dark:border-slate-800 dark:bg-slate-900/80 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {STATUTORY_GAW}
          </div>
        </div>
      </aside>
    );
  }

  // Standard standalone card for messages and refusal views
  return (
    <aside
      role="note"
      aria-label="General Advice Warning"
      data-testid="statutory-gaw"
      className={`rounded-lg border border-slate-200 bg-slate-50/90 text-slate-600 shadow-xs dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400 ${
        isCompact ? "p-2.5 text-[11px] leading-snug" : "p-3 text-xs leading-relaxed"
      } ${className}`}
    >
      <div className="flex items-start gap-2">
        <Shield
          className={`shrink-0 text-slate-500 dark:text-slate-400 ${
            isCompact ? "mt-0.5 h-3.5 w-3.5" : "mt-0.5 h-4 w-4"
          }`}
          aria-hidden="true"
        />
        <div className="space-y-0.5">
          <p className="font-semibold text-slate-700 dark:text-slate-300">
            Corporations Act 2001 (Cth) s.949A
          </p>
          <p className="text-slate-600 dark:text-slate-400">{STATUTORY_GAW}</p>
        </div>
      </div>
    </aside>
  );
}
