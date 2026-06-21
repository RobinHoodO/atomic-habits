// Run with: npx tsx lib/home-cadence.test.ts
import assert from "node:assert";
import {
  dueFor,
  daysBetween,
  rotatingAssignee,
  fairness,
  taskIsStale,
  cadenceDays,
} from "./home-cadence";

const today = "2026-06-20";

// --- daysBetween ---
assert.equal(daysBetween("2026-06-20", "2026-06-27"), 7);
assert.equal(daysBetween("2026-06-27", "2026-06-20"), -7);

// --- dueFor ---
{
  // never done → due now
  assert.equal(dueFor("weekly", null, today).state, "due");
  // done today, weekly → upcoming in 7
  const u = dueFor("weekly", today, today);
  assert.equal(u.state, "upcoming");
  assert.equal(u.daysLeft, 7);
  assert.equal(u.dueOn, "2026-06-27");
  // done 8 days ago, weekly → overdue by 1
  const o = dueFor("weekly", "2026-06-12", today);
  assert.equal(o.state, "overdue");
  assert.equal(o.daysLeft, -1);
  // done exactly a period ago → due today
  assert.equal(dueFor("weekly", "2026-06-13", today).state, "due");
  // seasonal/adhoc → no schedule
  assert.equal(dueFor("seasonal", "2026-01-01", today).state, "none");
  assert.equal(dueFor("adhoc", null, today).state, "none");
}

// --- rotating assignee: alternates every period, deterministic ---
{
  const members = [10, 20];
  const a = rotatingAssignee(members, "weekly", "2026-01-05"); // idx 0
  const b = rotatingAssignee(members, "weekly", "2026-01-12"); // idx 1
  const c = rotatingAssignee(members, "weekly", "2026-01-19"); // idx 2 → wraps to 0
  assert.equal(a, 10);
  assert.equal(b, 20);
  assert.equal(c, 10);
}

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
