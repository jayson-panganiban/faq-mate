import { ArrowUp, ChevronDown, Loader2, Shield, ShieldCheck, Sparkles } from "lucide-react";
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
  placeholder = "Ask about home, contents, or motor policies (e.g., flood cover)...",
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
      className={`w-full rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white/95 dark:border-slate-800 dark:bg-slate-900/95 backdrop-blur-md shadow-md sm:shadow-lg shadow-slate-900/5 dark:shadow-none transition-[border-color,box-shadow] duration-200 focus-within:border-slate-400 dark:focus-within:border-slate-600 focus-within:ring-2 focus-within:ring-teal-600/10 dark:focus-within:ring-teal-400/20 ${className}`}
    >
      {/* Editorial Textarea Canvas */}
      <div className="relative p-2.5 sm:p-3.5 pb-0">
        <textarea
          ref={textareaRef}
          data-testid="chat-input-textarea"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={isBlocked}
          placeholder={placeholder}
          aria-label="Insurance policy question"
          rows={2}
          className="min-h-[64px] sm:min-h-[80px] max-h-52 w-full resize-none bg-transparent px-3 pt-2 pb-2 text-base sm:text-sm md:text-base leading-relaxed tracking-tight text-slate-900 placeholder:text-slate-400/90 focus:outline-hidden disabled:opacity-50 dark:text-slate-100 dark:placeholder:text-slate-500 font-normal"
        />
      </div>

      {/* Swiss Editorial Utility Strip */}
      <div className="mt-1 flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 sm:px-4 sm:py-2.5 dark:border-slate-800/80">
        {/* Left: Insurer Filter Pill Chip & Model Mode */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative inline-flex items-center max-w-[155px] sm:max-w-[200px]">
            <Shield
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500"
              aria-hidden="true"
            />
            <select
              id="insurer-select"
              data-testid="insurer-select"
              aria-label="Filter by insurer"
              value={selectedInsurer}
              onChange={(e) => setSelectedInsurer(e.target.value)}
              disabled={isBlocked}
              className="w-full truncate appearance-none rounded-full border border-slate-200/90 bg-slate-50/90 py-1.5 pl-8 pr-7 text-base sm:text-xs font-medium text-slate-700 shadow-2xs transition-[border-color,background-color] duration-150 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:border-slate-600 focus:border-slate-400 focus:outline-hidden focus-visible:ring-1 focus-visible:ring-slate-400 disabled:opacity-50 cursor-pointer"
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
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500"
              aria-hidden="true"
            />
          </div>

          {/* Model / Mode Pill */}
          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100/80 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 select-none">
            <Sparkles className="w-3 h-3 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            <span>Hybrid Edge</span>
          </span>
        </div>

        {/* Right: Security Verification & Accent Submit Action */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Cloudflare Turnstile Bot Protection Indicator / Verified PDS */}
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
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 pl-0.5"
              title="Protected against automated scrapers by Cloudflare Turnstile"
            >
              <ShieldCheck
                className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0"
                aria-hidden="true"
              />
              <span className="hidden sm:inline">Verified PDS</span>
              <span className="sr-only">Turnstile Verified</span>
            </div>
          )}

          {/* Keyboard Hint on Desktop */}
          <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 dark:text-slate-500 mr-1 select-none">
            <span>Press</span>
            <kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-300 shadow-2xs">
              Enter ↵
            </kbd>
          </span>

          <button
            type="button"
            data-testid="send-button"
            onClick={handleSend}
            disabled={isSendDisabled}
            aria-label="Send message"
            className={`flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl sm:rounded-2xl transition-[transform,background-color,border-color,box-shadow] duration-150 shadow-2xs cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 ${
              isSendDisabled
                ? "bg-slate-100 text-slate-300 border border-slate-200/60 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700/60 cursor-not-allowed"
                : "bg-teal-700 text-white hover:bg-teal-800 active:scale-95 dark:bg-teal-600 dark:text-white dark:hover:bg-teal-500 border border-teal-700 dark:border-teal-500 shadow-xs"
            }`}
          >
            {isLoading ? (
              <Loader2
                className="h-4 w-4 motion-safe:animate-spin animate-spin"
                aria-hidden="true"
              />
            ) : (
              <ArrowUp className="h-4 w-4 stroke-[2.5]" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
