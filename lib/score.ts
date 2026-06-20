// Pure habit-scoring logic. No DB, no framework — fully testable.
// All dates are local "YYYY-MM-DD" strings. Schedule is 'daily' or a list of
// weekday numbers (0=Sun..6=Sat, matching Date.getDay()).

export type Schedule = "daily" | number[];

// ---- date helpers (local time, no UTC drift) ----

export function todayStr(d: Date = new Date()): string {
  return fmt(d);
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parse(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return fmt(d);
}

export function weekday(s: string): number {
  return parse(s).getDay();
}

// Later of two YYYY-MM-DD dates (string compare == chronological). `floor`
// optional so an absent floor is a no-op.
function laterOf(date: string, floor?: string): string {
  return floor && floor > date ? floor : date;
}

// ---- schedule ----

export function parseSchedule(raw: string): Schedule {
  if (!raw || raw === "daily") return "daily";
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length > 0) return arr.map(Number);
  } catch {
    /* fall through */
  }
  return "daily";
}

export function serializeSchedule(s: Schedule): string {
  return s === "daily" ? "daily" : JSON.stringify(s);
}

export function isScheduledDay(date: string, schedule: Schedule): boolean {
  return schedule === "daily" || schedule.includes(weekday(date));
}

// Inclusive list of scheduled dates between start and end.
export function scheduledDaysBetween(
  start: string,
  end: string,
  schedule: Schedule,
): string[] {
  const out: string[] = [];
  let cur = start;
  // guard against inverted ranges
  if (parse(start) > parse(end)) return out;
  while (parse(cur) <= parse(end)) {
    if (isScheduledDay(cur, schedule)) out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

function prevScheduledDay(date: string, schedule: Schedule): string {
  let cur = addDays(date, -1);
  // bound the search so a malformed schedule can't loop forever
  for (let i = 0; i < 14 && !isScheduledDay(cur, schedule); i++) {
    cur = addDays(cur, -1);
  }
  return cur;
}

// ---- metrics ----

// Consecutive scheduled days completed, counting back from today.
// Today not-yet-done does NOT break the streak (the day isn't over).
export function currentStreak(
  schedule: Schedule,
  completed: Set<string>,
  today: string,
  frozen: Set<string> = new Set(),
): number {
  const ok = (d: string) => completed.has(d) || frozen.has(d);
  let cur = today;
  while (!isScheduledDay(cur, schedule)) cur = addDays(cur, -1);
  if (cur === today && !ok(cur)) {
    cur = prevScheduledDay(cur, schedule);
  }
  let streak = 0;
  while (ok(cur)) {
    streak++;
    cur = prevScheduledDay(cur, schedule);
  }
  return streak;
}

// Forgiving consistency: completions / scheduled days over a rolling window.
// Today is only counted once done, so a not-yet-done today never lowers it.
// Returns 0..1, or null when there are no relevant scheduled days yet.
export function consistencyScore(
  schedule: Schedule,
  completed: Set<string>,
  today: string,
  windowDays = 30,
  frozen: Set<string> = new Set(),
  since?: string,
): number | null {
  const ok = (d: string) => completed.has(d) || frozen.has(d);
  const start = laterOf(addDays(today, -(windowDays - 1)), since);
  const days = scheduledDaysBetween(start, today, schedule).filter(
    (d) => d !== today || ok(d),
  );
  if (days.length === 0) return null;
  const done = days.filter(ok).length;
  return done / days.length;
}

// Of evaluable past misses, the fraction recovered on the very next scheduled day.
export function recoveryRate(
  schedule: Schedule,
  completed: Set<string>,
  today: string,
  windowDays = 90,
  since?: string,
): number | null {
  const start = laterOf(addDays(today, -(windowDays - 1)), since);
  const days = scheduledDaysBetween(start, today, schedule);
  let misses = 0;
  let recovered = 0;
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    if (d >= today || completed.has(d)) continue; // only past misses
    const next = days[i + 1];
    if (!next || next > today) continue; // no next day to judge against
    if (next === today && !completed.has(next)) continue; // today not over yet
    misses++;
    if (completed.has(next)) recovered++;
  }
  if (misses === 0) return null;
  return recovered / misses;
}

// True when the last two evaluable (past) scheduled days were both missed.
export function missedTwiceActive(
  schedule: Schedule,
  completed: Set<string>,
  today: string,
  frozen: Set<string> = new Set(),
  since?: string,
): boolean {
  const past = scheduledDaysBetween(
    laterOf(addDays(today, -60), since),
    today,
    schedule,
  ).filter((d) => d < today);
  const last2 = past.slice(-2);
  return (
    last2.length === 2 &&
    last2.every((d) => !completed.has(d) && !frozen.has(d))
  );
}

export function isDueToday(
  schedule: Schedule,
  completed: Set<string>,
  today: string,
  frozen: Set<string> = new Set(),
): boolean {
  return (
    isScheduledDay(today, schedule) &&
    !completed.has(today) &&
    !frozen.has(today)
  );
}
