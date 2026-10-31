import { useState } from "react";
import { STATUTORY_GAW } from "../../constants/statutory";

export interface ComplianceFooterProps {
  /**
   * Developer debug mode: when enabled, diagnostic RAG telemetry (similarity
   * scores, chunk IDs, edge latency) becomes visible across the UI.
   */
  debugEnabled?: boolean;
  /**
   * Callback that flips the debug mode switch; omit to hide the control.
   */
  onToggleDebug?: () => void;
}

/** Persistent legal and privacy disclosures, expanded in normal flow. */
export function ComplianceFooter({ debugEnabled = false, onToggleDebug }: ComplianceFooterProps) {
  const [open, setOpen] = useState<"gaw" | "privacy" | null>(null);
  return (
    <footer
      role="contentinfo"
      className="shrink-0 max-h-[35dvh] overflow-y-auto px-3 pb-[env(safe-area-inset-bottom,0px)] text-[11px] text-slate-500 dark:text-slate-400"
    >
      <div className="mx-auto max-w-[800px]">
        <div className="flex items-center justify-center">
          <div>
            <button
              type="button"
              aria-expanded={open === "gaw"}
              aria-label={
                open === "gaw"
                  ? "Hide General Advice Warning details"
                  : "View General Advice Warning legal terms"
              }
              onClick={() => setOpen(open === "gaw" ? null : "gaw")}
              className="min-h-[44px] px-2 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-teal-600 dark:hover:text-slate-200"
            >
              General advice warning
            </button>
          </div>
          <span aria-hidden="true">·</span>
          <div data-testid="pii-assurance-badge">
            <button
              type="button"
              data-testid="pii-assurance-trigger"
              aria-label="Your privacy"
              aria-expanded={open === "privacy"}
              onClick={() => setOpen(open === "privacy" ? null : "privacy")}
              className="min-h-[44px] px-2 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-teal-600 dark:hover:text-slate-200"
            >
              Privacy
            </button>
          </div>
          {onToggleDebug && (
            <>
              <span aria-hidden="true">·</span>
              <div>
                <button
                  type="button"
                  role="switch"
                  data-testid="debug-mode-switch"
                  aria-checked={debugEnabled}
                  aria-label="Developer debug mode"
                  title="Developer debug mode: diagnostic retrieval telemetry"
                  onClick={onToggleDebug}
                  className={`min-h-[44px] rounded-md px-2 font-mono text-[11px] tracking-wide focus-visible:outline-2 focus-visible:outline-teal-600 ${
                    debugEnabled
                      ? "text-amber-700 dark:text-amber-300"
                      : "hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {debugEnabled ? "Debug on" : "Debug"}
                </button>
              </div>
            </>
          )}
        </div>
        <aside role="note" aria-label="General Advice Warning" data-testid="statutory-gaw">
          <p className={open === "gaw" ? "px-2 pb-3 leading-relaxed" : "sr-only"}>
            {STATUTORY_GAW}
          </p>
        </aside>
        {open === "privacy" && (
          <section
            data-testid="pii-assurance-popover"
            aria-label="Privacy details"
            className="space-y-2 px-2 pb-3 leading-relaxed"
          >
            <p>
              Tax File Numbers, Medicare numbers and payment card numbers are removed in your
              browser before your question is sent.
            </p>
            <p>
              Raw questions are not stored in our analytics database. Your conversation is kept in
              this browser session.
            </p>
          </section>
        )}
      </div>
    </footer>
  );
}
