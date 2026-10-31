import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "./components/AppShell";
import { ChatContainer } from "./components/ChatContainer";
import { CitationDrawer } from "./components/CitationDrawer";
import { InputBar } from "./components/InputBar";
import { PolicyComparisonView } from "./components/PolicyComparisonView";
import { useChatStream } from "./hooks/useChatStream";
import type { ChatMessage, GroundedChunk } from "./types/chat-ui";
import { findMatchingChunk } from "./utils/citations";
import { sanitizeClientPii } from "./utils/client-pii-scrubber";

const STORAGE_KEY = "faq_mate_chat_session";

/**
 * Safely load persisted messages from browser sessionStorage.
 * Includes defensive fallback when sessionStorage is restricted or unavailable.
 */
function loadPersistedMessages(): ChatMessage[] {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) {
      return [];
    }
    const item = window.sessionStorage.getItem(STORAGE_KEY);
    if (!item) return [];
    const parsed = JSON.parse(item);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("[FAQ-Mate] Failed to restore sessionStorage session:", e);
    return [];
  }
}

/**
 * Safely persist message history to sessionStorage.
 */
function persistMessages(messages: ChatMessage[]): void {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return;
    if (messages.length > 0) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch (e) {
    console.warn("[FAQ-Mate] Failed to persist messages to sessionStorage:", e);
  }
}

/**
 * Safely clear persisted messages in sessionStorage.
 */
function clearPersistedMessages(): void {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return;
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Safe fallback
  }
}

/**
 * Main Application Component for FAQ-Mate Edge RAG
 * Implements Spec 05 full assembly wiring useChatStream, AppShell, ChatContainer, InputBar, and CitationDrawer.
 */
export function App() {
  const [initialMessages] = useState<ChatMessage[]>(() => loadPersistedMessages());

  const {
    messages,
    status,
    rateLimit,
    telemetry,
    citations,
    setSelectedCitation,
    sendMessage,
    reset,
    deleteTurn,
    clearHistory,
    undoHistoryDeletion,
    canUndoHistoryDeletion,
  } = useChatStream({ initialMessages });

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedChunkId, setSelectedChunkId] = useState<string | undefined>(undefined);
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [historySelection, setHistorySelection] = useState<{ id: string; sequence: number }>();

  // Sync message updates to sessionStorage
  useEffect(() => {
    persistMessages(messages);
  }, [messages]);

  // Aggregate all grounded chunks across active citations and historical message metadata
  const allChunks = useMemo(() => {
    const chunkMap = new Map<string, GroundedChunk>();
    for (const c of citations) {
      chunkMap.set(c.id, c);
    }
    for (const msg of messages) {
      if (msg.metadata?.retrievedChunks) {
        for (const c of msg.metadata.retrievedChunks) {
          if (!chunkMap.has(c.id)) {
            chunkMap.set(c.id, c);
          }
        }
      }
    }
    return Array.from(chunkMap.values());
  }, [citations, messages]);

  // Handle citation selection (from inline pills or starter prompts)
  const handleSelectCitation = useCallback(
    (chunkOrText: GroundedChunk | string) => {
      if (typeof chunkOrText === "object" && chunkOrText !== null) {
        setSelectedChunkId(chunkOrText.id);
        setSelectedCitation(chunkOrText);
        setIsDrawerOpen(true);
        return;
      }

      // If a string citation was passed, find matching chunk by id or section name
      const matched = findMatchingChunk(String(chunkOrText), allChunks);

      if (matched) {
        setSelectedChunkId(matched.id);
        setSelectedCitation(matched);
      } else {
        setSelectedChunkId(typeof chunkOrText === "string" ? chunkOrText : undefined);
      }
      setIsDrawerOpen(true);
    },
    [allChunks, setSelectedCitation]
  );

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const handleSelectDrawerChunk = useCallback(
    (id: string) => {
      setSelectedChunkId(id);
      const chunk = allChunks.find((c) => c.id === id) || null;
      setSelectedCitation(chunk);
    },
    [allChunks, setSelectedCitation]
  );

  const handleReset = useCallback(() => {
    reset();
    clearPersistedMessages();
    setIsDrawerOpen(false);
    setSelectedChunkId(undefined);
    setIsComparisonMode(false);
  }, [reset]);

  const handleSend = useCallback(
    (query: string, options?: { insurer?: string; turnstileToken?: string }) => {
      sendMessage(query, options);
    },
    [sendMessage]
  );

  const handleSelectStarterQuery = useCallback(
    (query: string, insurer?: string) => {
      sendMessage(query, { insurer });
    },
    [sendMessage]
  );

  const isLoading =
    status === "CONNECTING" || status === "METADATA_RECEIVED" || status === "STREAMING";
  const isThrottled = status === "THROTTLED" || rateLimit.remaining <= 0;

  return (
    <AppShell
      telemetry={telemetry}
      rateLimit={rateLimit}
      isThrottled={isThrottled}
      isComparisonMode={isComparisonMode}
      onToggleComparison={() => setIsComparisonMode((prev) => !prev)}
      onReset={handleReset}
      historyItems={messages
        .filter((m) => m.role === "user")
        .map((m) => ({ id: m.id, label: sanitizeClientPii(m.content).sanitized }))}
      onDeleteHistory={(id) => {
        deleteTurn(id);
        setIsDrawerOpen(false);
        setSelectedChunkId(undefined);
        setHistorySelection(undefined);
      }}
      onClearHistory={() => {
        clearHistory();
        setIsDrawerOpen(false);
        setSelectedChunkId(undefined);
        setHistorySelection(undefined);
      }}
      onUndoHistoryDeletion={undoHistoryDeletion}
      canUndoHistoryDeletion={canUndoHistoryDeletion}
      onSelectHistory={(id) => {
        setIsComparisonMode(false);
        setHistorySelection((previous) => ({ id, sequence: (previous?.sequence ?? 0) + 1 }));
      }}
    >
      {isComparisonMode && (
        <PolicyComparisonView
          chunks={allChunks}
          onSelectCitation={handleSelectCitation}
          onSelectQuery={(q, ins) => {
            setIsComparisonMode(false);
            handleSelectStarterQuery(q, ins);
          }}
          onClose={() => setIsComparisonMode(false)}
        />
      )}
      <div
        className={`${isComparisonMode ? "hidden" : "flex"} flex-1 flex-col min-h-0 overflow-hidden w-full max-w-full`}
      >
        {/* Chat Feed & Empty State Prompts */}
        <ChatContainer
          messages={messages}
          scrollToMessage={historySelection}
          status={status}
          citations={allChunks.length > 0 ? allChunks : citations}
          onSelectCitation={handleSelectCitation}
          onSelectStarterQuery={handleSelectStarterQuery}
        />

        {/* User Input Bar & Insurer Filter */}
        <div className="lg:pt-3.5 shrink-0 bg-transparent">
          <InputBar
            onSend={handleSend}
            isLoading={isLoading}
            isThrottled={isThrottled}
            disabled={isThrottled}
          />
        </div>
      </div>

      {/* Slide-over Grounding Inspector Drawer */}
      <CitationDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        chunks={allChunks}
        selectedChunkId={selectedChunkId}
        onSelectChunk={handleSelectDrawerChunk}
      />
    </AppShell>
  );
}
export default App;
