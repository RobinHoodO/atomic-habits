import {
  parseSchedule,
  currentStreak,
  consistencyScore,
  recoveryRate,
  missedTwiceActive,
  isDueToday,
} from "./score";

export interface HabitStats {
  streak: number;
  consistency: number | null;
  recovery: number | null;
  missedTwice: boolean;
  due: boolean;
  totalVotes: number;
}

// Pure stats for one habit from already-loaded rows (shared by statsFor and statsForMany).
export function computeStats(
  scheduleRaw: string,
  done: Set<string>,
  frozen: Set<string>,
  since: string,
  today: string,
): HabitStats {
  const schedule = parseSchedule(scheduleRaw);
  return {
    streak: currentStreak(schedule, done, today, frozen),
    consistency: consistencyScore(schedule, done, today, 30, frozen, since),
    recovery: recoveryRate(schedule, done, today, 90, since),
    missedTwice: missedTwiceActive(schedule, done, today, frozen, since),
    due: isDueToday(schedule, done, today, frozen),
    totalVotes: done.size,
  };
}

// Group rows of { key, date } into a Set of dates per key.
export function groupDates<K extends string | number>(
  rows: { key: K; date: string }[],
): Map<K, Set<string>> {
  const out = new Map<K, Set<string>>();
  for (const r of rows) {
    const s = out.get(r.key) ?? new Set<string>();
    s.add(r.date);
    out.set(r.key, s);
  }
  return out;
}

// The date a habit counts from: its creation day, never in the future.
export function startDate(createdAt: string | undefined, today: string): string {
  const start = (createdAt ?? today).slice(0, 10);
  return start > today ? today : start;
}
