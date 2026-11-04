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

const FILTER_GROUPS = GROUPED_INSURER_OPTIONS.map((group) => ({
  id: group.category,
  label: group.label,
  options: group.options.map((option) => ({
    value: option.value,
    label: option.label,
    title: option.underwriter,
  })),
}));

const INSURER_LABELS = new Map(
  GROUPED_INSURER_OPTIONS.flatMap((group) => group.options).map(
    (option) => [option.value, option.label] as const
  )
);

const EMPTY_CHUNKS: GroundedChunk[] = [];

/**
 * Follow-ups drill into statutory mechanics the matrix does not already restate
 * (general exclusions, excesses and the 72-hour embargo) rather than repeating
 * the four comparison dimensions shown above.
 */
const COMPARISON_FOLLOW_UPS = [
  (a: string, b: string) => `Compare general exclusions between ${a} and ${b}`,
  (a: string, b: string) => `What excesses apply under ${a} and ${b}?`,
  (a: string, b: string) => `Explain the 72-hour flood embargo for ${a} and ${b}`,
] as const;

const isLifeInsurer = (code: string) => resolveInsurer(code)?.profile.category === "life-insurers";

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

  const chunksA = chunksByInsurer.get(insurerA) ?? EMPTY_CHUNKS;
  const chunksB = chunksByInsurer.get(insurerB) ?? EMPTY_CHUNKS;

  const nameA = INSURER_LABELS.get(insurerA) ?? insurerA;
  const nameB = INSURER_LABELS.get(insurerB) ?? insurerB;

  // One column model shared by the comparison matrix and the sources list, so
  // insurer order and source pairing cannot drift between the two surfaces.
  const columns = useMemo(
    () => [
      { code: insurerA, name: nameA, chunks: chunksA, sources: sourcesA },
      { code: insurerB, name: nameB, chunks: chunksB, sources: sourcesB },
    ],
    [insurerA, insurerB, nameA, nameB, chunksA, chunksB, sourcesA, sourcesB]
  );

  const lifeInsurerNames = columns
    .filter((column) => isLifeInsurer(column.code))
    .map((column) => column.name);

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
              groups={FILTER_GROUPS}
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
              groups={FILTER_GROUPS}
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

      {/* Life product-line notice: one explanation instead of repeating the same
          non-applicability paragraph in all four dimension rows. */}
      {lifeInsurerNames.length > 0 && (
        <div
          data-testid="life-product-notice"
          role="note"
          className="mt-3.5 flex items-start gap-2.5 rounded-lg border border-amber-200/80 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 leading-relaxed shadow-2xs"
        >
          <Info
            className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5"
            aria-hidden="true"
          />
          <p>
            {lifeInsurerNames.length === 2
              ? `${lifeInsurerNames[0]} and ${lifeInsurerNames[1]} both issue Life, TPD, Trauma and Income Protection policies. The property perils, contents sub-limits and flood definitions compared below do not apply to these product lines.`
              : `${lifeInsurerNames[0]} issues Life, TPD, Trauma and Income Protection policies. The property perils, contents sub-limits and flood definitions compared below do not apply to that product line.`}
          </p>
        </div>
      )}

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
              {columns.map(({ code, name, chunks: insurerChunks }) => (
                <div
                  key={code}
                  className="flex flex-col rounded-lg border border-slate-200/80 bg-white/70 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/60 shadow-2xs"
                >
                  <dt className="text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-400 truncate">
                    {name}
                  </dt>
                  <dd className="mt-1 flex-1 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed break-words">
                    <MarkdownText
                      markdown={resolvePolicyComparisonCell(dimension.id, code, insurerChunks)}
                    />
                  </dd>
                </div>
              ))}
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
        {columns.map(({ code, name, sources }) => (
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
                    disabled={!onSelectCitation}
                    onClick={() => onSelectCitation?.(chunk)}
                    aria-label={`Read source: ${docName}, ${chunk.source.section}`}
                    className="group flex w-full items-center justify-between gap-2.5 rounded-lg border border-slate-200/80 bg-white/70 px-3 py-2 text-left transition-colors hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700 dark:hover:bg-slate-900 cursor-pointer shadow-2xs min-h-[44px] disabled:pointer-events-none disabled:cursor-default disabled:opacity-70"
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
        <RelatedQuestions
          id="comparison-follow-ups"
          title="Related questions"
          dataTestId="comparison-follow-ups"
          className="mt-6 sm:mt-8 pt-5"
          questions={COMPARISON_FOLLOW_UPS.map((format) => ({
            label: format(nameA, nameB),
            query: format(insurerA, insurerB),
          }))}
          onSelectQuestion={onSelectQuery}
        />
      )}
    </div>
  );
}
