import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import { useMemo, useState } from "react";
import {
  getGroupedInsurerOptions,
  POLICY_COMPARISON_DIMENSIONS,
  type PrimaryInsurerCode,
  resolveInsurer,
  resolvePolicyComparisonCell,
} from "../../constants/insurers";
import type { GroundedChunk } from "../types/chat-ui";
import { formatProductDoc } from "../utils/citations";
import { GlobalFilterDropdown } from "./GlobalFilterDropdown";
import { MarkdownText } from "./MarkdownText";

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
    "inline-flex min-h-[44px] items-center gap-1.5 text-sm text-slate-600 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-400 focus-visible:outline-2 focus-visible:outline-teal-600 cursor-pointer";

  return (
    <div
      data-testid="policy-comparison-view"
      className={`min-h-0 flex-1 overflow-y-auto px-1 pt-1 pb-6 sm:px-2 ${className}`}
    >
      {onClose && (
        <button
          type="button"
          data-testid="close-comparison-button"
          onClick={onClose}
          className={linkClass}
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back
        </button>
      )}
      <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        Compare Policies
      </h2>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
        {[
          { id: "a", label: "Primary insurer", value: insurerA, other: insurerB, set: setInsurerA },
          {
            id: "b",
            label: "Comparison insurer",
            value: insurerB,
            other: insurerA,
            set: setInsurerB,
          },
        ].map(({ id, label, value, other, set }) => (
          <div key={id} className="min-w-0">
            <label
              htmlFor={`insurer-${id}-trigger`}
              className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              {label}
            </label>
            <GlobalFilterDropdown
              triggerId={`insurer-${id}-trigger`}
              testIdPrefix={`insurer-${id}`}
              variant="field"
              ariaLabel={label}
              value={value}
              onSelect={(next) => set(next as PrimaryInsurerCode)}
              groups={filterGroups}
              disabledOptionValues={[other]}
            />
          </div>
        ))}
      </div>

      <div className="mt-8">
        {POLICY_COMPARISON_DIMENSIONS.map((dimension) => (
          <section
            key={dimension.id}
            aria-labelledby={`comparison-${dimension.id}`}
            className="border-b border-slate-200 py-6 first:pt-0 dark:border-slate-800"
          >
            <h3
              id={`comparison-${dimension.id}`}
              className="text-base font-bold text-slate-900 dark:text-slate-100"
            >
              {dimension.category}
            </h3>
            <dl className="mt-4 space-y-5">
              {[
                { code: insurerA, name: nameA, chunks: chunksA },
                { code: insurerB, name: nameB, chunks: chunksB },
              ].map(({ code, name, chunks: insurerChunks }) => (
                <div key={code}>
                  <dt className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {name}
                  </dt>
                  <dd className="mt-1 break-words">
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

      {(chunksA.length > 0 || chunksB.length > 0) && (
        <section aria-labelledby="comparison-sources" className="mt-8 space-y-5">
          <h3
            id="comparison-sources"
            className="text-base font-bold text-slate-900 dark:text-slate-100"
          >
            Policy sources
          </h3>
          {[
            { code: insurerA, name: nameA, chunks: chunksA },
            { code: insurerB, name: nameB, chunks: chunksB },
          ].map(({ code, name, chunks: insurerChunks }) => (
            <div key={code} className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {name} sources
              </h4>
              {insurerChunks.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No sources yet for {name}.
                </p>
              ) : (
                insurerChunks.map((chunk) => (
                  <div key={chunk.id} className="space-y-1 text-sm">
                    <p className="font-medium text-slate-800 dark:text-slate-200">
                      {formatProductDoc(chunk.source.product, chunk.source.docType)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {chunk.source.section}
                    </p>
                    <MarkdownText markdown={chunk.content} />
                    <button
                      type="button"
                      onClick={() => onSelectCitation?.(chunk)}
                      className={linkClass}
                    >
                      <BookOpen className="h-4 w-4" aria-hidden="true" />
                      Read source
                    </button>
                  </div>
                ))
              )}
            </div>
          ))}
        </section>
      )}

      {onSelectQuery && (
        <section aria-labelledby="comparison-follow-ups" className="mt-8">
          <h3
            id="comparison-follow-ups"
            className="text-base font-bold text-slate-900 dark:text-slate-100"
          >
            Ask a follow-up
          </h3>
          <div className="mt-2 flex flex-col items-start gap-1">
            <button
              type="button"
              onClick={() =>
                onSelectQuery(`Compare flood definitions between ${insurerA} and ${insurerB}`)
              }
              className={linkClass}
            >
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              Compare flood definitions
            </button>
            <button
              type="button"
              onClick={() =>
                onSelectQuery(`What are jewellery sub-limits under ${insurerA} vs ${insurerB}?`)
              }
              className={linkClass}
            >
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              Compare jewellery sub-limits
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
