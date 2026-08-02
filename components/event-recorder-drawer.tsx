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
  returnTo,
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
  returnTo?: string;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  const requestClose = () => {
    if (
      dirtyRef.current &&
      !window.confirm(
        "Discard this unsaved compliance record? Your entered information will be lost.",
      )
    )
      return;
    dirtyRef.current = false;
    setDirty(false);
    setOpen(false);
  };

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
      if (event.key === "Escape") requestClose();
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
        onClick={() => {
          dirtyRef.current = false;
          setDirty(false);
          setOpen(true);
        }}
      >
        <ClipboardPlus size={18} /> Add compliance record
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45">
          <button
            className="absolute inset-0 cursor-default"
            type="button"
            aria-label="Dismiss event recorder"
            onClick={requestClose}
          />
          <aside
            ref={drawerRef}
            className="relative h-full w-full overflow-y-auto overscroll-contain bg-slate-50 shadow-2xl sm:max-w-4xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-drawer-title"
            onInputCapture={() => {
              dirtyRef.current = true;
              setDirty(true);
            }}
            onChangeCapture={() => {
              dirtyRef.current = true;
              setDirty(true);
            }}
            onSubmitCapture={() => {
              dirtyRef.current = false;
              setDirty(false);
            }}
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
            <div className="sticky top-0 z-10 mb-4 flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50/95 p-4 backdrop-blur sm:p-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="label">Focused workflow</div>
                  {dirty && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-900">
                      Unsaved changes
                    </span>
                  )}
                </div>
                <h2
                  id="event-drawer-title"
                  className="mt-1 text-xl font-black sm:text-2xl"
                >
                  Add compliance record
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Choose what happened, enter the verified date, and save the
                  record. The cooling tower is already selected.
                </p>
              </div>
              <button
                ref={closeRef}
                className={buttonClass(
                  "secondary",
                  "size-11 shrink-0 p-0 sm:w-auto sm:px-3",
                )}
                type="button"
                aria-label="Close event recorder"
                onClick={requestClose}
              >
                <X size={18} />{" "}
                <span className="sr-only sm:not-sr-only">Close</span>
              </button>
            </div>
            <div className="px-4 pb-6 sm:px-6">
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
                returnTo={returnTo}
                onCancel={requestClose}
              />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
