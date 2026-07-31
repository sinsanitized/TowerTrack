"use client";

import { useEffect, useRef, useState } from "react";
import { ClipboardPlus, X } from "lucide-react";
import { EventRecorder } from "@/components/event-recorder";
import type {
  RegulatoryEventType,
  TowerRuleConfig,
  OpenSampleObligationForImpact,
} from "@/lib/obligation-engine";
import { buttonClass } from "@/lib/button-variants";
import type { ServiceResponsibility } from "@/lib/service-responsibility";

export function EventRecorderDrawer({
  systemId,
  defaultDate,
  ruleConfig,
  samplesAwaitingResults,
  initialSampleEventId,
  initialEventType,
  initialOpen = false,
  canConfirmOwnerManaged = false,
  openSampleObligations = [],
  legionellaResponsibility,
  legionellaVendorName,
}: {
  systemId: string;
  defaultDate: string;
  ruleConfig: TowerRuleConfig;
  samplesAwaitingResults: Array<{ id: string; date: string }>;
  initialSampleEventId?: string;
  initialEventType?: RegulatoryEventType;
  initialOpen?: boolean;
  canConfirmOwnerManaged?: boolean;
  openSampleObligations?: OpenSampleObligationForImpact[];
  legionellaResponsibility: ServiceResponsibility | null;
  legionellaVendorName?: string | null;
}) {
  const [open, setOpen] = useState(initialOpen);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (window.location.hash === "#record-event") setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        className={buttonClass("primary", "min-h-11")}
        type="button"
        onClick={() => setOpen(true)}
      >
        <ClipboardPlus size={18} /> Record an event
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45">
          <button
            className="absolute inset-0 cursor-default"
            type="button"
            aria-label="Dismiss event recorder"
            onClick={() => setOpen(false)}
          />
          <aside
            ref={drawerRef}
            className="relative h-full w-full max-w-4xl overflow-y-auto bg-slate-50 p-4 shadow-2xl sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-drawer-title"
            onKeyDown={(event) => {
              if (event.key !== "Tab") return;
              const focusable = Array.from(
                drawerRef.current?.querySelectorAll<HTMLElement>(
                  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
                ) ?? [],
              ).filter((element) => element.offsetParent !== null);
              const first = focusable.at(0);
              const last = focusable.at(-1);
              if (!first || !last) return;
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="label">Focused workflow</div>
                <h2
                  id="event-drawer-title"
                  className="mt-1 text-2xl font-black"
                >
                  Record an event
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Choose what happened, enter the verified completion date, and
                  save. The selected cooling tower is already set.
                </p>
              </div>
              <button
                ref={closeRef}
                className={buttonClass("secondary", "min-h-11 shrink-0")}
                type="button"
                aria-label="Close event recorder"
                onClick={() => setOpen(false)}
              >
                <X size={18} /> Close
              </button>
            </div>
            <EventRecorder
              key={initialSampleEventId ?? initialEventType ?? "default"}
              systemId={systemId}
              defaultDate={defaultDate}
              ruleConfig={ruleConfig}
              samplesAwaitingResults={samplesAwaitingResults}
              initialSampleEventId={initialSampleEventId}
              initialEventType={initialEventType}
              canConfirmOwnerManaged={canConfirmOwnerManaged}
              openSampleObligations={openSampleObligations}
              legionellaResponsibility={legionellaResponsibility}
              legionellaVendorName={legionellaVendorName}
              onCancel={() => setOpen(false)}
            />
          </aside>
        </div>
      )}
    </>
  );
}
