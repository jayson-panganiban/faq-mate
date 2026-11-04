export interface RelatedQuestionItem {
  /**
   * Visible label displayed on the button.
   */
  label: string;
  /**
   * The query payload passed to `onSelectQuestion` when clicked.
   * If omitted, defaults to `label`.
   */
  query?: string;
}

export interface RelatedQuestionsProps {
  /**
   * Section heading text. Defaults to "Related questions".
   */
  title?: string;
  /**
   * List of question items (strings or label/query objects).
   */
  questions: Array<string | RelatedQuestionItem>;
  /**
   * Callback fired when a question is selected.
   */
  onSelectQuestion: (query: string) => void;
  /**
   * Test ID for the section container. Defaults to "suggested-follow-ups".
   */
  dataTestId?: string;
  /**
   * DOM id for the heading, useful for `aria-labelledby` referencing.
   */
  id?: string;
  /**
   * Optional custom styling classes.
   */
  className?: string;
}

/**
 * RelatedQuestions Component (Spec 05 & Spec 07 Section 6)
 *
 * Renders conversational, mobile-first follow-up question suggestions.
 * Reused across completed AssistantMessage responses and PolicyComparisonView.
 */
export function RelatedQuestions({
  title = "Related questions",
  questions,
  onSelectQuestion,
  dataTestId = "suggested-follow-ups",
  id,
  className = "",
}: RelatedQuestionsProps) {
  if (!questions || questions.length === 0) {
    return null;
  }

  return (
    <div
      data-testid={dataTestId}
      className={`mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 ${className}`}
    >
      <p
        id={id}
        className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
      >
        {title}
      </p>
      <div className="flex flex-col items-start gap-1">
        {questions.map((item, idx) => {
          const label = typeof item === "string" ? item : item.label;
          const query = typeof item === "string" ? item : (item.query ?? item.label);
          const key = typeof item === "string" ? item : (item.query ?? item.label ?? `item-${idx}`);

          return (
            <button
              key={key}
              type="button"
              data-follow-up
              data-compact-action
              onClick={() => onSelectQuestion(query)}
              className="citation-standalone text-left text-xs sm:text-sm text-slate-600 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 hover:underline focus-visible:outline-2 focus-visible:outline-teal-600 cursor-pointer py-0.5 sm:py-1 leading-relaxed transition-colors"
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
