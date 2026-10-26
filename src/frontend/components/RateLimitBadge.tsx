import { AlertTriangle, Clock, Gauge } from "lucide-react";
import React, { useEffect, useState } from "react";
import type { RateLimitInfo } from "../types/chat-ui";

export interface RateLimitBadgeProps {
  rateLimit?: RateLimitInfo;
  isThrottled?: boolean;
  className?: string;
}

const DEFAULT_RATE_LIMIT: RateLimitInfo = {
  limit: 10,
  remaining: 10,
  resetSeconds: 60,
};

/**
 * Live Rate-Limit Badge derived from X-RateLimit-* response headers.
 * Implements Spec 05 User Story 12: rate-limit window tracking (10 req/min per IP).
 */
export function RateLimitBadge({
  rateLimit = DEFAULT_RATE_LIMIT,
  isThrottled = false,
  className = "",
}: RateLimitBadgeProps) {
  const { limit, remaining, resetSeconds } = rateLimit;
  const isBlocked = isThrottled || remaining === 0;

  const [countdown, setCountdown] = useState<number>(resetSeconds || 60);

  useEffect(() => {
    setCountdown(resetSeconds || 60);
  }, [resetSeconds, isBlocked]);

  useEffect(() => {
    if (!isBlocked) return;

    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isBlocked]);

  // Color determination:
  // green > 5, amber 1-4, red 0 (or throttled)
  let statusColor: "green" | "amber" | "red";
  if (isBlocked || remaining === 0) {
    statusColor = "red";
  } else if (remaining <= 4) {
    statusColor = "amber";
  } else {
    statusColor = "green";
  }

  const badgeStyles = {
    green:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/80 dark:bg-emerald-950/40 dark:text-emerald-300",
    amber:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-300",
    red: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/80 dark:bg-rose-950/40 dark:text-rose-300",
  }[statusColor];

  const dotStyles = {
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-rose-500",
  }[statusColor];

  const accessibleLabel = isBlocked
    ? `Rate limited. Resets in ${countdown} seconds.`
    : `Rate limit: ${remaining} of ${limit} requests remaining.`;

  return (
    <div
      role="status"
      aria-label={accessibleLabel}
      data-testid="rate-limit-badge"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shadow-2xs transition-colors ${badgeStyles} ${className}`}
      title={`Edge abuse protection: 10 requests per minute per IP (${remaining}/${limit} remaining)`}
    >
      <span
        data-status={statusColor}
        className={`h-2 w-2 rounded-full shrink-0 ${dotStyles} ${isBlocked ? "animate-pulse motion-safe:animate-pulse" : ""}`}
        aria-hidden="true"
      />
      {isBlocked ? (
        <span className="flex items-center gap-1 font-mono tabular-nums font-semibold">
          <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span>Rate Limited: Resets in {countdown}s</span>
        </span>
      ) : (
        <span className="font-mono tabular-nums">
          {remaining}/{limit} requests
        </span>
      )}
    </div>
  );
}
