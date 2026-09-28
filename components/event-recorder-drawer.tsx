"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardPlus, X } from "lucide-react";
import { EventRecorder } from "@/components/event-recorder";
import type {
  RegulatoryEventType,
  TowerRuleConfig,
  OpenSampleObligationForImpact,
} from "@/lib/obligation-engine";
import { buttonClass } from "@/lib/button-variants";
import type { ServiceResponsibility } from "@/lib/service-responsibility";
import {
  isResampleObligation,
  type EventEntryIntentName,
} from "@/lib/event-entry-intent";

export type EventEntryContext = {
  intentType?: EventEntryIntentName;
  obligationId: string;
  obligationType: string;
  triggerEventId?: string;
  triggeringSampleId?: string;
  earliest: string | null;
  targetStart: string | null;
  targetEnd: string | null;
  latest: string | null;
};

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
  bacteriologicalResponsibility,
  legionellaVendorName,
  returnTo,
  intentContext,
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
  bacteriologicalResponsibility: ServiceResponsibility | null;
  legionellaVendorName?: string | null;
  returnTo?: string;
  intentContext?: EventEntryContext;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(initialOpen);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => setHydrated(true), []);

  const requestClose = useCallback(() => {
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
    if (initialOpen) router.replace(returnTo ?? pathname, { scroll: false });
  }, [initialOpen, pathname, returnTo, router]);

  useEffect(() => {
    if (window.location.hash === "#record-event") setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => {
      const startingField = drawerRef.current?.querySelector<HTMLElement>(
        "[data-recorder-autofocus]",
      );
      (startingField ?? closeRef.current)?.focus({ preventScroll: true });
    });
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      trigger?.focus();
    };
  }, [open, requestClose]);

  return (
    <>
      <button
        ref={triggerRef}
        className={buttonClass("primary", "min-h-11")}
        type="button"
        disabled={!hydrated}
        onClick={() => {
          dirtyRef.current = false;
          setDirty(false);
          setOpen(true);
        }}
      >
        <ClipboardPlus size={18} /> Add compliance record
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 sm:items-center sm:p-6">
          <button
            className="absolute inset-0 cursor-default"
            type="button"
            aria-label="Dismiss event recorder"
            onClick={requestClose}
          />
          <aside
            ref={drawerRef}
            className="relative flex h-full w-full flex-col overflow-hidden bg-slate-50 shadow-2xl sm:h-[min(54rem,calc(100vh-2rem))] sm:max-w-4xl sm:rounded-2xl sm:border sm:border-slate-300"
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
            <div className="z-10 flex shrink-0 items-start justify-between gap-3 border-b border-slate-300 bg-white p-4 sm:p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="label">Add a verified record</div>
                  {dirty && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-sm font-black text-amber-900">
                      Unsaved changes
                    </span>
                  )}
                </div>
                <h2 id="event-drawer-title" className="mt-1 text-xl font-black">
                  {intentContext &&
                  isResampleObligation(intentContext.obligationType)
                    ? "Record resample"
                    : "Add compliance record"}
                </h2>
                <p className="mt-1 max-w-xl text-sm text-slate-600">
                  {intentContext
                    ? "Review the deadline below, then enter the date the work actually happened."
                    : "Start with “What happened?” below. The cooling tower is already selected."}
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
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6">
              <div className="mx-auto w-full max-w-3xl">
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
                  bacteriologicalResponsibility={bacteriologicalResponsibility}
                  legionellaVendorName={legionellaVendorName}
                  returnTo={returnTo}
                  intentContext={intentContext}
                  onCancel={requestClose}
                />
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
