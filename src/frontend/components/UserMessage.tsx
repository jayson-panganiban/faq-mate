import { Shield, ShieldCheck, User } from "lucide-react";
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
 * user avatar icon, formatted timestamp, active insurer filter badge,
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
      <div className="flex flex-col items-end max-w-[calc(100%-2.75rem)] sm:max-w-[75%] space-y-1.5">
        {/* Header metadata: Insurer badge + timestamp */}
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          {wasRedacted && (
            <span
              data-testid="pii-sanitized-badge"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 border border-teal-200 dark:border-teal-800"
              title="Protected under APP 3/11 client-side redaction"
            >
              <ShieldCheck
                className="w-3 h-3 text-teal-600 dark:text-teal-400"
                aria-hidden="true"
              />
              <span>Sanitized</span>
            </span>
          )}
          <span
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-200 dark:border-sky-800 shadow-xs"
            data-testid="insurer-badge"
          >
            <Shield className="w-3 h-3 text-sky-600 dark:text-sky-400" aria-hidden="true" />
            {displayInsurer}
          </span>
          {timestamp && (
            <time className="text-slate-400 dark:text-slate-500 font-mono text-[11px]">
              {timestamp}
            </time>
          )}
        </div>

        {/* Message bubble */}
        <div className="bg-slate-900 text-white dark:bg-slate-800 rounded-2xl rounded-tr-xs px-4 py-3 shadow-sm border border-slate-800 dark:border-slate-700">
          <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words selection:bg-sky-500 selection:text-white">
            {sanitized}
          </p>
        </div>
      </div>

      {/* User Avatar */}
      <div
        data-testid="user-avatar"
        className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 mt-6 ring-2 ring-white dark:ring-slate-900 shadow-xs"
        aria-hidden="true"
      >
        <User className="w-4 h-4 text-slate-700 dark:text-slate-300" />
      </div>
    </article>
  );
}
