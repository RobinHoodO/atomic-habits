// Run with: npx tsx lib/home-today.test.ts
import assert from "node:assert";
import { buildToday, type TodayRoutine } from "./home-today";

const today = "2026-06-20";
const ME = 1;
const YOU = 2;
const base: TodayRoutine = {
  id: 0, title: "", cadence: "weekly", every_days: null, weekdays: null, every_weeks: null,
  assignee_user_id: null, rotating: 0, given_to: null, due: today, lastDoer: null,
};
const r = (o: Partial<TodayRoutine>): TodayRoutine => ({ ...base, ...o });

const t = buildToday(
  [
    r({ id: 1, title: "Felles due", due: today }),
    r({ id: 2, title: "Mine late", assignee_user_id: ME, due: "2026-06-18" }),
    r({ id: 3, title: "Yours", assignee_user_id: YOU }),
    r({ id: 4, title: "Given to me", assignee_user_id: YOU, given_to: ME }),
    r({ id: 5, title: "Turn: you did it last", rotating: 1, lastDoer: YOU }),
    r({ id: 6, title: "Turn: I did it last", rotating: 1, lastDoer: ME }),
    r({ id: 7, title: "In 3 days", due: "2026-06-23" }),
    r({ id: 8, title: "In 30 days", due: "2026-07-20" }),
    r({ id: 9, title: "Ved behov", cadence: "adhoc", due: null }),
  ],
  [
    { id: 10, title: "Task today", due_on: today, owner_user_id: ME, created_at: "2026-06-19" },
    { id: 11, title: "Task later", due_on: null, owner_user_id: null, created_at: "2026-06-01" },
  ],
  [ME, YOU],
  ME,
  7,
  today,
);

const ids = (xs: { id: number }[]) => xs.map((x) => x.id).sort((a, b) => a - b);
assert.deepEqual(ids(t.mine), [1, 2, 4, 5, 10], "mine = mine + Felles + given to me + my turn");
assert.deepEqual(ids(t.theirs), [3, 6]);
assert.equal(t.mine[0].id, 2, "overdue first");
assert.equal(t.mine[0].daysLate, 2);
assert.equal(t.mine.find((i) => i.id === 4)!.given, true);
assert.deepEqual(ids(t.upcoming), [7], "next 7 days only");
assert.deepEqual(ids(t.vedBehov), [9]);
assert.deepEqual(ids(t.later), [11]);

console.log("✓ all home-today checks passed");
