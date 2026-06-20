// Runnable check for the scoring logic. No framework — run with:  npx tsx lib/score.test.ts
import assert from "node:assert";
import {
  currentStreak,
  consistencyScore,
  recoveryRate,
  missedTwiceActive,
  isDueToday,
  scheduledDaysBetween,
  parseSchedule,
  addDays,
} from "./score";
import { computeXp, levelForXp, earnedBadgeKeys } from "./gamify";

const today = "2026-06-20"; // a Saturday (getDay()=6)
const set = (...d: string[]) => new Set(d);

// --- daily streak: today not done yet must not break a real streak ---
{
  const done = set("2026-06-17", "2026-06-18", "2026-06-19"); // 3 days ending yesterday
  assert.equal(currentStreak("daily", done, today), 3, "streak ignores not-yet-done today");
  const done2 = set("2026-06-18", "2026-06-19", "2026-06-20");
  assert.equal(currentStreak("daily", done2, today), 3, "streak counts done today");
  const broken = set("2026-06-17", "2026-06-19"); // gap on the 18th
  assert.equal(currentStreak("daily", broken, today), 1, "gap breaks streak (only the 19th counts)");
  assert.equal(currentStreak("daily", set(), today), 0, "no completions = 0");
}

// --- consistency: a single miss does NOT zero the score (forgiving) ---
{
  // last 5 days, 4 of 5 done, today not scheduled-issue aside
  const done = set("2026-06-16", "2026-06-17", "2026-06-19", "2026-06-20"); // missed 18th
  const score = consistencyScore("daily", done, today, 5)!;
  // window = 16..20 (5 days), done 4 → 0.8
  assert.equal(Math.round(score * 100), 80, "4/5 → 0.8");
  assert.equal(consistencyScore("daily", set(), "2026-06-20", 5), 0, "none done over window = 0");
}

// --- never miss twice ---
{
  // missed both 18th and 19th (the two days before today)
  assert.equal(missedTwiceActive("daily", set("2026-06-20"), today), true, "two prior misses → active");
  assert.equal(missedTwiceActive("daily", set("2026-06-19"), today), false, "recovered yesterday → not active");
}

// --- recovery rate ---
{
  // window 13..20: all done except a miss on the 16th, recovered on the 17th.
  const done = set(
    "2026-06-13", "2026-06-14", "2026-06-15",
    "2026-06-17", "2026-06-18", "2026-06-19", "2026-06-20",
  );
  const r = recoveryRate("daily", done, today, 8)!;
  assert.equal(r, 1, "the single past miss was recovered next day → 1.0");

  // miss 18th and 19th back to back, nothing else missed → 0% recovery
  const done2 = set("2026-06-15", "2026-06-16", "2026-06-17", "2026-06-20");
  const r2 = recoveryRate("daily", done2, today, 6)!;
  // window 15..20: misses 18,19. 18's next(19) missed → not recovered.
  // 19's next is today(20, done) → recovered. So 1 of 2 = 0.5.
  assert.equal(r2, 0.5, "one of two back-to-back misses recovered → 0.5");
}

// --- weekday schedule (Mon-Fri = [1,2,3,4,5]) ---
{
  const sched = parseSchedule("[1,2,3,4,5]");
  // today is Saturday → not scheduled → not due
  assert.equal(isDueToday(sched, set(), today), false, "Saturday not in Mon-Fri schedule");
  const friday = "2026-06-19";
  assert.equal(isDueToday(sched, set(), friday), true, "Friday is due");
  const days = scheduledDaysBetween("2026-06-15", "2026-06-21", sched); // Mon..Sun
  assert.deepEqual(
    days,
    ["2026-06-15", "2026-06-16", "2026-06-17", "2026-06-18", "2026-06-19"],
    "only weekdays enumerated",
  );
}

// --- isDueToday basics ---
{
  assert.equal(isDueToday("daily", set(), today), true, "daily, not done → due");
  assert.equal(isDueToday("daily", set(today), today), false, "daily, done → not due");
}

// --- date helper sanity ---
assert.equal(addDays("2026-06-20", -1), "2026-06-19");
assert.equal(addDays("2026-03-01", -1), "2026-02-28", "month boundary");

// --- streak freeze ---
{
  const done = set("2026-06-19", "2026-06-20"); // 18th missed
  assert.equal(currentStreak("daily", done, today), 2, "no freeze: 18th breaks → streak 2");
  assert.equal(
    currentStreak("daily", done, today, set("2026-06-18")),
    3,
    "freeze on the 18th bridges → streak 3",
  );
  assert.equal(missedTwiceActive("daily", set("2026-06-20"), today), true, "18+19 missed");
  assert.equal(
    missedTwiceActive("daily", set("2026-06-20"), today, set("2026-06-19")),
    false,
    "freeze on the 19th clears missed-twice",
  );
}

// --- start-date floor: a habit created today has no prior misses ---
{
  const empty = set();
  // without a floor, the two days before today look like misses
  assert.equal(missedTwiceActive("daily", empty, today), true, "no floor → false positive");
  // floored at today (habit made today), there are no evaluable past days
  assert.equal(missedTwiceActive("daily", empty, today, set(), today), false, "floored to today → no misses");
  assert.equal(consistencyScore("daily", empty, today, 30, set(), today), null, "floored consistency → null on day one");
  assert.equal(recoveryRate("daily", empty, today, 90, today), null, "floored recovery → null on day one");
  // a floor two days back still lets a genuine double-miss register
  assert.equal(missedTwiceActive("daily", set(today), today, set(), "2026-06-18"), true, "older floor keeps real misses");
}

// --- gamify ---
assert.equal(computeXp(10, 5), 110, "10 checkins*10 + 5 streak*2 = 110");
{
  assert.equal(levelForXp(0).level, 1, "0 XP = level 1");
  assert.equal(levelForXp(100).level, 2, "100 XP = level 2");
  const l = levelForXp(150);
  assert.equal(l.level, 2);
  assert.equal(l.into, 50, "50 into level 2");
  assert.equal(l.span, 200, "level 2 span is 200");
}
{
  const keys = earnedBadgeKeys({ habitCount: 1, totalCheckins: 7, maxStreak: 7, hasRecovery: false, paired: false });
  assert.ok(keys.includes("first_habit") && keys.includes("checkin_1") && keys.includes("streak_7"), "earns first_habit/checkin_1/streak_7");
  assert.ok(!keys.includes("streak_30"), "does not earn streak_30 at 7 days");
}

console.log("✓ all score.ts + gamify checks passed");
