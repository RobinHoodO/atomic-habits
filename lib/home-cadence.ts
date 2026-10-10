// Pure household logic — cadence math, due state, rotation, fairness. No DB.
// Dates are local "YYYY-MM-DD" strings (reuses score.ts helpers).
import { addDays, todayStr } from "./score";

export type Cadence =
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "annual"
  | "seasonal"
  | "adhoc";

export const CADENCES: { key: Cadence; label: string; days: number; points: number }[] = [
  { key: "daily", label: "Daglig", days: 1, points: 5 },
  { key: "weekly", label: "Ukentlig", days: 7, points: 10 },
  { key: "biweekly", label: "Annenhver uke", days: 14, points: 12 },
  { key: "monthly", label: "Månedlig", days: 30, points: 20 },
  { key: "quarterly", label: "Kvartalsvis", days: 91, points: 35 },
  { key: "semiannual", label: "Halvårlig", days: 182, points: 50 },
  { key: "annual", label: "Årlig", days: 365, points: 60 },
  { key: "seasonal", label: "Sesong (hvert år)", days: 365, points: 40 },
  { key: "adhoc", label: "Ved behov", days: 0, points: 5 },
];

const BY_KEY = new Map(CADENCES.map((c) => [c.key, c]));

export function cadenceDays(c: Cadence): number {
  return BY_KEY.get(c)?.days ?? 7;
}
export function cadenceLabel(c: Cadence): string {
  return BY_KEY.get(c)?.label ?? c;
}
export function cadencePoints(c: Cadence): number {
  return BY_KEY.get(c)?.points ?? 10;
}

// Days between two YYYY-MM-DD dates (b - a), via the millisecond delta of the
// parsed local dates. Used only for due math, so day-resolution is enough.
export function daysBetween(a: string, b: string): number {
  const ms = new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime();
  return Math.round(ms / 86_400_000);
}

export type DueState = "overdue" | "due" | "upcoming" | "none";

export interface Due {
  state: DueState;
  dueOn: string | null; // next date it's due (null for seasonal/adhoc/never-scheduled)
  daysLeft: number | null; // negative = days overdue
}

// Fairness: each member's share of points over the window. Returns 0..1 per
// member plus a 0..1 "balance" (1 = perfectly even, 0 = one person did it all).
export function fairness(
  pointsByMember: Record<number, number>,
  memberIds: number[],
): { shares: Record<number, number>; balance: number; total: number } {
  const total = memberIds.reduce((s, id) => s + (pointsByMember[id] ?? 0), 0);
  const shares: Record<number, number> = {};
  for (const id of memberIds) shares[id] = total === 0 ? 1 / memberIds.length : (pointsByMember[id] ?? 0) / total;
  // balance = 1 - normalized spread between max and min share (2-person friendly)
  const vals = memberIds.map((id) => shares[id]);
  const spread = Math.max(...vals) - Math.min(...vals);
  return { shares, balance: 1 - spread, total };
}

// Section 9 rule: an ad-hoc task older than 2 weeks should be done this weekend.
export function taskIsStale(createdAt: string, today = todayStr()): boolean {
  const created = createdAt.slice(0, 10);
  return daysBetween(created, today) >= 14;
}

// ===== Repeat rules (map decision "Which repeat rules does a Routine need?") =====
// Etter utført: next = done + period. Faste dager: next = first matching weekday
// after max(done, dueOn), only in weeks where (weeks since anchor) % every_weeks == 0.
// Ved behov: no period and no weekdays → never on a date.
export interface RuleFields {
  cadence: Cadence;
  every_days: number | null; // "Annet" override, in days
  weekdays: string | null; // "1,4" (0 = Sun … 6 = Sat); null = Etter utført
  every_weeks: number | null; // Faste dager: every 1–4 weeks
}

const ANCHOR_MONDAY = "2026-01-05";

export function parseWeekdays(s: string | null): number[] {
  if (!s) return [];
  return [...new Set(s.split(",").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort();
}
export function periodDays(r: RuleFields): number {
  return r.every_days && r.every_days > 0 ? r.every_days : cadenceDays(r.cadence);
}
export function isVedBehov(r: RuleFields): boolean {
  return parseWeekdays(r.weekdays).length === 0 && periodDays(r) === 0;
}

function weekdayOf(d: string): number {
  return new Date(d + "T00:00:00").getDay();
}
function mondayOf(d: string): string {
  return addDays(d, -((weekdayOf(d) + 6) % 7));
}

// First date strictly after `after` on one of `days`, in an "on" week.
export function nextFixedDay(after: string, days: number[], everyWeeks = 1): string | null {
  if (days.length === 0) return null;
  const n = Math.min(4, Math.max(1, everyWeeks));
  for (let i = 1; i <= 7 * n + 7; i++) {
    const d = addDays(after, i);
    const week = Math.round(daysBetween(ANCHOR_MONDAY, mondayOf(d)) / 7);
    if (days.includes(weekdayOf(d)) && ((week % n) + n) % n === 0) return d;
  }
  return null;
}

// A new Routine is first due one round out (no wall of chores on day one).
export function firstDue(r: RuleFields, today = todayStr()): string | null {
  const days = parseWeekdays(r.weekdays);
  if (days.length) return nextFixedDay(today, days, r.every_weeks ?? 1);
  const p = periodDays(r);
  return p > 0 ? addDays(today, p) : null;
}

// The next due date after a round is closed (Gjort or Hopp over) on `today`.
// Done early on a fixed day counts for the coming date; a missed one moves on from today.
export function nextAfterRound(r: RuleFields, dueOn: string | null, today = todayStr()): string | null {
  const days = parseWeekdays(r.weekdays);
  if (days.length) {
    const from = dueOn && dueOn > today ? dueOn : today;
    return nextFixedDay(from, days, r.every_weeks ?? 1);
  }
  const p = periodDays(r);
  return p > 0 ? addDays(today, p) : null;
}

export function dueState(dueOn: string | null, today = todayStr()): Due {
  if (!dueOn) return { state: "none", dueOn: null, daysLeft: null };
  const daysLeft = daysBetween(today, dueOn);
  return { state: daysLeft < 0 ? "overdue" : daysLeft === 0 ? "due" : "upcoming", dueOn, daysLeft };
}

// Bytter på: the next round goes to whoever did NOT do the last one.
export function turnOwner(memberIds: number[], lastDoer: number | null): number | null {
  if (memberIds.length === 0) return null;
  if (lastDoer == null || !memberIds.includes(lastDoer)) return memberIds[0];
  return memberIds[(memberIds.indexOf(lastDoer) + 1) % memberIds.length];
}

// "I helgen" = the coming Saturday (today if it is already the weekend).
export function nearestWeekend(today = todayStr()): string {
  const wd = weekdayOf(today);
  return wd === 6 || wd === 0 ? today : addDays(today, 6 - wd);
}
export function isWeekend(today = todayStr()): boolean {
  const wd = weekdayOf(today);
  return wd === 6 || wd === 0;
}

const WD_SHORT = ["Sø", "Ma", "Ti", "On", "To", "Fr", "Lø"];
export const WEEKDAY_PICK: [number, string][] = [1, 2, 3, 4, 5, 6, 0].map((d) => [d, WD_SHORT[d]]);

// Human label for a Routine's repeat rule, e.g. "Ma, To · hver 2. uke" or "Hver 10. dag".
export function ruleLabel(r: RuleFields): string {
  const days = parseWeekdays(r.weekdays);
  if (days.length) {
    const list = WEEKDAY_PICK.filter(([d]) => days.includes(d)).map(([, l]) => l).join(", ");
    return (r.every_weeks ?? 1) > 1 ? `${list} · hver ${r.every_weeks}. uke` : list;
  }
  if (r.every_days && r.every_days > 0) return `Hver ${r.every_days}. dag`;
  return cadenceLabel(r.cadence);
}
