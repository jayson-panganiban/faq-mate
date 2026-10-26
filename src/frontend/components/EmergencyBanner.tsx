import { AlertOctagon, PhoneCall } from "lucide-react";
import React from "react";
import { EMERGENCY_HOTLINES, EMERGENCY_REFUSAL_MESSAGE } from "../../constants/statutory";

export interface EmergencyBannerProps {
  code?: string;
  reason?: string;
  message?: string;
  className?: string;
}

interface HotlineConfig {
  id: string;
  tel: string;
  name: string;
  label: string;
  primary: boolean;
}

const HOTLINES: HotlineConfig[] = [
  {
    id: "000",
    tel: "tel:000",
    name: "Call Triple Zero (000)",
    label: `Call ${EMERGENCY_HOTLINES.lifeThreat} for immediate life-threatening emergencies`,
    primary: true,
  },
  {
    id: "132500",
    tel: "tel:132500",
    name: "Call SES 132 500",
    label: `Call ${EMERGENCY_HOTLINES.ses} for flood and storm assistance`,
    primary: false,
  },
  {
    id: "1800018444",
    tel: "tel:1800018444",
    name: "Call Disaster Welfare 1800 018 444",
    label: `Call ${EMERGENCY_HOTLINES.disasterWelfare} for emergency accommodation and crisis support`,
    primary: false,
  },
];

/**
 * Life-Safety Emergency Interception Card
 * Triggered under Code of Practice (COP) for vulnerable policyholders or active perils.
 * Features prominent high-contrast warning and minimum 44px tap targets for mobile dialing.
 */
export function EmergencyBanner({
  code = "EMERGENCY_INTERCEPTION",
  reason: _reason,
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
            <h3 className="text-lg font-bold text-white mt-1">Immediate Life Safety Emergency</h3>
          </div>

          <p className="text-sm leading-relaxed text-red-50 font-medium whitespace-pre-line">
            {message || EMERGENCY_REFUSAL_MESSAGE}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            {HOTLINES.map((hotline) => (
              <a
                key={hotline.id}
                href={hotline.tel}
                aria-label={hotline.label}
                className={`min-h-[44px] min-w-[44px] px-4 py-2.5 rounded-lg font-bold text-sm shadow-md flex items-center justify-center gap-2 focus:outline-hidden focus-visible:ring-4 focus-visible:ring-white transition-[background-color,transform,box-shadow] duration-150 active:scale-[0.98] ${
                  hotline.primary
                    ? "bg-white text-red-700 hover:bg-red-50 active:bg-red-100"
                    : "bg-red-900/90 hover:bg-red-950 active:bg-black text-white border border-red-500"
                }`}
              >
                <PhoneCall
                  className={`h-4 w-4 shrink-0 ${
                    hotline.primary ? "text-red-700" : "text-red-200"
                  }`}
                  aria-hidden="true"
                />
                <span>{hotline.name}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
