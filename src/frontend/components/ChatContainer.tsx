import { ArrowDown, Bot, ChevronRight, Compass, Shield, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage, GroundedChunk, StreamState } from "../types/chat-ui";
import { AssistantMessage } from "./AssistantMessage";
import { EmergencyBanner } from "./EmergencyBanner";
import { RefusalCard } from "./RefusalCard";
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
    tag: "Flood & Storm",
    description: "Inspect standard flood definitions and rainwater run-off exclusions.",
  },
  {
    query: "Explain jewelry sub-limits under Allianz",
    insurer: "ALLIANZ",
    tag: "Sub-limits",
    description: "Review per-item and total collection monetary limits for high-value items.",
  },
  {
    query: "Does NRMA cover rainwater run-off?",
    insurer: "NRMA",
    tag: "Water Damage",
    description: "Compare escape of liquid vs storm surge and surface water run-off.",
  },
  {
    query: "What is QBE's accidental damage cover for glass?",
    insurer: "QBE",
    tag: "Accidental Damage",
    description: "Examine fixed glass, skylights, and solar panel breakage terms.",
  },
];

export interface ChatContainerProps {
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
  status,
  citations,
  onSelectCitation,
  onSelectStarterQuery,
  className = "",
}: ChatContainerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const isUserScrolledUpRef = useRef(false);

  // Monitor scroll position to anchor streaming or show "Scroll to bottom"
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isScrolledUp = distanceFromBottom > 80;

    isUserScrolledUpRef.current = isScrolledUp;
    setShowScrollButton(isScrolledUp);
  };

  // Auto-scroll when new messages arrive or content streams, unless user scrolled up
  useEffect(() => {
    if (!isUserScrolledUpRef.current) {
      bottomSentinelRef.current?.scrollIntoView?.({ behavior: "smooth" });
    }
  }, [messages, status]);

  const scrollToBottom = () => {
    isUserScrolledUpRef.current = false;
    setShowScrollButton(false);
    bottomSentinelRef.current?.scrollIntoView?.({ behavior: "smooth" });
  };

  const isEmpty = messages.length === 0;

  // Identify the latest message that renders an inline StatutoryGaw banner so multi-turn chats
  // never stack duplicate GAW banners across historical turns.
  let lastGawMessageIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "user") continue;
    if (m.refusal?.code === "ADVICE_BOUNDARY_VIOLATION") {
      lastGawMessageIdx = i;
      break;
    }
    if (m.refusal?.code === "EMERGENCY_INTERCEPTION") {
      continue;
    }
    const isLast = i === messages.length - 1;
    const isActiveStream =
      isLast &&
      (status === "CONNECTING" || status === "METADATA_RECEIVED" || status === "STREAMING");
    if (!isActiveStream && m.content.trim().length > 0) {
      lastGawMessageIdx = i;
      break;
    }
  }

  return (
    <div className={`relative flex-1 flex flex-col min-h-0 overflow-hidden ${className}`}>
      {/* Scrollable Message List Canvas */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        data-testid="chat-scroll-container"
        role="log"
        aria-label="Insurance Policy Chat History"
        aria-live="polite"
        className="flex-1 overflow-y-auto px-2 sm:px-4 py-4 space-y-4 scroll-smooth focus:outline-hidden"
        tabIndex={0}
      >
        {/* Empty State: Starter Prompt Cards */}
        {isEmpty && (
          <div className="max-w-3xl mx-auto my-auto py-8 px-4 flex flex-col items-center text-center space-y-6">
            <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 ring-1 ring-blue-100 dark:ring-blue-900 shadow-xs">
              <Compass className="w-8 h-8" aria-hidden="true" />
            </div>

            <div className="space-y-2 max-w-lg">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Explore Australian General Insurance Policies
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Ask specific questions about home, contents, and motor policies across NRMA,
                Suncorp, Allianz, QBE, and Youi. Answers are grounded in operative Product
                Disclosure Statements.
              </p>
            </div>

            {/* Prompt Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full pt-2 text-left">
              {STARTER_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  data-testid={`starter-prompt-${idx}`}
                  onClick={() => onSelectStarterQuery?.(prompt.query, prompt.insurer)}
                  className="group p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md transition-all text-left flex flex-col justify-between cursor-pointer"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        <Shield className="w-3 h-3 text-blue-500" aria-hidden="true" />
                        {prompt.insurer}
                      </span>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {prompt.tag}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {prompt.query}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {prompt.description}
                    </p>
                  </div>

                  <div className="pt-2 flex items-center justify-end text-xs font-medium text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Ask this query</span>
                    <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Render Conversation Messages */}
        {!isEmpty &&
          messages.map((msg, idx) => {
            if (msg.role === "user") {
              return (
                <UserMessage
                  key={msg.id}
                  query={msg.content}
                  insurer={msg.insurer}
                  timestamp={formatTime(msg.timestamp)}
                />
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
                  showGaw={idx === lastGawMessageIdx}
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
                    className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-1 shadow-xs ring-2 ring-white dark:ring-slate-900"
                    aria-hidden="true"
                  >
                    <Bot className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="flex-1 max-w-[85%] sm:max-w-[80%] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <Sparkles className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                      <span>
                        {status === "METADATA_RECEIVED"
                          ? "Grounded chunks retrieved. Generating response..."
                          : "Retrieving operative PDS terms via hybrid search..."}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded-full w-3/4 animate-pulse" />
                      <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded-full w-1/2 animate-pulse" />
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
                showGaw={idx === lastGawMessageIdx}
              />
            );
          })}

        <div ref={bottomSentinelRef} className="h-px w-full" aria-hidden="true" />
      </div>

      {/* Floating "Scroll to bottom" button */}
      {showScrollButton && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none z-20">
          <button
            type="button"
            data-testid="scroll-to-bottom-button"
            onClick={scrollToBottom}
            aria-label="Scroll to bottom"
            className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-semibold shadow-lg hover:shadow-xl transition-all cursor-pointer active:scale-95 border border-slate-700 dark:border-slate-300"
          >
            <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Scroll to bottom</span>
          </button>
        </div>
      )}
    </div>
  );
}
