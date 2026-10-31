import { ArrowUp, Loader2 } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { InsurerFilterMenu } from "./InsurerFilterMenu";

export interface InputBarProps {
  onSend: (query: string, options?: { insurer?: string; turnstileToken?: string }) => void;
  isLoading: boolean;
  isThrottled: boolean;
  disabled?: boolean;
  placeholder?: string;
  turnstileSiteKey?: string;
  className?: string;
}

/**
 * Chat Input Bar — Structured Two-Row Composer.
 * A rectangular 12px-radius card with a crisp 1px border (no pill rounding):
 * the query textarea owns the full-width top row, and a dedicated toolbar row
 * beneath it hosts the insurer filter (anchored command palette on desktop,
 * native bottom sheet on mobile) plus the enclosed upward-arrow submit action.
 * Turnstile PDS verification mounts outside the card.
 */
export function InputBar({
  onSend,
  isLoading,
  isThrottled,
  disabled = false,
  placeholder = "Ask about your insurance cover…",
  turnstileSiteKey,
  className = "",
}: InputBarProps) {
  const [query, setQuery] = useState("");
  const [selectedInsurer, setSelectedInsurer] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | undefined>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);

  const hasTurnstileApi =
    typeof window !== "undefined" &&
    Boolean(
      (
        window as unknown as {
          turnstile?: {
            render: (...args: unknown[]) => unknown;
            remove?: (...args: unknown[]) => unknown;
          };
        }
      ).turnstile
    );
  const useRealTurnstile = Boolean(turnstileSiteKey && hasTurnstileApi);

  useEffect(() => {
    if (!useRealTurnstile || !turnstileSiteKey) {
      return;
    }

    let widgetId: string | undefined;
    try {
      const turnstile = (
        window as unknown as {
          turnstile: {
            render: (
              container: HTMLElement | string,
              opts: {
                sitekey: string;
                callback: (token: string) => void;
                "expired-callback"?: () => void;
              }
            ) => string;
            remove?: (id: string) => void;
          };
        }
      ).turnstile;

      widgetId = turnstile.render("#cf-turnstile-container", {
        sitekey: turnstileSiteKey,
        callback: (token: string) => {
          setTurnstileToken(token);
        },
        "expired-callback": () => {
          setTurnstileToken(undefined);
        },
      });
    } catch (err) {
      console.warn("[FAQ-Mate] Failed to initialize Cloudflare Turnstile:", err);
    }

    return () => {
      if (widgetId) {
        try {
          (
            window as unknown as { turnstile?: { remove?: (id: string) => void } }
          ).turnstile?.remove?.(widgetId);
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, [useRealTurnstile, turnstileSiteKey]);

  const isBlocked = disabled || isLoading || isThrottled;
  const isSendDisabled = isBlocked || query.trim().length === 0;

  // Auto-resize textarea to fit content up to 200px
  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, 200);
    textarea.style.height = `${nextHeight}px`;
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || typeof ResizeObserver === "undefined") return;
    let width = textarea.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const nextWidth = textarea.getBoundingClientRect().width;
      if (nextWidth !== width) {
        width = nextWidth;
        adjustHeight();
      }
    });
    observer.observe(textarea);
    return () => observer.disconnect();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuery(e.target.value);
    adjustHeight();
  };

  const handleSend = () => {
    const trimmed = query.trim();
    if (!trimmed || isSendDisabled) return;

    onSend(trimmed, {
      insurer: selectedInsurer || undefined,
      turnstileToken: turnstileToken || "cf-turnstile-verified",
    });

    setQuery("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`w-full sticky bottom-0 ${className}`}>
      <div
        data-testid="composer-field"
        className="relative rounded-xl border border-slate-200 bg-white shadow-sm focus-within:border-teal-600 dark:border-slate-800 dark:bg-slate-900"
      >
        <textarea
          ref={textareaRef}
          data-testid="chat-input-textarea"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={isBlocked}
          placeholder={placeholder}
          aria-label="Insurance policy question"
          aria-describedby="composer-hint"
          rows={1}
          className="block min-h-[56px] max-h-[min(200px,25dvh)] w-full resize-none bg-transparent px-4 pt-3 pb-2 text-base leading-7 text-slate-900 placeholder:text-slate-500 focus:outline-none disabled:opacity-50 dark:text-slate-100 dark:placeholder:text-slate-400"
        />
        <div className="flex items-center justify-between px-2 pb-2">
          <InsurerFilterMenu
            value={selectedInsurer}
            onSelect={setSelectedInsurer}
            disabled={isBlocked}
            anchorTo="container"
          />
          <button
            type="button"
            data-testid="send-button"
            onClick={handleSend}
            disabled={isSendDisabled}
            aria-label="Send message"
            className={`flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${isSendDisabled ? "cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400" : "cursor-pointer bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300"}`}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
            ) : (
              <ArrowUp className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
      <p id="composer-hint" className="sr-only">
        Enter to send. Shift+Enter for a new line.
      </p>
      {useRealTurnstile && (
        <div className="flex items-center justify-end gap-2">
          <div
            id="cf-turnstile-container"
            data-testid="turnstile-widget"
            ref={turnstileContainerRef}
          />
        </div>
      )}
    </div>
  );
}
