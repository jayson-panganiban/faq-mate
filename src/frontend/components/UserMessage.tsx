import { sanitizeClientPii } from "../utils/client-pii-scrubber";

export interface UserMessageProps {
  /**
   * The user query text.
   */
  query: string;
  /**
   * Optional insurer filter applied to the query (e.g. "NRMA", "Suncorp").
   * Defaults to "All Insurers" if unspecified.
   */
  insurer?: string;
  /**
   * Optional display timestamp (e.g. "10:42 AM").
   */
  timestamp?: string;
  /**
   * Optional custom styling classes.
   */
  className?: string;
}

/**
 * UserMessage Component
 *
 * Renders the user query bubble with a distinct visual background,
 * formatted timestamp, active insurer filter,
 * and client-side PII sanitization assurance indicator.
 */
export function UserMessage({ query, insurer, timestamp, className = "" }: UserMessageProps) {
  const { sanitized, wasRedacted } = sanitizeClientPii(query);
  const displayInsurer = insurer && insurer.trim().length > 0 ? insurer.trim() : "All Insurers";

  return (
    <article
      role="article"
      aria-label="User message"
      className={`flex items-start justify-end gap-3 my-4 group ${className}`}
    >
      <div className="flex flex-col items-end max-w-[85%] space-y-1.5">
        {/* Header metadata: Insurer badge + timestamp */}
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          {wasRedacted && (
            <span
              data-testid="pii-sanitized-badge"
              className="text-[11px]"
              title="Protected under APP 3/11 client-side redaction"
            >
              <span>Sanitized</span>
            </span>
          )}
          <span className="text-[11px]" data-testid="insurer-badge">
            {displayInsurer}
          </span>
          {timestamp && (
            <time className="text-slate-500 dark:text-slate-400 text-[11px]">{timestamp}</time>
          )}
        </div>

        {/* Message bubble */}
        <div className="bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-50 rounded-3xl px-4 py-3">
          <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words selection:bg-sky-500 selection:text-white">
            {sanitized}
          </p>
        </div>
      </div>
    </article>
  );
}
