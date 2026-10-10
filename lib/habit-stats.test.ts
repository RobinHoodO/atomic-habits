// Runnable check for the batched habit stats. Run with:  npx tsx lib/habit-stats.test.ts
import assert from "node:assert";
import { computeStats, groupDates, startDate } from "./habit-stats";
import { currentStreak } from "./score";

const today = "2026-06-20";
const set = (...d: string[]) => new Set(d);

// groupDates: one Set per key, duplicates collapse
{
  const g = groupDates([
    { key: 1, date: "2026-06-19" },
    { key: 2, date: "2026-06-18" },
    { key: 1, date: "2026-06-20" },
    { key: 1, date: "2026-06-20" },
  ]);
  assert.deepEqual([...(g.get(1) ?? [])].sort(), ["2026-06-19", "2026-06-20"]);
  assert.deepEqual([...(g.get(2) ?? [])], ["2026-06-18"]);
  assert.equal(g.get(99 as 1), undefined);
}

// startDate: creation day, trimmed, never in the future, defaults to today
{
  assert.equal(startDate("2026-06-01 10:00:00", today), "2026-06-01");
  assert.equal(startDate("2026-07-01", today), today);
  assert.equal(startDate(undefined, today), today);
}

// computeStats matches the primitives it wraps
{
  const done = set("2026-06-18", "2026-06-19", "2026-06-20");
  const s = computeStats("daily", done, set(), "2026-06-01", today);
  assert.equal(s.streak, currentStreak("daily", done, today, set()));
  assert.equal(s.streak, 3);
  assert.equal(s.totalVotes, 3);
  assert.equal(s.due, false, "done today means not due");
}

// a freeze keeps the streak alive across a gap; without it the streak breaks
{
  const done = set("2026-06-17", "2026-06-19", "2026-06-20");
  const without = computeStats("daily", done, set(), "2026-06-01", today);
  const withFreeze = computeStats("daily", done, set("2026-06-18"), "2026-06-01", today);
  assert.equal(without.streak, 2);
  assert.equal(withFreeze.streak, 4);
}

// two habits grouped from one batch stay independent
{
  const comps = groupDates([
    { key: 1, date: "2026-06-19" },
    { key: 1, date: "2026-06-20" },
    { key: 2, date: "2026-06-10" },
  ]);
  const a = computeStats("daily", comps.get(1) ?? set(), set(), "2026-06-01", today);
  const b = computeStats("daily", comps.get(2) ?? set(), set(), "2026-06-01", today);
  assert.equal(a.streak, 2);
  assert.equal(b.streak, 0);
  assert.equal(b.due, true);
}

console.log("habit-stats ok");
