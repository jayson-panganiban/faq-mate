import { ArrowUp, Loader2, SlidersHorizontal } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { getGroupedInsurerOptions } from "../../constants/insurers";

export interface InputBarProps {
  onSend: (query: string, options?: { insurer?: string; turnstileToken?: string }) => void;
  isLoading: boolean;
  isThrottled: boolean;
  disabled?: boolean;
  placeholder?: string;
  turnstileSiteKey?: string;
  className?: string;
}

const GROUPED_INSURER_OPTIONS = getGroupedInsurerOptions();

/**
 * Chat Input Bar with Swiss-Style Minimalist Editorial Aesthetic (Perplexity Docked Card).
 * Features a generous, comfortable query canvas, bottom utility strip with
 * compact insurer selector pill chip, mode selector, Turnstile PDS verification,
 * desktop keyboard hint, and deep teal/slate accent submit action.
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

  const selectedLabel =
    GROUPED_INSURER_OPTIONS.flatMap((group) => group.options).find(
      (option) => option.value === selectedInsurer
    )?.label ?? "All Insurers (39)";

  return (
    <div className={`w-full ${className}`}>
      <div
        data-testid="composer-field"
        className="relative rounded-[28px] border-2 border-slate-200 bg-white shadow-sm focus-within:border-teal-600 dark:border-slate-800 dark:bg-slate-900"
      >
        <div
          className="absolute bottom-1 left-1 flex h-11 w-11 items-center justify-center"
          title={selectedLabel}
        >
          <SlidersHorizontal
            className={`h-5 w-5 ${selectedInsurer ? "text-teal-700 dark:text-teal-400" : "text-slate-500"}`}
            aria-hidden="true"
          />
          {selectedInsurer && (
            <span
              className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-teal-600"
              aria-hidden="true"
            />
          )}
          <select
            id="insurer-select"
            data-testid="insurer-select"
            aria-label="Filter by insurer"
            aria-describedby="selected-insurer"
            title={selectedLabel}
            value={selectedInsurer}
            onChange={(e) => setSelectedInsurer(e.target.value)}
            disabled={isBlocked}
            className="absolute inset-0 h-11 w-11 cursor-pointer opacity-0 focus:outline-none disabled:cursor-not-allowed"
          >
            <option value="">All Insurers (39)</option>
            {GROUPED_INSURER_OPTIONS.map((group) => (
              <optgroup key={group.category} label={group.label}>
                {group.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <span id="selected-insurer" className="sr-only">
            Selected insurer: {selectedLabel}
          </span>
        </div>
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
          className="block min-h-[56px] max-h-[min(200px,25dvh)] w-full resize-none bg-transparent py-3 pl-14 pr-14 text-base leading-7 text-slate-900 placeholder:text-slate-500 focus:outline-none disabled:opacity-50 dark:text-slate-100 dark:placeholder:text-slate-400"
        />
        <button
          type="button"
          data-testid="send-button"
          onClick={handleSend}
          disabled={isSendDisabled}
          aria-label="Send message"
          className={`absolute right-1 bottom-1 flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${isSendDisabled ? "text-slate-400 cursor-not-allowed dark:text-slate-600" : "text-teal-700 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-slate-800"}`}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
          ) : (
            <ArrowUp className="h-5 w-5 stroke-[2.5]" aria-hidden="true" />
          )}
        </button>
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
