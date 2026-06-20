// Pure gamification math — no DB, fully testable. XP is DERIVED from a user's
// activity (no mutable counter to desync).

// 10 XP per check-in + 2 XP per current-streak day across habits.
export function computeXp(totalCheckins: number, streakDays: number): number {
  return totalCheckins * 10 + streakDays * 2;
}

export interface Level {
  level: number;
  into: number; // XP earned into the current level
  span: number; // XP needed to clear the current level
  toNext: number;
  pct: number; // 0..100 progress to next level
}

// Cumulative XP to *reach* level L (level 1 starts at 0): 50*(L-1)*L
// → L1:0  L2:100  L3:300  L4:600  L5:1000 …
const threshold = (l: number) => 50 * (l - 1) * l;

export function levelForXp(xp: number): Level {
  let level = 1;
  while (xp >= threshold(level + 1)) level++;
  const base = threshold(level);
  const next = threshold(level + 1);
  const span = next - base;
  const into = xp - base;
  return { level, into, span, toNext: next - xp, pct: Math.round((into / span) * 100) };
}

// ---- badges (pure predicates over a context the DB layer assembles) ----

export interface BadgeCtx {
  habitCount: number;
  totalCheckins: number;
  maxStreak: number;
  hasRecovery: boolean;
  paired: boolean;
}

export interface BadgeDef {
  key: string;
  title: string;
  emoji: string;
  desc: string;
  test: (c: BadgeCtx) => boolean;
}

export const BADGES: BadgeDef[] = [
  { key: "first_habit", title: "First Step", emoji: "🌱", desc: "Created your first habit", test: (c) => c.habitCount >= 1 },
  { key: "checkin_1", title: "Cast a Vote", emoji: "✅", desc: "Logged your first check-in", test: (c) => c.totalCheckins >= 1 },
  { key: "streak_7", title: "One Week", emoji: "🔥", desc: "Held a 7-day streak", test: (c) => c.maxStreak >= 7 },
  { key: "streak_30", title: "One Month", emoji: "🌟", desc: "Held a 30-day streak", test: (c) => c.maxStreak >= 30 },
  { key: "streak_100", title: "Centurion", emoji: "💯", desc: "Held a 100-day streak", test: (c) => c.maxStreak >= 100 },
  { key: "comeback", title: "Never Miss Twice", emoji: "↩️", desc: "Recovered the day after a miss", test: (c) => c.hasRecovery },
  { key: "paired", title: "Better Together", emoji: "🤝", desc: "Paired up on a habit", test: (c) => c.paired },
  { key: "century_checkins", title: "100 Check-ins", emoji: "🏆", desc: "Logged 100 check-ins", test: (c) => c.totalCheckins >= 100 },
];

export function earnedBadgeKeys(ctx: BadgeCtx): string[] {
  return BADGES.filter((b) => b.test(ctx)).map((b) => b.key);
}
