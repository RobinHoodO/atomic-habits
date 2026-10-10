// Run with: npx tsx lib/home-cadence.test.ts
import assert from "node:assert";
import {
  daysBetween,
  turnOwner,
  firstDue,
  nextAfterRound,
  nextFixedDay,
  dueState,
  isVedBehov,
  nearestWeekend,
  fairness,
  taskIsStale,
  cadenceDays,
} from "./home-cadence";

const today = "2026-06-20";

// --- daysBetween ---
assert.equal(daysBetween("2026-06-20", "2026-06-27"), 7);
assert.equal(daysBetween("2026-06-27", "2026-06-20"), -7);

// --- Bytter på: next turn = whoever did not do the last round ---
{
  assert.equal(turnOwner([10, 20], 10), 20);
  assert.equal(turnOwner([10, 20], 20), 10);
  assert.equal(turnOwner([10, 20], null), 10, "never done → first member");
  assert.equal(turnOwner([], 10), null);
}

// --- repeat rules (2026-06-20 is a Saturday) ---
{
  const after = { cadence: "weekly" as const, every_days: null, weekdays: null, every_weeks: null };
  assert.equal(firstDue(after, today), "2026-06-27", "new Routine: one round out");
  assert.equal(nextAfterRound(after, "2026-06-15", today), "2026-06-27", "Etter utført counts from done day");
  assert.equal(firstDue({ ...after, every_days: 10 }, today), "2026-06-30", "Annet overrides cadence");
  const vb = { ...after, cadence: "adhoc" as const };
  assert.equal(isVedBehov(vb), true);
  assert.equal(firstDue(vb, today), null, "Ved behov has no date");

  // Faste dager: Mon (1) + Thu (4)
  const fixed = { ...after, weekdays: "1,4", every_weeks: 1 };
  assert.equal(nextFixedDay("2026-06-20", [1, 4]), "2026-06-22", "Sat → next Mon");
  assert.equal(nextFixedDay("2026-06-22", [1, 4]), "2026-06-25", "Mon → Thu");
  assert.equal(nextAfterRound(fixed, "2026-06-15", today), "2026-06-22", "missed: next match after today");
  assert.equal(nextAfterRound(fixed, "2026-06-25", "2026-06-23"), "2026-06-29", "done early: counts for the coming date");
  // every 2 weeks: anchor week of 2026-01-05 is "on"; 2026-06-22 is 24 weeks later → on
  assert.equal(nextFixedDay("2026-06-20", [1], 2), "2026-06-22");
  assert.equal(nextFixedDay("2026-06-22", [1], 2), "2026-07-06", "skips the off week");
}

// --- due state from a stored date ---
assert.equal(dueState("2026-06-19", today).state, "overdue");
assert.equal(dueState(today, today).state, "due");
assert.equal(dueState("2026-06-21", today).daysLeft, 1);
assert.equal(dueState(null, today).state, "none");

// --- "I helgen" ---
assert.equal(nearestWeekend("2026-06-17"), "2026-06-20", "Wed → Sat");
assert.equal(nearestWeekend("2026-06-21"), "2026-06-21", "Sun stays Sun");

// --- fairness ---
{
  const f = fairness({ 1: 50, 2: 50 }, [1, 2]);
  assert.equal(f.total, 100);
  assert.equal(Math.round(f.shares[1] * 100), 50);
  assert.equal(f.balance, 1, "even split → balance 1");
  const skew = fairness({ 1: 80, 2: 20 }, [1, 2]);
  assert.equal(Math.round(skew.balance * 100), 40, "80/20 → balance 0.4");
  const empty = fairness({}, [1, 2]);
  assert.equal(empty.balance, 1, "no work yet → treated as even");
  assert.equal(Math.round(empty.shares[1] * 100), 50);
}

// --- stale task (2-week rule) ---
assert.equal(taskIsStale("2026-06-06 10:00:00", today), true, "14 days → stale");
assert.equal(taskIsStale("2026-06-10", today), false, "10 days → not stale");

// --- cadence days sanity ---
assert.equal(cadenceDays("daily"), 1);
assert.equal(cadenceDays("annual"), 365);

console.log("✓ all home-cadence checks passed");
