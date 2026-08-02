"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CalendarDays } from "lucide-react";
import {
  complianceDateInfo,
  dateOnly,
  formatComplianceDate,
  formatOperationalDate,
  todayInTimeZone,
  weekendDatesInWindow,
} from "@/lib/date";

const ComplianceTodayContext = createContext<string | null>(null);

export function ComplianceTodayProvider({ children }: { children: ReactNode }) {
  const [today, setToday] = useState(() => todayInTimeZone());
  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = todayInTimeZone();
      setToday((previous) => (previous === current ? previous : current));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <ComplianceTodayContext.Provider value={today}>
      {children}
    </ComplianceTodayContext.Provider>
  );
}

function useComplianceToday() {
  return useContext(ComplianceTodayContext) ?? todayInTimeZone();
}

export function ComplianceDate({
  value,
  label,
  deadline = false,
  compact = false,
  operational = false,
  empty = "Not generated",
}: {
  value?: string | Date | null;
  label?: string;
  deadline?: boolean;
  compact?: boolean;
  operational?: boolean;
  empty?: string;
}) {
  const today = useComplianceToday();
  if (!value)
    return (
      <div>
        {label && <div className="label">{label}</div>}
        <div className="mt-1 font-bold text-slate-600">{empty}</div>
      </div>
    );
  const info = complianceDateInfo(value, today);
  return (
    <div
      className={
        info.weekend && !compact
          ? "rounded-lg border border-slate-300 bg-slate-100 p-3"
          : undefined
      }
    >
      {label && <div className="label">{label}</div>}
      <time className="mt-1 block font-black" dateTime={info.date}>
        {operational ? formatOperationalDate(info.date) : info.formatted}
      </time>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        <span className="font-bold text-slate-600">{info.relative}</span>
        {deadline && !compact && (
          <>
            <span className="text-slate-500">
              {Math.abs(info.calendarDays)} calendar day
              {Math.abs(info.calendarDays) === 1 ? "" : "s"}
              {info.calendarDays < 0 ? " overdue" : " remaining"}
            </span>
            <span className="font-black text-emerald-900">
              {Math.abs(info.workingDays)} working day
              {Math.abs(info.workingDays) === 1 ? "" : "s"}
              {info.workingDays < 0 ? " overdue" : " remaining"}
            </span>
          </>
        )}
        {info.weekend && (
          <span className="font-black text-slate-700">Weekend</span>
        )}
      </div>
      {deadline && !compact && info.weekendRisk && (
        <div className="mt-2 flex items-start gap-2 rounded-md bg-amber-100 p-2 text-xs font-bold text-amber-950">
          <AlertTriangle className="mt-0.5 shrink-0" size={14} />
          <span>
            {info.weekendRisk.label}. Last normal workday:{" "}
            {formatComplianceDate(info.weekendRisk.lastWorkingDay)}. The
            compliance deadline does not move.
          </span>
        </div>
      )}
    </div>
  );
}

export function ComplianceWindow({
  start,
  end,
  label = "Recommended dates to perform this action",
  compact = false,
  operational = false,
}: {
  start?: string | Date | null;
  end?: string | Date | null;
  label?: string;
  compact?: boolean;
  operational?: boolean;
}) {
  if (!start && !end)
    return (
      <div>
        <div className="label">{label}</div>
        <div className="mt-1 font-bold text-slate-600">No fixed date range</div>
      </div>
    );
  const startDate = start ? dateOnly(start) : dateOnly(end as string | Date);
  const endDate = end ? dateOnly(end) : startDate;
  if (compact)
    return (
      <div>
        <div className="label">{label}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1 text-sm font-bold text-slate-600">
          <time dateTime={startDate}>
            {operational
              ? formatOperationalDate(startDate)
              : formatComplianceDate(startDate)}
          </time>
          <span aria-hidden>→</span>
          <time dateTime={endDate}>
            {operational
              ? formatOperationalDate(endDate)
              : formatComplianceDate(endDate)}
          </time>
        </div>
      </div>
    );
  const weekends = weekendDatesInWindow(startDate, endDate);
  return (
    <div>
      <div className="label">{label}</div>
      <div className="mt-2 grid gap-1 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div>
          <div className="text-xs font-bold text-slate-500">
            Earliest valid date
          </div>
          <time className="font-black" dateTime={startDate}>
            {operational
              ? formatOperationalDate(startDate)
              : formatComplianceDate(startDate)}
          </time>
        </div>
        <div className="hidden text-slate-400 sm:block">→</div>
        <div>
          <div className="text-xs font-bold text-slate-500">
            Last valid date
          </div>
          <time className="font-black" dateTime={endDate}>
            {operational
              ? formatOperationalDate(endDate)
              : formatComplianceDate(endDate)}
          </time>
        </div>
      </div>
      {weekends.length > 0 && (
        <div className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-600">
          <CalendarDays size={14} />
          {weekends.length} weekend date{weekends.length === 1 ? "" : "s"}{" "}
          inside this window
        </div>
      )}
    </div>
  );
}
