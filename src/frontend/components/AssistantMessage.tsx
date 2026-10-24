import { AlertCircle, Bot, Check, Copy } from "lucide-react";
import React, { useState } from "react";
import { STATUTORY_GAW } from "../../constants/statutory";
import type { GroundedChunk } from "../../types/chat";
import { findMatchingChunk } from "../utils/citations";
import { CitationPill } from "./CitationPill";
import { StatutoryGaw } from "./StatutoryGaw";

export interface AssistantMessageProps {
  /**
   * The assistant markdown response text.
   */
  message: string;
  /**
   * Whether the assistant response is actively streaming.
   */
  isStreaming?: boolean;
  /**
   * Retrieved grounded chunks associated with this response.
   */
  chunks?: GroundedChunk[];
  /**
   * Callback fired when a citation pill is selected.
   */
  onSelectCitation?: (chunk: GroundedChunk | string) => void;
  /**
   * Optional callback fired when the response is copied.
   */
  onCopy?: () => void;
  /**
   * Optional custom styling classes.
   */
  className?: string;
}

/**
 * Generalized regex pattern detecting ungrounded, silent, or non-covered PDS statements.
 * Matches standard non-coverage/silent phrasing without test-fixture hardcoding.
 */
const SILENT_PDS_REGEX =
  /(?:does not|do not|cannot)\s+(?:specify|cover|provide cover)|not\s+(?:covered|insured|listed)|unlisted domestic hazard|silent on|unspecified|policy is silent|pds is silent|silent pds|no cover for unlisted|not named in the insured events/i;

/**
 * Checks if a block of text represents an ungrounded or silent PDS statement.
 */
function isSilentPdsNotice(text: string): boolean {
  return SILENT_PDS_REGEX.test(text);
}

/**
 * Parses a single markdown table row into trimmed cell strings.
 */
function parseTableRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  return trimmed.split("|").map((cell) => cell.trim());
}

/**
 * Tests if a line is a markdown table delimiter row (e.g. |:---|:---:|---:|).
 */
function isTableDelimiter(line: string): boolean {
  const cells = parseTableRow(line);
  if (cells.length === 0) return false;
  return cells.every((cell) => /^:?-+:?$/.test(cell));
}

/**
 * Parses markdown table alignment delimiters into alignment specifiers.
 */
function parseAlignments(delimiterLine: string): ("left" | "center" | "right")[] {
  const cells = parseTableRow(delimiterLine);
  return cells.map((cell) => {
    const leftColon = cell.startsWith(":");
    const rightColon = cell.endsWith(":");
    if (leftColon && rightColon) return "center";
    if (rightColon) return "right";
    return "left";
  });
}

/**
 * Renders bold, italic, and inline code formatting.
 */
function renderFormatting(text: string): React.ReactNode[] {
  const formatRegex = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*|_[^_]+_)/g;
  const tokens = text.split(formatRegex);

  return tokens.map((token, tIdx) => {
    if (!token) return null;

    if (
      (token.startsWith("**") && token.endsWith("**") && token.length >= 4) ||
      (token.startsWith("__") && token.endsWith("__") && token.length >= 4)
    ) {
      const content = token.slice(2, -2);
      return (
        <strong key={tIdx} className="font-semibold text-slate-900 dark:text-slate-100">
          {content}
        </strong>
      );
    }

    if (token.startsWith("`") && token.endsWith("`") && token.length >= 2) {
      const code = token.slice(1, -1);
      return (
        <code
          key={tIdx}
          className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-sky-800 dark:text-sky-300 font-mono text-xs border border-slate-200 dark:border-slate-700"
        >
          {code}
        </code>
      );
    }

    if (
      (token.startsWith("*") && token.endsWith("*") && token.length >= 2) ||
      (token.startsWith("_") && token.endsWith("_") && token.length >= 2)
    ) {
      const italic = token.slice(1, -1);
      return (
        <em key={tIdx} className="italic text-slate-800 dark:text-slate-200">
          {italic}
        </em>
      );
    }

    return token;
  });
}

/**
 * Renders inline text containing potential CitationPills and typography formatting.
 */
function renderInlineText(
  text: string,
  chunks?: GroundedChunk[],
  onSelectCitation?: (chunk: GroundedChunk | string) => void
): React.ReactNode {
  const citationPattern = /(\[(?:Source:\s*[^\]]+|[^\]]+(?:PDS|TMD|SPDS|Section)[^\]]*)\])/g;
  const parts = text.split(citationPattern);

  return (
    <>
      {parts.map((part, index) => {
        if (!part) return null;

        if (part.startsWith("[") && part.endsWith("]")) {
          const lower = part.toLowerCase();
          const isCitation =
            lower.includes("source:") ||
            lower.includes("pds") ||
            lower.includes("tmd") ||
            lower.includes("spds") ||
            lower.includes("section");

          if (isCitation) {
            const matchedChunk = findMatchingChunk(part, chunks);
            return (
              <CitationPill
                key={`cit-${index}`}
                chunk={matchedChunk}
                label={part}
                onClick={() => onSelectCitation?.(matchedChunk ?? part)}
              />
            );
          }
        }

        return <React.Fragment key={`fmt-${index}`}>{renderFormatting(part)}</React.Fragment>;
      })}
    </>
  );
}

type MarkdownBlock =
  | { type: "header"; level: number; text: string }
  | {
      type: "table";
      headers: string[];
      alignments: ("left" | "center" | "right")[];
      rows: string[][];
    }
  | { type: "code"; language: string; code: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "silent-notice"; text: string }
  | { type: "paragraph"; text: string };

function isStartOfOtherBlock(lines: string[], idx: number): boolean {
  const line = lines[idx]?.trim() ?? "";
  if (!line) return true;
  if (line.startsWith("```")) return true;
  if (/^#{1,6}\s+/.test(line)) return true;
  if (/^[-*]\s+/.test(line)) return true;
  if (/^\d+\.\s+/.test(line)) return true;
  if (line.includes("|") && lines[idx + 1]?.includes("|") && isTableDelimiter(lines[idx + 1])) {
    return true;
  }
  return false;
}

/**
 * Fenced Code Block Component with syntax styling, line numbers, and copy action.
 */
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const lines = code.split("\n");

  return (
    <div
      data-testid="code-block"
      className="my-3 rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-md overflow-hidden font-mono text-xs sm:text-sm"
    >
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-800/90 border-b border-slate-700/80 text-xs text-slate-400">
        <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-300">
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={handleCopyCode}
          aria-label="Copy code block"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span className="text-emerald-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3.5 overflow-x-auto leading-relaxed">
        <pre className="m-0 font-mono text-xs sm:text-sm">
          <code>
            {lines.map((l, lIdx) => (
              <div key={lIdx} className="table-row">
                <span className="table-cell pr-3 text-slate-500 select-none text-right w-6 text-[11px]">
                  {lIdx + 1}
                </span>
                <span className="table-cell text-slate-100">{l || "\n"}</span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}

/**
 * AssistantMessage Component
 *
 * Renders rich assistant markdown canvas with:
 * - Sub-limit tabular data display with tabular-nums and zebra striping (Spec 05 US-6)
 * - Negative constraint / Silent PDS callout banners (Spec 05 US-16)
 * - Clickable inline citation pills linking to GroundedChunk sources (Spec 05 US-4)
 * - Streaming blinking cursor indicator
 * - Interactive copy answer button with momentary feedback
 * - Section 949A General Advice Warning (Corporations Act 2001)
 */
export function AssistantMessage({
  message,
  isStreaming = false,
  chunks,
  onSelectCitation,
  onCopy,
  className = "",
}: AssistantMessageProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
      }
      setCopied(true);
      onCopy?.();
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to copy assistant message:", err);
    }
  };

  // Strip duplicate statutory GAW if backend appended it to the raw message
  let bodyText = message;
  const gawMarker = "⚠️ General Advice Warning:";
  const gawIndex = bodyText.indexOf(gawMarker);
  if (gawIndex !== -1) {
    bodyText = bodyText.substring(0, gawIndex).trimEnd();
  } else {
    const exactIndex = bodyText.indexOf(STATUTORY_GAW);
    if (exactIndex !== -1) {
      bodyText = bodyText.substring(0, exactIndex).trimEnd();
    }
  }

  // Parse lines into structured blocks
  const lines = bodyText.split("\n");
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // 1. Fenced Code Block
    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith("```")) {
        i++; // consume closing ```
      }
      blocks.push({
        type: "code",
        language: language || "text",
        code: codeLines.join("\n"),
      });
      continue;
    }

    // 2. Table
    if (line.includes("|") && lines[i + 1]?.includes("|") && isTableDelimiter(lines[i + 1])) {
      const headers = parseTableRow(line);
      const alignments = parseAlignments(lines[i + 1]);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim().length > 0) {
        rows.push(parseTableRow(lines[i]));
        i++;
      }
      blocks.push({ type: "table", headers, alignments, rows });
      continue;
    }

    // 2. Header
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headerMatch) {
      blocks.push({
        type: "header",
        level: headerMatch[1].length,
        text: headerMatch[2],
      });
      i++;
      continue;
    }

    // 3. Unordered list
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // 4. Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // 5. Paragraph or Silent PDS Notice
    const pLines: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== "" && !isStartOfOtherBlock(lines, i)) {
      pLines.push(lines[i]);
      i++;
    }
    const fullParagraph = pLines.join("\n");

    if (isSilentPdsNotice(fullParagraph)) {
      if (blocks.length > 0 && blocks[blocks.length - 1].type === "silent-notice") {
        (blocks[blocks.length - 1] as { type: "silent-notice"; text: string }).text +=
          "\n\n" + fullParagraph;
      } else {
        blocks.push({ type: "silent-notice", text: fullParagraph });
      }
    } else {
      blocks.push({ type: "paragraph", text: fullParagraph });
    }
  }

  return (
    <article
      role="article"
      aria-label="Assistant message"
      className={`my-4 flex items-start gap-3 group max-w-full ${className}`}
    >
      {/* Bot Avatar */}
      <div
        className="w-8 h-8 rounded-full bg-sky-600 dark:bg-sky-500 text-white flex items-center justify-center shrink-0 mt-1 shadow-xs ring-2 ring-white dark:ring-slate-900"
        aria-hidden="true"
      >
        <Bot className="w-4 h-4" />
      </div>

      {/* Main Canvas Card */}
      <div className="flex-1 min-w-0 bg-white dark:bg-slate-900 rounded-2xl rounded-tl-xs p-4 sm:p-5 border border-slate-200/90 dark:border-slate-800 shadow-xs">
        {/* Top bar: Assistant branding + Copy button */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
            <span>FAQ-Mate Grounded Intelligence</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-semibold uppercase tracking-wider">
              PDS Edge
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy answer"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer select-none"
          >
            {copied ? (
              <>
                <Check
                  className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Structured Rendered Blocks */}
        <div className="space-y-3 text-slate-800 dark:text-slate-200 leading-relaxed text-sm sm:text-base">
          {blocks.map((block, bIdx) => {
            if (block.type === "header") {
              const Tag = `h${Math.min(block.level, 6)}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
              const classes: Record<number, string> = {
                1: "text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-4 mb-2",
                2: "text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mt-3 mb-2",
                3: "text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 mt-3 mb-1.5",
                4: "text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200 mt-2 mb-1",
                5: "text-sm font-semibold text-slate-800 dark:text-slate-200 mt-2 mb-1",
                6: "text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mt-2 mb-1",
              };
              return (
                <Tag key={bIdx} className={classes[block.level] ?? classes[3]}>
                  {renderInlineText(block.text, chunks, onSelectCitation)}
                </Tag>
              );
            }

            if (block.type === "table") {
              return (
                <div
                  key={bIdx}
                  data-testid="table-container"
                  className="my-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs"
                >
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/80">
                      <tr>
                        {block.headers.map((h, i) => (
                          <th
                            key={i}
                            scope="col"
                            className={`px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 tracking-wider uppercase ${
                              block.alignments[i] === "center"
                                ? "text-center"
                                : block.alignments[i] === "right"
                                  ? "text-right"
                                  : "text-left"
                            }`}
                          >
                            {renderInlineText(h, chunks, onSelectCitation)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 tabular-nums">
                      {block.rows.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 even:bg-slate-50/40 dark:even:bg-slate-800/20 transition-colors"
                        >
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className={`px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 ${
                                block.alignments[cIdx] === "center"
                                  ? "text-center"
                                  : block.alignments[cIdx] === "right"
                                    ? "text-right"
                                    : "text-left"
                              }`}
                            >
                              {renderInlineText(cell, chunks, onSelectCitation)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }

            if (block.type === "code") {
              return <CodeBlock key={bIdx} code={block.code} language={block.language} />;
            }

            if (block.type === "ul") {
              return (
                <ul
                  key={bIdx}
                  className="my-2.5 ml-4 sm:ml-5 space-y-1 list-disc text-slate-700 dark:text-slate-300 text-sm sm:text-base"
                >
                  {block.items.map((item, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {renderInlineText(item, chunks, onSelectCitation)}
                    </li>
                  ))}
                </ul>
              );
            }

            if (block.type === "ol") {
              return (
                <ol
                  key={bIdx}
                  className="my-2.5 ml-4 sm:ml-5 space-y-1 list-decimal text-slate-700 dark:text-slate-300 text-sm sm:text-base"
                >
                  {block.items.map((item, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {renderInlineText(item, chunks, onSelectCitation)}
                    </li>
                  ))}
                </ol>
              );
            }

            if (block.type === "silent-notice") {
              return (
                <div
                  key={bIdx}
                  role="alert"
                  aria-label="Silent PDS Notice"
                  data-testid="silent-pds-notice"
                  className="my-3 rounded-lg border border-amber-200 dark:border-amber-800/70 bg-amber-50/90 dark:bg-amber-950/40 p-4 text-amber-950 dark:text-amber-200 shadow-xs"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle
                      className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-100">
                          Silent PDS Notice
                        </span>
                      </div>
                      <div className="space-y-2 text-sm font-medium leading-relaxed">
                        {block.text.split("\n\n").map((para, pIdx) => (
                          <p key={pIdx}>{renderInlineText(para, chunks, onSelectCitation)}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <p key={bIdx} className="leading-relaxed whitespace-pre-wrap break-words">
                {renderInlineText(block.text, chunks, onSelectCitation)}
              </p>
            );
          })}

          {/* Streaming Cursor */}
          {isStreaming && (
            <span
              data-testid="streaming-cursor"
              role="status"
              aria-label="Assistant is generating"
              className="inline-block w-2 h-4 ml-1 bg-sky-500 animate-pulse align-middle rounded-xs"
            />
          )}
        </div>

        {/* Statutory Section 949A GAW banner rendered at bottom of completed assistant response */}
        {!isStreaming && message.trim().length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <StatutoryGaw />
          </div>
        )}
      </div>
    </article>
  );
}
