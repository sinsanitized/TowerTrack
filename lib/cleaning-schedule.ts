import { addDays, asUtc, dateOnly, diffDays } from "@/lib/date";

export function defaultCleaningDate(addDate: string) {
  return addDays(addDate, 1);
}

export function cleaningGapMessage(addDate: string, cleaningDate: string) {
  const gap = diffDays(addDate, cleaningDate);
  if (gap < 0)
    return "Cleaning is scheduled before chemicals are added. Review both dates before saving.";
  if (gap === 0)
    return "Chemical addition and cleaning are on the same date. Confirm there is enough circulation time before cleaning.";
  if (gap > 2)
    return `Cleaning is ${gap} days after chemical addition. This may be intentional; confirm the timing before saving.`;
  return null;
}

export function shiftCleaningDate(
  originalAddDate: string,
  newAddDate: string,
  originalCleaningDate: string,
) {
  return addDays(originalCleaningDate, diffDays(originalAddDate, newAddDate));
}

export function calendarMonthBounds(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Invalid calendar month.");
  const start = `${month}-01`;
  const value = asUtc(start);
  const next = new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 1),
  );
  return { start, endExclusive: dateOnly(next) };
}

export function calendarGridBounds(month: string) {
  const { start, endExclusive } = calendarMonthBounds(month);
  const firstDay = asUtc(start).getUTCDay();
  const lastDay = asUtc(endExclusive).getUTCDay();
  return {
    start: addDays(start, -firstDay),
    endExclusive: addDays(endExclusive, lastDay === 0 ? 0 : 7 - lastDay),
  };
}
