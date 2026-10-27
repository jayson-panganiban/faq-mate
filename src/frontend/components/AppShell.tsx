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
  const popSuffix = popLocation.startsWith("Anycast ") ? popLocation.slice(8) : popLocation;

  return (
    <div
      className={`min-h-[100dvh] h-[100dvh] flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 overflow-hidden ${className}`}
    >
      {/* Edge Telemetry & Compact Brand Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 shadow-2xs pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2.5">
          {/* Brand Identity & PoP */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <div className="h-7 w-7 rounded-lg bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-900 shadow-2xs shrink-0">
              <Shield className="w-3.5 h-3.5" aria-hidden="true" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 dark:text-white leading-tight whitespace-nowrap">
                FAQ-Mate Edge RAG
              </h1>
              <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80 shrink-0">
                Australian Insurance Engine
              </span>
            </div>

            {/* Cloudflare Anycast PoP Badge */}
            <div
              data-testid="cf-pop-badge"
              className="inline-flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-mono font-medium bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 shadow-2xs shrink-0"
              title="Cloudflare Anycast edge point-of-presence data center"
            >
              <Radio
                className="w-3 h-3 text-amber-500 dark:text-amber-400 motion-safe:animate-pulse shrink-0"
                aria-hidden="true"
              />
              <span className="hidden sm:inline">Anycast </span>
              <span>{popSuffix}</span>
            </div>
          </div>

          {/* Telemetry Metrics & Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Hybrid Retrieval Latency Badge */}
            {retrievalMs !== undefined && (
              <span
                data-testid="retrieval-latency-badge"
                className="hidden sm:inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full text-xs font-mono font-medium tabular-nums bg-sky-50 text-sky-800 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800 shadow-2xs"
                title="Cloudflare AI Search hybrid vector+BM25 retrieval latency"
              >
                <Activity className="w-3 h-3 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                <span>
                  {retrievalMs}ms
                  <span className="sr-only sm:not-sr-only"> retrieval</span>
                </span>
              </span>
            )}

            {/* Inference TTFT Badge */}
            {ttftMs !== undefined && (
              <span
                data-testid="ttft-badge"
                className="hidden sm:inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full text-xs font-mono font-medium tabular-nums bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 shadow-2xs"
                title="Time to First Token (sub-350ms budget)"
              >
                <Zap className="w-3 h-3 text-indigo-500" aria-hidden="true" />
                <span>
                  {ttftMs}ms
                  <span className="sr-only sm:not-sr-only"> TTFT</span>
                </span>
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
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border cursor-pointer shadow-2xs transition-[color,background-color,border-color,box-shadow] duration-150 min-h-[36px] focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:outline-hidden ${
                  isComparisonMode
                    ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900"
                    : "text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700"
                }`}
              >
                <Columns className="w-3 h-3" aria-hidden="true" />
                <span className="hidden sm:inline">
                  {isComparisonMode ? "Chat View" : "Compare"}
                </span>
              </button>
            )}

            {/* Reset / New Chat Button */}
            <button
              type="button"
              data-testid="reset-chat-button"
              onClick={onReset}
              aria-label="Start new chat"
              title="New conversation"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs transition-[color,background-color,border-color,box-shadow] duration-150 min-h-[36px] focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:outline-hidden"
            >
              <RotateCcw
                className="w-3 h-3 text-slate-500 dark:text-slate-400"
                aria-hidden="true"
              />
              <span className="hidden sm:inline">New Chat</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Surface */}
      <main className="flex-1 flex flex-col w-full max-w-5xl mx-auto px-3 sm:px-4 py-2 sm:py-4 overflow-hidden relative">
        {children}
      </main>

      {/* Statutory Regulatory & Privacy Footer */}
      <footer
        role="contentinfo"
        className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 py-1.5 sm:py-2 px-3 sm:px-4 shadow-2xs pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          {!hideFooterGaw && (
            <div className="flex-1 min-w-0">
              <StatutoryGaw variant="footer" compact />
            </div>
          )}
          <div className="shrink-0 flex items-center ml-auto">
            <PiiAssuranceBadge />
          </div>
        </div>
      </footer>
    </div>
  );
}
