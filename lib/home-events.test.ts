// Pure Varsler / "Ny" rules. Run with: npx tsx lib/home-events.test.ts
import assert from "node:assert";
import { parseWho, matchesWho } from "./home-who";
import { unreadThreshold, isFresh, unreadEvents, dbStamp, whenLabel, eventText, type HomeEvent } from "./home-events";

const now = Date.UTC(2026, 9, 10, 12, 0, 0);
assert.equal(dbStamp(now), "2026-10-10 12:00:00");
assert.equal(unreadThreshold(null, now), "2026-09-26 12:00:00", "never seen: last 14 days");
assert.equal(unreadThreshold("2026-10-09 08:00:00", now), "2026-10-09 08:00:00", "seen: since then");

assert.equal(isFresh(2, "2026-10-10 09:00:00", 1, "2026-10-09 08:00:00"), true);
assert.equal(isFresh(1, "2026-10-10 09:00:00", 1, "2026-10-09 08:00:00"), false, "my own is never new");
assert.equal(isFresh(2, "2026-10-09 07:00:00", 1, "2026-10-09 08:00:00"), false, "before I looked");
assert.equal(isFresh(null, "2026-10-10 09:00:00", 1, "2026-10-09 08:00:00"), false, "seeded rows (no creator)");

const ev = (id: number, actor: number, at: string, kind: HomeEvent["kind"] = "chore_added", target: number | null = null): HomeEvent => ({
  id, home_id: 1, actor_id: actor, kind, title: "Støvsuge", target_user_id: target, ref_kind: "routine", ref_id: 5, created_at: at,
});
const list = [ev(1, 2, "2026-10-10 10:00:00"), ev(2, 1, "2026-10-10 10:05:00"), ev(3, 2, "2026-10-01 10:00:00")];
assert.deepEqual(unreadEvents(list, 1, "2026-10-09 00:00:00").map((e) => e.id), [1]);

assert.equal(whenLabel("2026-10-10 12:05:00", now), "i dag 14:05", "UTC 12:05 is 14:05 in Oslo (CEST)");
assert.equal(whenLabel("2026-10-09 12:05:00", now), "i går 14:05");
assert.equal(eventText(ev(1, 2, "x", "chore_given", 1), "Ania", 1), "Ania ga deg «Støvsuge»");
assert.equal(eventText(ev(1, 2, "x"), "Ania", 1), "Ania la til rutine «Støvsuge»");

// --- Hvem filter ---
assert.equal(parseWho(undefined, [1, 2], 1, true), "all");
assert.equal(parseWho("2", [1, 2], 1, true), 2);
assert.equal(parseWho("1", [1, 2], 1, true), "me", "my own id is Meg");
assert.equal(parseWho("99", [1, 2], 1, true), "all", "not in this home");
assert.equal(parseWho("turns", [1, 2], 1, false), "all", "Oppgaver has no Bytter på");
assert.equal(parseWho("x; drop", [1, 2], 1, true), "all");
assert.equal(matchesWho("me", 1, false, 1), true);
assert.equal(matchesWho("me", 1, true, 1), false, "rotating belongs to Bytter på only");
assert.equal(matchesWho(2, 2, false, 1), true);
assert.equal(matchesWho("felles", null, false, 1), true);
assert.equal(matchesWho("turns", null, true, 1), true);

console.log("✓ all home-events checks passed");
