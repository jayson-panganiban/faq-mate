import { ArrowDown, ArrowUpRight, Bot, Search, Sparkles } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChatMessage, GroundedChunk, StreamState } from "../types/chat-ui";
import { AssistantMessage } from "./AssistantMessage";
import { EmergencyBanner } from "./EmergencyBanner";
import { RefusalCard } from "./RefusalCard";
import { SourceCardGrid } from "./SourceCardGrid";
import { UserMessage } from "./UserMessage";

export interface StarterPrompt {
  query: string;
  insurer?: string;
  tag: string;
  description: string;
}

export const STARTER_PROMPTS: StarterPrompt[] = [
  {
    query: "What is Suncorp's flood definition?",
    insurer: "SUNCORP",
    tag: "Flood Cover",
    description: "Inspect standard flood definitions and rainwater run-off exclusions.",
  },
  {
    query: "NRMA vs Allianz comprehensive motor comparison",
    insurer: "NRMA",
    tag: "Motor",
    description: "Compare accidental damage, agreed value, and choice of repairer.",
  },
  {
    query: "Explain jewelry sub-limits under Allianz",
    insurer: "ALLIANZ",
    tag: "Sub-limits",
    description: "Review per-item and total collection monetary limits for high-value items.",
  },
  {
    query: "What is QBE's accidental damage cover for glass?",
    insurer: "QBE",
    tag: "Accidental Damage",
    description: "Examine fixed glass, skylights, and solar panel breakage terms.",
  },
  {
    query: "Does NRMA cover rainwater run-off?",
    insurer: "NRMA",
    tag: "Water Damage",
    description: "Compare escape of liquid vs storm surge and surface water run-off.",
  },
];

export interface ChatContainerProps {
  scrollToMessage?: { id: string; sequence: number };
  messages: ChatMessage[];
  status: StreamState;
  citations: GroundedChunk[];
  onSelectCitation: (chunk: GroundedChunk | string) => void;
  onSelectStarterQuery?: (query: string, insurer?: string) => void;
  className?: string;
}

/**
 * Format message timestamp into a readable 12-hour or local string.
 */
function formatTime(timestamp?: number): string | undefined {
  if (!timestamp) return undefined;
  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return undefined;
  }
}

/**
 * ChatContainer Component (Spec 05 Section 3)
 *
 * Manages the message feed, auto-scrolling, stream anchoring, loading skeletons,
 * empty state starter prompt cards, and connects UserMessage, AssistantMessage,
 * RefusalCard, and EmergencyBanner.
 */
export function ChatContainer({
  messages,
  scrollToMessage,
  status,
  citations,
  onSelectCitation,
  onSelectStarterQuery,
  className = "",
}: ChatContainerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const isUserScrolledUpRef = useRef(false);

  const hasMessagesRef = useRef(messages.length > 0);

  const updateScrollState = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    const isScrolledUp = hasMessagesRef.current && distance > 80;
    isUserScrolledUpRef.current = isScrolledUp;
    setShowScrollButton(isScrolledUp);
  }, []);

  const syncScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    // Scroll only this feed. scrollIntoView also moves overflow-hidden ancestors,
    // and smooth scrolling emits intermediate events that look like manual scrolling.
    if (!hasMessagesRef.current) container.scrollTop = 0;
    else if (!isUserScrolledUpRef.current) container.scrollTop = container.scrollHeight;
    updateScrollState();
  }, [updateScrollState]);

  useLayoutEffect(() => {
    hasMessagesRef.current = messages.length > 0;
    syncScroll();
  }, [messages, syncScroll]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(syncScroll);
    observer.observe(container);
    return () => observer.disconnect();
  }, [syncScroll]);

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!scrollToMessage || !container) return;
    const element = Array.from(container.querySelectorAll<HTMLElement>("[data-message-id]")).find(
      (node) => node.dataset.messageId === scrollToMessage.id
    );
    if (element) {
      container.scrollTop +=
        element.getBoundingClientRect().top - container.getBoundingClientRect().top;
      updateScrollState();
    }
  }, [scrollToMessage, updateScrollState]);

  const scrollToBottom = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
    updateScrollState();
  };

  const isEmpty = messages.length === 0;

  return (
    <div className={`relative flex-1 flex flex-col min-h-0 overflow-hidden ${className}`}>
      {/* Scrollable Message List Canvas */}
      <div
        ref={scrollContainerRef}
        onScroll={updateScrollState}
        data-testid="chat-scroll-container"
        role="log"
        aria-label="Insurance Policy Chat History"
        aria-live="polite"
        className={`flex-1 overflow-y-auto px-2 sm:px-4 pt-4 pb-0 lg:pb-4 focus:outline-none ${isEmpty ? "flex flex-col" : "space-y-4"}`}
        tabIndex={0}
      >
        {/* Empty State: Clean Search-First Canvas & Vertical Try a question */}
        {isEmpty && (
          <div className="relative max-w-2xl mx-auto mt-0 py-0 lg:py-2 px-2 sm:px-4 flex flex-col items-start w-full space-y-2.5 sm:space-y-3.5">
            {/* Header: Search-first typography without marketing bloat */}
            <div className="relative z-10 space-y-1 text-left w-full">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Understand your insurance cover
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Ask a question, compare policy wording, and check the sources.
              </p>
            </div>

            {/* Try a question: Compact Vertical List */}
            <div className="relative z-10 w-full space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                <span>Try a question</span>
              </div>

              <div className="flex flex-col gap-1.5 sm:gap-2 w-full">
                {STARTER_PROMPTS.map((prompt, idx) => (
                  <button
                    key={prompt.query}
                    type="button"
                    data-testid={`starter-prompt-${idx}`}
                    onClick={() => onSelectStarterQuery?.(prompt.query, prompt.insurer)}
                    className="group w-full flex items-center justify-between gap-3 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800/90 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xs hover:border-teal-500/50 dark:hover:border-teal-400/50 hover:bg-white dark:hover:bg-slate-800/90 shadow-2xs hover:shadow-xs transition-[border-color,background-color,box-shadow,transform] text-left cursor-pointer active:scale-[0.995] focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-hidden"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800/90 flex items-center justify-center shrink-0 group-hover:bg-teal-50 dark:group-hover:bg-teal-950/50 transition-colors">
                        <Search
                          className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors"
                          aria-hidden="true"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 break-words group-hover:text-teal-700 dark:group-hover:text-teal-300 transition-colors">
                          {prompt.query}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                          {prompt.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {prompt.insurer && (
                        <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60">
                          {prompt.insurer}
                        </span>
                      )}
                      <span className="hidden md:inline-block text-[11px] font-medium text-slate-400 dark:text-slate-500">
                        {prompt.tag}
                      </span>
                      <ArrowUpRight
                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-300 dark:text-slate-600 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors shrink-0"
                        aria-hidden="true"
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Render Conversation Messages */}
        {!isEmpty &&
          messages.map((msg, idx) => {
            if (msg.role === "user") {
              return (
                <div key={msg.id} data-message-id={msg.id}>
                  <UserMessage
                    query={msg.content}
                    insurer={msg.insurer}
                    timestamp={formatTime(msg.timestamp)}
                  />
                </div>
              );
            }

            // Refusal cards for advice boundary violations
            if (msg.refusal?.code === "ADVICE_BOUNDARY_VIOLATION") {
              return (
                <RefusalCard
                  key={msg.id}
                  code={msg.refusal.code}
                  message={msg.refusal.message}
                  reason={msg.refusal.reason}
                  showGaw={false}
                />
              );
            }

            // Emergency banner for immediate life safety
            if (msg.refusal?.code === "EMERGENCY_INTERCEPTION") {
              return (
                <EmergencyBanner
                  key={msg.id}
                  code={msg.refusal.code}
                  message={msg.refusal.message}
                  reason={msg.refusal.reason}
                />
              );
            }

            const isLastMessage = idx === messages.length - 1;
            const isConnecting =
              isLastMessage &&
              (status === "CONNECTING" || status === "METADATA_RECEIVED") &&
              !msg.content;

            // Loading indicator / skeleton when waiting for first token
            if (isConnecting) {
              return (
                <div
                  key={msg.id}
                  data-testid="loading-indicator"
                  role="status"
                  aria-label="Retrieving policy documents"
                  className="flex items-start gap-3 my-4 group animate-fade-in"
                >
                  <div
                    className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 mt-1 shadow-xs ring-2 ring-white dark:ring-slate-900"
                    aria-hidden="true"
                  >
                    <Bot className="w-4 h-4 motion-safe:animate-spin" />
                  </div>
                  <div className="flex-1 max-w-[85%] sm:max-w-[80%] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <Sparkles className="w-3.5 h-3.5 text-sky-500 motion-safe:animate-pulse" />
                      <span>
                        {status === "METADATA_RECEIVED"
                          ? "Preparing your answer..."
                          : "Looking for relevant policy wording..."}
                      </span>
                    </div>
                    {status === "METADATA_RECEIVED" && citations.length > 0 && (
                      <div className="pt-1">
                        <SourceCardGrid chunks={citations} onSelectCitation={onSelectCitation} />
                      </div>
                    )}
                    <div className="space-y-2">
                      <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded-full w-3/4 motion-safe:animate-pulse" />
                      <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded-full w-1/2 motion-safe:animate-pulse" />
                    </div>
                  </div>
                </div>
              );
            }

            // Associate grounded chunks: from message metadata or active stream citations
            const chunks = msg.metadata?.retrievedChunks || (isLastMessage ? citations : undefined);

            const isStreaming = isLastMessage && status === "STREAMING";

            return (
              <AssistantMessage
                key={msg.id}
                message={msg.content}
                isStreaming={isStreaming}
                chunks={chunks}
                suggestedFollowUps={msg.metadata?.suggestedFollowUps}
                onSelectFollowUp={onSelectStarterQuery}
                onSelectCitation={onSelectCitation}
                showGaw={false}
              />
            );
          })}

        <div className="h-px w-full" aria-hidden="true" />
      </div>

      {/* Reserve a separate row so the control never covers readable text. */}
      {showScrollButton && (
        <div className="flex shrink-0 justify-center py-1">
          <button
            type="button"
            data-testid="scroll-to-bottom-button"
            onClick={scrollToBottom}
            aria-label="Scroll to bottom"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-600"
          >
            <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="sr-only">Scroll to bottom</span>
          </button>
        </div>
      )}
    </div>
  );
}
