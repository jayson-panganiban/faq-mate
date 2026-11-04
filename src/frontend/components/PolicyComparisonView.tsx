import { ArrowLeft, BookOpen, Info } from "lucide-react";
import { useMemo, useState } from "react";
import {
  getCanonicalPdsSources,
  getGroupedInsurerOptions,
  getSharedUnderwriterInfo,
  POLICY_COMPARISON_DIMENSIONS,
  type PrimaryInsurerCode,
  resolveInsurer,
  resolvePolicyComparisonCell,
  toInsurerSlug,
} from "../../constants/insurers";
import type { GroundedChunk } from "../types/chat-ui";
import { formatProductDoc } from "../utils/citations";
import { GlobalFilterDropdown } from "./GlobalFilterDropdown";
import { MarkdownText } from "./MarkdownText";
import { RelatedQuestions } from "./RelatedQuestions";

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

const GROUPED_INSURER_OPTIONS = getGroupedInsurerOptions();

/**
 * PolicyComparisonView Component (Spec 05 User Story 15 & Spec 06)
 *
 * Stacked policy terms and source excerpts across all 39 insurers.
 * Allows consumers to compare policy terms between Australian insurers,
 * inspect retrieved GroundedChunks, and launch comparative queries.
 */
export function PolicyComparisonView({
  chunks = [],
  onSelectCitation,
  onSelectQuery,
  onClose,
  className = "",
}: PolicyComparisonViewProps) {
  const [insurerA, setInsurerA] = useState<PrimaryInsurerCode>("SUNCORP");
  const [insurerB, setInsurerB] = useState<PrimaryInsurerCode>("NRMA");

  const sharedUnderwriter = useMemo(
    () => getSharedUnderwriterInfo(insurerA, insurerB),
    [insurerA, insurerB]
  );

  const sourcesA = useMemo(() => getCanonicalPdsSources(insurerA), [insurerA]);
  const sourcesB = useMemo(() => getCanonicalPdsSources(insurerB), [insurerB]);

  // Partition retrieved chunks by canonical insurer code & uppercase name
  const chunksByInsurer = useMemo(() => {
    const map = new Map<string, GroundedChunk[]>();
    for (const c of chunks) {
      const resolved = resolveInsurer(c.source.insurer);
      const keys = new Set([
        c.source.insurer.toUpperCase(),
        ...(resolved ? [resolved.profile.code, resolved.profile.name.toUpperCase()] : []),
      ]);
      for (const k of keys) {
        const existing = map.get(k) || [];
        existing.push(c);
        map.set(k, existing);
      }
    }
    return map;
  }, [chunks]);

  const chunksA = chunksByInsurer.get(insurerA) || [];
  const chunksB = chunksByInsurer.get(insurerB) || [];

  const labelFor = (code: string) =>
    GROUPED_INSURER_OPTIONS.flatMap((group) => group.options).find(
      (option) => option.value === code
    )?.label ?? code;
  const nameA = labelFor(insurerA);
  const nameB = labelFor(insurerB);
  const filterGroups = useMemo(
    () =>
      GROUPED_INSURER_OPTIONS.map((group) => ({
        id: group.category,
        label: group.label,
        options: group.options.map((option) => ({
          value: option.value,
          label: option.label,
          title: option.underwriter,
        })),
      })),
    []
  );
  const linkClass =
    "inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400 focus-visible:outline-2 focus-visible:outline-teal-600 cursor-pointer";

  return (
    <div
      data-testid="policy-comparison-view"
      className={`min-h-0 flex-1 overflow-y-auto px-1 pt-2 pb-12 sm:px-2 sm:pt-3 sm:pb-16 ${className}`}
    >
      {onClose && (
        <div className="mb-2">
          <button
            type="button"
            data-testid="close-comparison-button"
            onClick={onClose}
            className={`${linkClass} -ml-1 px-1 py-1 text-xs sm:text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors`}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </button>
        </div>
      )}
      <div className="mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Compare Policies
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Side-by-side policy terms, insured perils, and exclusions across Australian insurers.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white/60 p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-900/40 backdrop-blur-xs shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
          {/* Primary Insurer Picker */}
          <div className="flex-1 min-w-0">
            <label
              htmlFor="insurer-a-trigger"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
            >
              Primary insurer
            </label>
            <GlobalFilterDropdown
              triggerId="insurer-a-trigger"
              testIdPrefix="insurer-a"
              variant="field"
              ariaLabel="Primary insurer"
              value={insurerA}
              onSelect={(next) => setInsurerA(next as PrimaryInsurerCode)}
              groups={filterGroups}
              disabledOptionValues={[insurerB]}
            />
          </div>

          {/* Comparison Insurer Picker */}
          <div className="flex-1 min-w-0">
            <label
              htmlFor="insurer-b-trigger"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
            >
              Comparison insurer
            </label>
            <GlobalFilterDropdown
              triggerId="insurer-b-trigger"
              testIdPrefix="insurer-b"
              variant="field"
              ariaLabel="Comparison insurer"
              value={insurerB}
              onSelect={(next) => setInsurerB(next as PrimaryInsurerCode)}
              groups={filterGroups}
              disabledOptionValues={[insurerA]}
            />
          </div>
        </div>

        {/* Underwriter Group Transparency Badge */}
        {sharedUnderwriter && (
          <div
            data-testid="underwriter-transparency-badge"
            role="status"
            className="mt-3.5 flex items-start gap-2.5 rounded-lg border border-sky-200/80 bg-sky-50/70 p-3 text-xs text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200 leading-relaxed shadow-2xs"
          >
            <Info
              className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400 mt-0.5"
              aria-hidden="true"
            />
            <p>{sharedUnderwriter.badgeText}</p>
          </div>
        )}
      </div>

      <div className="mt-5 sm:mt-7">
        {POLICY_COMPARISON_DIMENSIONS.map((dimension) => (
          <section
            key={dimension.id}
            aria-labelledby={`comparison-${dimension.id}`}
            className="border-b border-slate-200/80 py-4 sm:py-5 first:pt-0 last:border-b-0 dark:border-slate-800/80"
          >
            <h3
              id={`comparison-${dimension.id}`}
              className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              {dimension.category}
            </h3>
            <dl className="mt-2.5 sm:mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
              {[
                { code: insurerA, name: nameA, chunks: chunksA, sources: sourcesA },
                { code: insurerB, name: nameB, chunks: chunksB, sources: sourcesB },
              ].map(({ code, name, chunks: insurerChunks, sources }) => {
                const slug = toInsurerSlug(code);
                const dimensionSource = sources.find((s) => {
                  if (dimension.id === "flood") {
                    return s.id.endsWith("-flood") || s.id === `canonical-pds-${slug}`;
                  }
                  return s.id.endsWith(`-${dimension.id}`);
                });

                return (
                  <div
                    key={code}
                    className="flex flex-col rounded-lg border border-slate-200/80 bg-white/70 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/60 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-400 truncate">
                        {name}
                      </dt>
                      {dimensionSource && onSelectCitation && (
                        <button
                          type="button"
                          onClick={() => onSelectCitation(dimensionSource)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400 transition-colors cursor-pointer shrink-0"
                          aria-label={`View ${dimension.category} source clause for ${name}`}
                        >
                          <BookOpen className="h-3 w-3" aria-hidden="true" />
                          <span>View clause</span>
                        </button>
                      )}
                    </div>
                    <dd className="mt-1 flex-1 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed break-words">
                      <MarkdownText
                        markdown={resolvePolicyComparisonCell(dimension.id, code, insurerChunks)}
                      />
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ))}
      </div>

      <section
        aria-labelledby="comparison-sources"
        className="mt-6 sm:mt-8 space-y-4 sm:space-y-5 border-t border-slate-200/80 pt-5 dark:border-slate-800/80"
      >
        <h3
          id="comparison-sources"
          className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100"
        >
          Policy sources
        </h3>
        {[
          { code: insurerA, name: nameA, sources: sourcesA },
          { code: insurerB, name: nameB, sources: sourcesB },
        ].map(({ code, name, sources }) => (
          <div key={code} className="space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              {name} sources
            </h4>
            <div className="flex flex-col gap-1.5 sm:gap-2">
              {sources.map((chunk) => {
                const docName = formatProductDoc(chunk.source.product, chunk.source.docType);
                return (
                  <button
                    key={chunk.id}
                    type="button"
                    data-compact-action
                    onClick={() => onSelectCitation?.(chunk)}
                    aria-label={`Read source: ${docName}, ${chunk.source.section}`}
                    className="group flex w-full items-center justify-between gap-2.5 rounded-lg border border-slate-200/80 bg-white/70 px-3 py-2 text-left transition-colors hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700 dark:hover:bg-slate-900 cursor-pointer shadow-2xs min-h-[44px]"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-xs sm:text-sm font-medium text-slate-800 group-hover:text-teal-700 dark:text-slate-200 dark:group-hover:text-teal-300 underline decoration-slate-300 underline-offset-2 transition-colors">
                        {docName}
                      </span>
                      <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {chunk.source.section}
                      </span>
                    </div>
                    <BookOpen
                      className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-teal-700 dark:text-slate-500 dark:group-hover:text-teal-400 transition-colors"
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {onSelectQuery && (
        <section
          aria-labelledby="comparison-follow-ups"
          className="mt-6 sm:mt-8 border-t border-slate-200/80 pt-5 dark:border-slate-800/80"
        >
          <RelatedQuestions
            id="comparison-follow-ups"
            title="Related questions"
            dataTestId="comparison-follow-ups"
            className="mt-0 pt-0 border-t-0"
            questions={[
              {
                label: `Compare flood definitions between ${nameA} and ${nameB}`,
                query: `Compare flood definitions between ${insurerA} and ${insurerB}`,
              },
              {
                label: `What are jewellery sub-limits under ${nameA} vs ${nameB}?`,
                query: `What are jewellery sub-limits under ${insurerA} vs ${insurerB}?`,
              },
              {
                label: `How does accidental damage compare between ${nameA} and ${nameB}?`,
                query: `How does accidental damage compare between ${insurerA} and ${insurerB}?`,
              },
            ]}
            onSelectQuestion={onSelectQuery}
          />
        </section>
      )}
    </div>
  );
}
