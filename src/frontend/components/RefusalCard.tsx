import React from "react";
import { AlertTriangle, UserCheck } from "lucide-react";
import { STATUTORY_GAW } from "../../constants/statutory";
import { StatutoryGaw } from "./StatutoryGaw";

export interface RefusalCardProps {
  code?: string;
  reason?: string;
  message?: string;
  className?: string;
}

/**
 * ASIC RG 244 Safe Harbor Advice Boundary Refusal Card
 * Rendered when personal financial product advice intent is detected.
 * Invariant: Must refuse personal advice and guide user to AFSL licensed adviser.
 */
export function RefusalCard({
  code = "ADVICE_BOUNDARY_VIOLATION",
  reason,
  message,
  className = "",
}: RefusalCardProps) {
  if (code && code !== "ADVICE_BOUNDARY_VIOLATION") {
    return null;
  }

  return (
    <section
      role="alert"
      aria-label="Personal Advice Boundary Refusal"
      data-testid="refusal-card"
      className={`rounded-xl border-2 border-amber-300 bg-amber-50/95 p-5 shadow-sm text-amber-950 dark:border-amber-600/70 dark:bg-amber-950/40 dark:text-amber-100 ${className}`}
    >
      <div className="flex items-start gap-3.5">
        <div className="rounded-full bg-amber-200/80 p-2 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 shrink-0">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="space-y-3 flex-1">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-200/70 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900/80 dark:text-amber-200 uppercase tracking-wide">
              ASIC RG 244 Safe Harbor
            </span>
            <h3 className="text-base font-bold text-amber-950 dark:text-amber-100 mt-1">
              Personal Financial Advice Boundary
            </h3>
          </div>

          <p className="text-sm leading-relaxed text-amber-950 dark:text-amber-100 font-medium">
            {message ||
              "I cannot provide personal financial product advice or recommend which insurance policy suits your individual financial situation, objectives, or budget."}
          </p>

          <div className="rounded-lg border border-amber-200 bg-white/80 p-3.5 text-xs leading-relaxed text-amber-950 dark:border-amber-800/60 dark:bg-amber-900/30 dark:text-amber-100">
            <p className="font-semibold mb-1 flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
              <UserCheck className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
              Need Personal Advice?
            </p>
            <p>
              Under ASIC RG 244 and the Corporations Act 2001, FAQ-Mate provides general factual policy information only. If you need advice tailored to your personal objectives, financial situation, or budget, please consult a qualified financial adviser or broker holding an Australian Financial Services Licence (AFSL).
            </p>
          </div>

          <StatutoryGaw className="border-amber-200 bg-amber-100/60 text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200" />
        </div>
      </div>
    </section>
  );
}
