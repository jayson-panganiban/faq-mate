import { Lock, ShieldCheck, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

export interface PiiAssuranceBadgeProps {
  className?: string;
  defaultExpanded?: boolean;
}

/**
 * Client-Side PII Assurance Badge (Spec 05 User Story 13).
 * Assures users of compliance with Australian Privacy Principles (APP 3 & 11)
 * covering client-side sanitization of TFNs, Medicare numbers, and payment cards
 * before edge ingress, plus daily-salted zero raw query persistence.
 */
export function PiiAssuranceBadge({
  className = "",
  defaultExpanded = false,
}: PiiAssuranceBadgeProps) {
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    } else if (e.key === "Escape" && isOpen) {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <div
      data-testid="pii-assurance-badge"
      className={`relative block sm:contents text-xs ${className}`}
    >
      <button
        ref={triggerRef}
        type="button"
        data-testid="pii-assurance-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="Your privacy"
        className="sm:col-start-2 sm:row-start-1 inline-flex items-center gap-1.5 min-h-[44px] px-2.5 py-1 rounded-full border border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100 hover:border-teal-300 dark:border-teal-800/80 dark:bg-teal-950/40 dark:text-teal-300 dark:hover:bg-teal-900/60 transition-[color,background-color,border-color,box-shadow] duration-150 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500 cursor-pointer shadow-2xs"
      >
        <ShieldCheck
          className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0"
          aria-hidden="true"
        />
        <span className="font-medium">Your privacy</span>
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Privacy details"
          data-testid="pii-assurance-popover"
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          className="sm:col-span-2 sm:row-start-2 mt-2 w-full rounded-xl border border-slate-200 bg-white p-3.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100">
              <Lock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              <span>Your privacy</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close privacy protection details"
              className="rounded-md min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-[color,background-color] duration-150 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-2.5 space-y-2 text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
            <p>
              Tax File Numbers, Medicare numbers and payment card numbers are removed in your
              browser before your question is sent.
            </p>
            <p>
              Raw questions are not stored in our analytics database. Your conversation is kept in
              this browser session.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
