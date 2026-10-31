import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { sanitizeSourceMarkdown } from "../utils/markdown";

export interface MarkdownTextProps {
  /**
   * Raw derived markdown (corpus chunk content, comparison cells). It passes
   * through the sanitizer in `utils/markdown` and then React-Markdown's
   * standard parser before the UI ever sees it: backend tags stripped, URLs
   * cleaned into labelled anchors, and raw HTML nodes dropped entirely.
   */
  markdown: string;
  /**
   * Accessible label when multiple excerpts sit on one screen.
   */
  label?: string;
  className?: string;
}

/**
 * Renders approved derived markdown as styled markup — `**bold**` as emphasis
 * text and `###` as a real heading, never raw syntax. Parsed elements are
 * native React nodes, so no raw HTML string is ever injected into the DOM.
 * Do not use this for user chat input or assistant replies; those flow
 * through the citation-aware renderer in `AssistantMessage`.
 */
export function MarkdownText({ markdown, label, className = "" }: MarkdownTextProps) {
  const source = useMemo(() => sanitizeSourceMarkdown(markdown), [markdown]);
  // A named region only when a label distinguishes it from other excerpts.
  const regionProps = label
    ? ({ role: "region", "aria-label": label } as const)
    : ({} as Record<string, never>);
  return (
    <div
      data-testid="markdown-text"
      {...regionProps}
      className={`markdown-text min-w-0 ${className}`}
    >
      <ReactMarkdown
        components={{
          a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
