import React, { useState, useMemo } from "react";
import { Columns, Shield, BookOpen, ExternalLink, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import type { GroundedChunk } from "../types/chat-ui";
import { formatProductDoc } from "../utils/citations";

export interface PolicyComparisonViewProps {
  /**
   * Retrieved grounded chunks from the current session.
   */
  chunks?: GroundedChunk[];
  /**
   * Callback fired when a citation or chunk is selected for inspection in CitationDrawer.
   */
  onSelectCitation?: (chunk: GroundedChunk | string) => void;
  /**
   * Optional callback to trigger a comparative query in chat.
   */
  onSelectQuery?: (query: string, insurer?: string) => void;
  /**
   * Callback to exit comparison mode and return to main chat view.
   */
  onClose?: () => void;
  /**
   * Optional custom styling classes.
   */
  className?: string;
}

interface BenchmarkComparisonRow {
  category: string;
  nrma: string;
  suncorp: string;
  allianz: string;
  qbe: string;
}

const BENCHMARK_COMPARISONS: BenchmarkComparisonRow[] = [
  {
    category: "Flood Definition",
    nrma: "Standard coverage for covering of normally dry land by water escaping from natural watercourses or lakes.",
    suncorp: "Covers the covering of normally dry land by water escaping from a lake, river, creek, or natural watercourse.",
    allianz: "Includes flood under insured events with option to exclude in high-risk zones.",
    qbe: "Standard flood cover included subject to hydrologist assessment of watercourse overflow.",
  },
  {
    category: "Jewellery & Watches Sub-limit",
    nrma: "$2,000 per item / $10,000 per claim unless specified on certificate.",
    suncorp: "$2,500 per item or set / $10,000 total collection limit.",
    allianz: "$2,500 per item / $12,000 maximum total collection limit.",
    qbe: "$2,000 per item / $8,000 total limit for unspecified jewellery.",
  },
  {
    category: "Accidental Damage",
    nrma: "Optional add-on for Classic Home; included standard on Comprehensive Plus.",
    suncorp: "Included standard on Classic Advantage; optional upgrade on Classic.",
    allianz: "Optional extension for accidental breakage and loss.",
    qbe: "Optional cover with fixed excess applies per event.",
  },
  {
    category: "Rainwater Run-off & Storm Surge",
    nrma: "Excluded unless accompanied by continuous torrential rain within 24h.",
    suncorp: "Rainwater run-off excluded unless entering within 24 hours of storm event.",
    allianz: "Storm surge excluded unless directly caused by simultaneous cyclone.",
    qbe: "Run-off from surface water excluded without preceding storm inundation.",
  },
];

const INSURERS = ["SUNCORP", "NRMA", "ALLIANZ", "QBE", "YOUI"] as const;
type InsurerKey = (typeof INSURERS)[number];

/**
 * PolicyComparisonView Component (Spec 05 User Story 15)
 *
 * Side-by-side policy disclosure and sub-limit comparison matrix.
 * Allows brokers and consumers to compare operative terms between Australian general insurers,
 * inspect retrieved GroundedChunks, and launch comparative queries.
 */
export function PolicyComparisonView({
  chunks = [],
  onSelectCitation,
  onSelectQuery,
  onClose,
  className = "",
}: PolicyComparisonViewProps) {
  const [insurerA, setInsurerA] = useState<InsurerKey>("SUNCORP");
  const [insurerB, setInsurerB] = useState<InsurerKey>("NRMA");

  // Partition retrieved chunks by insurer
  const chunksByInsurer = useMemo(() => {
    const map = new Map<string, GroundedChunk[]>();
    for (const c of chunks) {
      const ins = c.source.insurer.toUpperCase();
      const existing = map.get(ins) || [];
      existing.push(c);
      map.set(ins, existing);
    }
    return map;
  }, [chunks]);

  const chunksA = chunksByInsurer.get(insurerA) || [];
  const chunksB = chunksByInsurer.get(insurerB) || [];

  const getBenchmarkText = (row: BenchmarkComparisonRow, insurer: InsurerKey): string => {
    switch (insurer) {
      case "SUNCORP":
        return row.suncorp;
      case "NRMA":
        return row.nrma;
      case "ALLIANZ":
        return row.allianz;
      case "QBE":
        return row.qbe;
      case "YOUI":
        return "Subject to policy schedule terms and individual risk assessment.";
      default:
        return "";
    }
  };

  return (
    <div
      data-testid="policy-comparison-view"
      className={`flex-1 flex flex-col min-h-0 overflow-y-auto p-4 sm:p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 ${className}`}
    >
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
              <Columns className="w-5 h-5" aria-hidden="true" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
              Broker Policy Comparison Matrix
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Compare operative policy limits and definitions side-by-side pursuant to published PDS documents.
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            data-testid="close-comparison-button"
            onClick={onClose}
            className="self-start sm:self-auto px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Back to Chat
          </button>
        )}
      </div>

      {/* Insurer Selector Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
        <div>
          <label htmlFor="insurer-a-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Primary Insurer
          </label>
          <select
            id="insurer-a-select"
            data-testid="insurer-a-select"
            value={insurerA}
            onChange={(e) => setInsurerA(e.target.value as InsurerKey)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {INSURERS.map((ins) => (
              <option key={ins} value={ins} disabled={ins === insurerB}>
                {ins}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="insurer-b-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Comparison Insurer
          </label>
          <select
            id="insurer-b-select"
            data-testid="insurer-b-select"
            value={insurerB}
            onChange={(e) => setInsurerB(e.target.value as InsurerKey)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {INSURERS.map((ins) => (
              <option key={ins} value={ins} disabled={ins === insurerA}>
                {ins}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Retrieved Disclosures Section (If Active Chunks Exist) */}
      {(chunksA.length > 0 || chunksB.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Retrieved Operative PDS Disclosures in Current Session
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Insurer A Chunks */}
            <div className="space-y-2 p-3.5 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20">
              <span className="text-xs font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wide">
                {insurerA} Disclosures ({chunksA.length})
              </span>
              {chunksA.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No disclosures retrieved yet for {insurerA}.
                </p>
              ) : (
                chunksA.map((chunk) => (
                  <div
                    key={chunk.id}
                    className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                      <span>{formatProductDoc(chunk.source.product, chunk.source.docType)}</span>
                      <span className="text-[10px] text-sky-600 dark:text-sky-400 font-mono">
                        {chunk.source.section}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 line-clamp-3">
                      {chunk.content}
                    </p>
                    <button
                      type="button"
                      onClick={() => onSelectCitation?.(chunk)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer pt-1"
                    >
                      <BookOpen className="w-3 h-3" />
                      <span>Inspect Operative Excerpt</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Insurer B Chunks */}
            <div className="space-y-2 p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/20">
              <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wide">
                {insurerB} Disclosures ({chunksB.length})
              </span>
              {chunksB.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No disclosures retrieved yet for {insurerB}.
                </p>
              ) : (
                chunksB.map((chunk) => (
                  <div
                    key={chunk.id}
                    className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                      <span>{formatProductDoc(chunk.source.product, chunk.source.docType)}</span>
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">
                        {chunk.source.section}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 line-clamp-3">
                      {chunk.content}
                    </p>
                    <button
                      type="button"
                      onClick={() => onSelectCitation?.(chunk)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer pt-1"
                    >
                      <BookOpen className="w-3 h-3" />
                      <span>Inspect Operative Excerpt</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Side-by-Side Comparison Matrix Table */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-slate-700 dark:text-slate-300" />
          <span>Core Coverage &amp; Sub-Limit Benchmark Matrix</span>
        </h3>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs sm:text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/80">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider w-1/4">
                  Coverage Category
                </th>
                <th scope="col" className="px-4 py-3 text-left font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider w-3/8">
                  {insurerA} Policy Terms
                </th>
                <th scope="col" className="px-4 py-3 text-left font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider w-3/8">
                  {insurerB} Policy Terms
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {BENCHMARK_COMPARISONS.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100 align-top">
                    {row.category}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300 align-top leading-relaxed">
                    {getBenchmarkText(row, insurerA)}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300 align-top leading-relaxed">
                    {getBenchmarkText(row, insurerB)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Launch Comparative Queries */}
      {onSelectQuery && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Launch Comparative Edge Query
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onSelectQuery(`Compare flood definitions between ${insurerA} and ${insurerB}`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
            >
              <ArrowRight className="w-3 h-3 text-blue-500" />
              <span>Compare Flood Definitions</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectQuery(`What are jewellery sub-limits under ${insurerA} vs ${insurerB}?`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
            >
              <ArrowRight className="w-3 h-3 text-blue-500" />
              <span>Compare Jewellery Sub-limits</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
