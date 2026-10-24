import { ArrowUp, ChevronDown, Loader2, ShieldCheck } from "lucide-react";
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
 * Chat Input Bar with Insurer Selector, Turnstile Protection & Auto-Resizing Textarea.
 * Implements Spec 05 User Stories 2, 14, 17 and Section 3 Component Hierarchy.
 */
export function InputBar({
  onSend,
  isLoading,
  isThrottled,
  disabled = false,
  placeholder = "Ask a question about your home, contents, or motor policy (e.g., Suncorp flood cover)...",
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
      (window as unknown as { turnstile?: { render: Function; remove?: Function } }).turnstile
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

  // Auto-resize textarea to fit content up to 160px
  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, 160);
    textarea.style.height = `${nextHeight}px`;
  };

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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className={`w-full rounded-2xl border border-slate-200 bg-white p-2.5 sm:p-3 shadow-md dark:border-slate-800 dark:bg-slate-900 transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:focus-within:border-blue-500 dark:focus-within:ring-blue-500/20 ${className}`}
    >
      {/* Top Filter & Protection Toolbar */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800/80">
        <div className="flex items-center gap-1.5">
          <label
            htmlFor="insurer-select"
            className="text-xs font-medium text-slate-500 dark:text-slate-400"
          >
            Insurer:
          </label>
          <div className="relative">
            <select
              id="insurer-select"
              data-testid="insurer-select"
              aria-label="Filter by insurer"
              value={selectedInsurer}
              onChange={(e) => setSelectedInsurer(e.target.value)}
              disabled={isBlocked}
              className="appearance-none rounded-lg border border-slate-200 bg-slate-50 py-1 pl-2.5 pr-7 text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:bg-slate-100 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 cursor-pointer"
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
            <ChevronDown
              className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Cloudflare Turnstile Bot Protection Indicator */}
        {useRealTurnstile ? (
          <div
            id="cf-turnstile-container"
            data-testid="turnstile-widget"
            ref={turnstileContainerRef}
            className="flex items-center text-[11px]"
          />
        ) : (
          <div
            data-testid="turnstile-widget"
            className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400"
            title="Protected against automated scrapers by Cloudflare Turnstile"
          >
            <ShieldCheck
              className="h-3.5 w-3.5 text-amber-600 dark:text-amber-500 shrink-0"
              aria-hidden="true"
            />
            <span>Cloudflare Turnstile Verified</span>
          </div>
        )}
      </div>

      {/* Query Input & Action Row */}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          data-testid="chat-input-textarea"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={isBlocked}
          placeholder={placeholder}
          aria-label="Insurance policy question"
          rows={1}
          className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden disabled:opacity-50 dark:text-slate-100 dark:placeholder:text-slate-500"
        />

        <button
          type="button"
          data-testid="send-button"
          onClick={handleSend}
          disabled={isSendDisabled}
          aria-label="Send message"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all shadow-xs cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 ${
            isSendDisabled
              ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700 active:scale-95 dark:bg-blue-600 dark:hover:bg-blue-500"
          }`}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
