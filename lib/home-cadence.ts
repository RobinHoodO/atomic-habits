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
  { key: "seasonal", label: "Sesong", days: 0, points: 40 },
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

// When is a recurring chore next due, given its cadence and last-completed date?
// seasonal/adhoc have no automatic schedule → state "none" (handled manually).
export function dueFor(cadence: Cadence, lastDone: string | null, today = todayStr()): Due {
  const period = cadenceDays(cadence);
  if (period === 0) return { state: "none", dueOn: null, daysLeft: null };
  if (!lastDone) return { state: "due", dueOn: today, daysLeft: 0 };
  const dueOn = addDays(lastDone, period);
  const daysLeft = daysBetween(today, dueOn);
  const state: DueState = daysLeft < 0 ? "overdue" : daysLeft === 0 ? "due" : "upcoming";
  return { state, dueOn, daysLeft };
}

// For a rotating chore, whose turn is it this period? Deterministic from the
// period index so both members compute the same answer. memberIds is the stable
// (sorted) member list; anchor is any fixed past date.
export function rotatingAssignee(
  memberIds: number[],
  cadence: Cadence,
  today = todayStr(),
  anchor = "2026-01-05", // a Monday
): number | null {
  if (memberIds.length === 0) return null;
  const period = cadenceDays(cadence) || 7;
  const idx = Math.floor(Math.max(0, daysBetween(anchor, today)) / period);
  return memberIds[idx % memberIds.length];
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

// Tody-style "how due is it" signal: fraction of the cadence elapsed since last
// done. <0.7 green (fresh), 0.7–1 amber (soon), >1 red (overdue). seasonal/adhoc
// and never-done are handled by the caller; never-done counts as fully due.
export type Urgency = "fresh" | "soon" | "overdue" | "none";

export function urgency(cadence: Cadence, lastDone: string | null, today = todayStr()): Urgency {
  const period = cadenceDays(cadence);
  if (period === 0) return "none";
  if (!lastDone) return "overdue";
  const ratio = daysBetween(lastDone, today) / period;
  if (ratio > 1) return "overdue";
  if (ratio >= 0.7) return "soon";
  return "fresh";
}

// Cooperative "home health": share of scheduled chores that are NOT overdue.
// seasonal/adhoc chores are excluded (no automatic schedule). 1 = all on track.
export function homeHealth(
  items: { cadence: Cadence; lastDone: string | null }[],
  today = todayStr(),
): { score: number; onTrack: number; total: number } {
  const scheduled = items.filter((i) => cadenceDays(i.cadence) > 0);
  if (scheduled.length === 0) return { score: 1, onTrack: 0, total: 0 };
  const onTrack = scheduled.filter((i) => urgency(i.cadence, i.lastDone, today) !== "overdue").length;
  return { score: onTrack / scheduled.length, onTrack, total: scheduled.length };
}
