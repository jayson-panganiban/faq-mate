import React from "react";
import { AlertOctagon, PhoneCall } from "lucide-react";
import { EMERGENCY_HOTLINES } from "../../constants/statutory";

export interface EmergencyBannerProps {
  code?: string;
  reason?: string;
  message?: string;
  className?: string;
}

/**
 * Life-Safety Emergency Interception Card
 * Triggered under Code of Practice (COP) for vulnerable policyholders or active perils.
 * Features prominent high-contrast warning and minimum 44px tap targets for mobile dialing.
 */
export function EmergencyBanner({
  code = "EMERGENCY_INTERCEPTION",
  reason,
  message,
  className = "",
}: EmergencyBannerProps) {
  if (code && code !== "EMERGENCY_INTERCEPTION") {
    return null;
  }

  return (
    <section
      role="alert"
      aria-label="Immediate Life-Safety Emergency Notice"
      data-testid="emergency-banner"
      className={`rounded-xl border-2 border-red-800 bg-red-700 p-5 shadow-lg text-white ${className}`}
    >
      <div className="flex items-start gap-3.5">
        <div className="rounded-full bg-red-800/90 p-2.5 text-white shrink-0 shadow-inner">
          <AlertOctagon className="h-7 w-7" aria-hidden="true" />
        </div>
        <div className="space-y-4 flex-1">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-red-800 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-red-100">
              Immediate Danger Interception
            </span>
            <h3 className="text-lg font-bold text-white mt-1">
              Immediate Life Safety Emergency
            </h3>
          </div>

          <p className="text-sm leading-relaxed text-red-50 font-medium">
            {message ||
              "If you or your property are in immediate life danger, please immediately call Triple Zero (000). Automated insurance policy search is paused during active emergencies."}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <a
              href="tel:000"
              aria-label="Call Triple Zero at 000 for immediate life-threatening emergencies"
              className="min-h-[44px] min-w-[44px] px-4 py-2.5 rounded-lg bg-white text-red-700 hover:bg-red-50 active:bg-red-100 font-bold text-sm shadow-md flex items-center justify-center gap-2 focus:outline-none focus:ring-4 focus:ring-white/60 transition-colors"
            >
              <PhoneCall className="h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
              <span>Triple Zero (000)</span>
            </a>

            <a
              href="tel:132500"
              aria-label="Call State Emergency Service on 132 500 for flood and storm assistance"
              className="min-h-[44px] min-w-[44px] px-4 py-2.5 rounded-lg bg-red-900/90 hover:bg-red-950 active:bg-black text-white font-bold text-sm shadow-md border border-red-500 flex items-center justify-center gap-2 focus:outline-none focus:ring-4 focus:ring-red-300 transition-colors"
            >
              <PhoneCall className="h-4 w-4 shrink-0 text-red-200" aria-hidden="true" />
              <span>SES (132 500)</span>
            </a>

            <a
              href="tel:1800018444"
              aria-label="Call Disaster Welfare Services on 1800 018 444 for accommodation and crisis support"
              className="min-h-[44px] min-w-[44px] px-4 py-2.5 rounded-lg bg-red-900/90 hover:bg-red-950 active:bg-black text-white font-bold text-sm shadow-md border border-red-500 flex items-center justify-center gap-2 focus:outline-none focus:ring-4 focus:ring-red-300 transition-colors"
            >
              <PhoneCall className="h-4 w-4 shrink-0 text-red-200" aria-hidden="true" />
              <span>Disaster Welfare (1800 018 444)</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
