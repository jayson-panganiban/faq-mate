import { Shield } from "lucide-react";
import React from "react";
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
 */
export function StatutoryGaw({
  className = "",
  compact = false,
  variant = "default",
}: StatutoryGawProps) {
  const isFooter = variant === "footer";
  const isCompact = compact || isFooter;

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
