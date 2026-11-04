import { ArrowDown } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChatMessage, GroundedChunk, StreamState } from "../types/chat-ui";
import { AssistantMessage } from "./AssistantMessage";
import { EmergencyBanner } from "./EmergencyBanner";
import { RefusalCard } from "./RefusalCard";
import { UserMessage } from "./UserMessage";

export interface StarterPrompt {
  query: string;
  insurer?: string;
  tag: string;
}

export const STARTER_PROMPTS: StarterPrompt[] = [
  {
    query: "What is Suncorp's flood definition?",
    insurer: "SUNCORP",
    tag: "Flood Cover",
  },
  {
    query: "NRMA vs Allianz comprehensive motor comparison",
    insurer: "NRMA",
    tag: "Motor",
  },
  {
    query: "Explain jewelry sub-limits under Allianz",
    insurer: "ALLIANZ",
    tag: "Sub-limits",
  },
  {
    query: "What is QBE's accidental damage cover for glass?",
    insurer: "QBE",
    tag: "Accidental Damage",
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
 * Manages the message feed, auto-scrolling, stream anchoring, empty state
 * starter prompt cards, and connects UserMessage, AssistantMessage (which
 * renders the loading skeleton inside its own shell), RefusalCard, and
 * EmergencyBanner.
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
      {/* Empty state relies on `my-auto` so it centres when it fits and
          top-aligns once it overflows; `justify-center` would clip the heading
          above scrollTop 0 on short viewports. */}
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
        {/* Empty State: Clean Search-First Canvas & Modern Two-Column Prompts */}
        {isEmpty && (
          <div className="relative max-w-2xl mx-auto my-auto py-6 sm:py-8 lg:py-10 px-2 sm:px-4 flex flex-col items-start w-full space-y-4 sm:space-y-5">
            {/* Header: Search-first typography without marketing bloat */}
            <div className="space-y-1.5 text-left w-full">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Understand your insurance cover
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Ask a question, compare policy wording, and check the sources.
              </p>
            </div>

            {/* Try a question: Clean Two-Column Agentic Grid */}
            <div className="w-full space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 px-0.5">
                <span>Try a question</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 w-full">
                {STARTER_PROMPTS.map((prompt, idx) => (
                  <button
                    key={prompt.query}
                    type="button"
                    data-testid={`starter-prompt-${idx}`}
                    onClick={() => onSelectStarterQuery?.(prompt.query, prompt.insurer)}
                    className="group flex flex-col justify-between p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-800/80 hover:border-teal-500/40 dark:hover:border-teal-400/40 shadow-2xs hover:shadow-xs transition-[border-color,background-color,box-shadow,transform] duration-150 text-left cursor-pointer active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-hidden"
                  >
                    <div className="w-full">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 group-hover:text-teal-700 dark:group-hover:text-teal-300 transition-colors leading-snug">
                          {prompt.query}
                        </p>
                        {prompt.insurer && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60 tracking-wide">
                            {prompt.insurer}
                          </span>
                        )}
                      </div>
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

            // Associate grounded chunks: from message metadata or active stream citations
            const chunks = msg.metadata?.retrievedChunks || (isLastMessage ? citations : undefined);

            const isStreaming = isLastMessage && status === "STREAMING";

            // Loading state: the skeleton renders inside the AssistantMessage
            // shell itself (same header row, sources-shelf slot and body
            // typography), so the streamed/final layout lands with no shift.
            if (isConnecting) {
              return (
                <AssistantMessage
                  key={msg.id}
                  dataTestId="loading-indicator"
                  message=""
                  isLoading
                  loadingLabel={
                    status === "METADATA_RECEIVED"
                      ? "Preparing your answer..."
                      : "Looking for relevant policy wording..."
                  }
                  chunks={chunks}
                  onSelectCitation={onSelectCitation}
                  showGaw={false}
                />
              );
            }

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
