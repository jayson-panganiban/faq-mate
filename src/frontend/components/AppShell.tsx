import { Activity, Columns, Radio, RotateCcw, Shield, Zap } from "lucide-react";
import React from "react";
import type { RateLimitInfo, TelemetryInfo } from "../types/chat-ui";
import { PiiAssuranceBadge } from "./PiiAssuranceBadge";
import { RateLimitBadge } from "./RateLimitBadge";
import { StatutoryGaw } from "./StatutoryGaw";

export interface AppShellProps {
  telemetry?: TelemetryInfo;
  rateLimit?: RateLimitInfo;
  isThrottled?: boolean;
  isComparisonMode?: boolean;
  hideFooterGaw?: boolean;
  onToggleComparison?: () => void;
  onReset?: () => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * Global Application Shell for FAQ-Mate Edge RAG (Spec 05 Section 3).
 * Contains persistent edge telemetry header, Section 949A GAW footer, and client PII shield.
 */
export function AppShell({
  telemetry,
  rateLimit,
  isThrottled = false,
  isComparisonMode = false,
  hideFooterGaw = false,
  onToggleComparison,
  onReset,
  children,
  className = "",
}: AppShellProps) {
  const retrievalMs = telemetry?.hybrid_retrieval_latency_ms ?? telemetry?.latencyMs;
  const ttftMs = telemetry?.inference_ttft_ms ?? telemetry?.ttftMs;
  const popLocation = telemetry?.popLocation || "Anycast (LOCAL)";

  return (
    <div
      className={`min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 ${className}`}
    >
      {/* Edge Telemetry & Brand Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Brand Identity & PoP */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-linear-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
                <Shield className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                  FAQ-Mate Edge RAG
                </h1>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
                  Australian General Insurance RAG · Workers AI (Llama 3.3 70B)
                </p>
              </div>
            </div>

            {/* Cloudflare Anycast PoP Badge */}
            <div
              data-testid="cf-pop-badge"
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 shadow-2xs"
              title="Cloudflare Anycast edge point-of-presence data center"
            >
              <Radio className="w-3 h-3 text-[#F38020] animate-pulse" aria-hidden="true" />
              <span>{popLocation}</span>
            </div>
          </div>

          {/* Telemetry Metrics & Actions */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Hybrid Retrieval Latency Badge */}
            {retrievalMs !== undefined && (
              <span
                data-testid="retrieval-latency-badge"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 shadow-2xs"
                title="Cloudflare AI Search hybrid vector+BM25 retrieval latency"
              >
                <Activity className="w-3 h-3 text-blue-500" aria-hidden="true" />
                <span>{retrievalMs}ms retrieval</span>
              </span>
            )}

            {/* Inference TTFT Badge */}
            {ttftMs !== undefined && (
              <span
                data-testid="ttft-badge"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 shadow-2xs"
                title="Time to First Token (sub-350ms budget)"
              >
                <Zap className="w-3 h-3 text-indigo-500" aria-hidden="true" />
                <span>{ttftMs}ms TTFT</span>
              </span>
            )}

            {/* Live Rate Limit Badge */}
            <RateLimitBadge rateLimit={rateLimit} isThrottled={isThrottled} />

            {/* Policy Comparison View Toggle (Spec 05 US-15) */}
            {onToggleComparison && (
              <button
                type="button"
                data-testid="comparison-toggle"
                onClick={onToggleComparison}
                aria-pressed={isComparisonMode}
                aria-label={
                  isComparisonMode ? "Switch to chat view" : "Switch to policy comparison view"
                }
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors border cursor-pointer shadow-2xs ${
                  isComparisonMode
                    ? "bg-blue-600 text-white border-blue-700 dark:bg-blue-500"
                    : "text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700"
                }`}
              >
                <Columns className="w-3 h-3" aria-hidden="true" />
                <span>{isComparisonMode ? "Chat View" : "Compare"}</span>
              </button>
            )}

            {/* Reset / New Chat Button */}
            <button
              type="button"
              data-testid="reset-chat-button"
              onClick={onReset}
              aria-label="Start new chat"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs"
            >
              <RotateCcw
                className="w-3 h-3 text-slate-500 dark:text-slate-400"
                aria-hidden="true"
              />
              <span>New Chat</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Surface */}
      <main className="flex-1 flex flex-col w-full max-w-5xl mx-auto px-4 py-4 overflow-hidden relative">
        {children}
      </main>

      {/* Statutory Regulatory & Privacy Footer */}
      <footer
        role="contentinfo"
        className="border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 py-3 px-4 shadow-2xs"
      >
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          {!hideFooterGaw && (
            <div className="w-full md:flex-1">
              <StatutoryGaw variant="footer" compact />
            </div>
          )}
          <div className="shrink-0 flex items-center justify-center md:justify-end ml-auto">
            <PiiAssuranceBadge />
          </div>
        </div>
      </footer>
    </div>
  );
}
