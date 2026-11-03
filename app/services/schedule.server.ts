import prisma from "../db.server";
import { getBusyIntervals } from "./googleCalendar.server";

/** All studio times are wall-clock times in Skopje (CET/CEST). */
export const STUDIO_TZ = "Europe/Skopje";

/** Start times offered to customers, in studio local time. */
export const WORKING_SLOTS = [
  "10:00",
  "11:15",
  "12:30",
  "14:00",
  "15:15",
  "16:30",
  "17:45",
  "19:00",
];

/** Don't offer slots starting sooner than this from now. */
const MIN_LEAD_MINUTES = 30;
/** How far ahead to search for the "next free slot" shown in the hero banner. */
const NEXT_SLOT_SEARCH_DAYS = 14;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export type Interval = { start: Date; end: Date };

export function isValidDateStr(s: unknown): s is string {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isValidTimeStr(s: unknown): s is string {
  return typeof s === "string" && TIME_RE.test(s);
}

/** Offset (ms) of the studio timezone from UTC at a given instant. */
function tzOffsetMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STUDIO_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Convert a studio-local date ("YYYY-MM-DD") + time ("HH:MM") into a UTC instant. */
export function studioTimeToUtc(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let result = guess - tzOffsetMs(new Date(guess));
  // Re-check in case the guess straddled a DST transition.
  const corrected = guess - tzOffsetMs(new Date(result));
  if (corrected !== result) result = corrected;
  return new Date(result);
}

/** Today's date in the studio timezone, as "YYYY-MM-DD". */
export function studioToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: STUDIO_TZ }).format(now);
}

/** Add whole days to a "YYYY-MM-DD" string. */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** UTC bounds of a studio-local calendar day. */
function dayBounds(dateStr: string): Interval {
  return {
    start: studioTimeToUtc(dateStr, "00:00"),
    end: studioTimeToUtc(addDays(dateStr, 1), "00:00"),
  };
}

/** Busy intervals for a range: confirmed DB appointments + Google Calendar busy blocks. */
async function getBusy(shop: string, range: Interval): Promise<Interval[]> {
  const [appointments, gcal] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        shop,
        status: { in: ["confirmed", "pending"] },
        startTime: { lt: range.end },
        endTime: { gt: range.start },
      },
      select: { startTime: true, endTime: true },
    }),
    getBusyIntervals(shop, range.start, range.end),
  ]);

  return [
    ...appointments.map((a) => ({ start: a.startTime, end: a.endTime })),
    ...gcal,
  ];
}

/**
 * Slots on a studio-local date where a treatment of `durationMin` fits
 * without overlapping any appointment or Google Calendar event.
 */
export async function getAvailableSlots(
  shop: string,
  dateStr: string,
  durationMin: number,
  now = new Date(),
): Promise<string[]> {
  const earliest = new Date(now.getTime() + MIN_LEAD_MINUTES * 60_000);
  const busy = await getBusy(shop, dayBounds(dateStr));

  return WORKING_SLOTS.filter((slot) => {
    const start = studioTimeToUtc(dateStr, slot);
    if (start < earliest) return false;
    const candidate = { start, end: new Date(start.getTime() + durationMin * 60_000) };
    return !busy.some((b) => overlaps(candidate, b));
  });
}

/** First free slot from today onward (studio time), or null if none in the search window. */
export async function findNextFreeSlot(
  shop: string,
  durationMin: number,
  now = new Date(),
): Promise<{ date: string; time: string } | null> {
  const today = studioToday(now);
  for (let i = 0; i < NEXT_SLOT_SEARCH_DAYS; i++) {
    const date = addDays(today, i);
    const slots = await getAvailableSlots(shop, date, durationMin, now);
    if (slots.length > 0) return { date, time: slots[0] };
  }
  return null;
}
