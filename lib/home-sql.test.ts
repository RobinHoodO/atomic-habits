// Verifies the hairy Home SQL against the real schema, on an in-memory DB.
// Run with: npx tsx lib/home-sql.test.ts
import assert from "node:assert";
import Database from "better-sqlite3";
import { SCHEMA_SQL, HOME_TABLES_SQL, HOME_COLUMNS } from "./schema";

const db = new Database(":memory:");
db.pragma("foreign_keys = ON");
db.exec(SCHEMA_SQL + HOME_TABLES_SQL);
for (const [t, c] of HOME_COLUMNS) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c}`);

// users
const u1 = Number(db.prepare("INSERT INTO users (email,name,password_hash) VALUES (?,?,?)").run("a@x.no", "Robin", "h").lastInsertRowid);
const u2 = Number(db.prepare("INSERT INTO users (email,name,password_hash) VALUES (?,?,?)").run("b@x.no", "Partner", "h").lastInsertRowid);

// home + members
const home = Number(db.prepare("INSERT INTO homes (name, created_by) VALUES (?,?)").run("Vårt hjem", u1).lastInsertRowid);
db.prepare("INSERT INTO home_members (home_id,user_id,role) VALUES (?,?,'owner')").run(home, u1);
db.prepare("INSERT INTO home_members (home_id,user_id,role) VALUES (?,?,'member')").run(home, u2);

// chores
const trash = Number(db.prepare("INSERT INTO chores (home_id,title,cadence,points) VALUES (?,?,?,?)").run(home, "Søppel", "daily", 5).lastInsertRowid);
const floor = Number(db.prepare("INSERT INTO chores (home_id,title,cadence,points) VALUES (?,?,?,?)").run(home, "Gulv", "quarterly", 35).lastInsertRowid);

// logs: u1 did trash twice (10), u2 did floor once (35) + trash once (5)
db.prepare("INSERT INTO chore_logs (chore_id,user_id,date,points) VALUES (?,?,?,?)").run(trash, u1, "2026-06-18", 5);
db.prepare("INSERT INTO chore_logs (chore_id,user_id,date,points) VALUES (?,?,?,?)").run(trash, u1, "2026-06-19", 5);
db.prepare("INSERT INTO chore_logs (chore_id,user_id,date,points) VALUES (?,?,?,?)").run(floor, u2, "2026-06-15", 35);
db.prepare("INSERT INTO chore_logs (chore_id,user_id,date,points) VALUES (?,?,?,?)").run(trash, u2, "2026-06-20", 5);

// an ad-hoc task done by u1 (+8)
db.prepare("INSERT INTO home_tasks (home_id,title,points,created_by,done_at,done_by) VALUES (?,?,?,?,datetime('now'),?)").run(home, "Heng opp bilde", 8, u1, u1);

// --- pointsByMember SQL (mirrors lib/home.ts) ---
const choreRows = db.prepare(
  `SELECT l.user_id AS uid, SUM(l.points) AS pts FROM chore_logs l
   JOIN chores c ON c.id = l.chore_id WHERE c.home_id = ? GROUP BY l.user_id`,
).all(home) as { uid: number; pts: number }[];
const taskRows = db.prepare(
  `SELECT done_by AS uid, SUM(points) AS pts FROM home_tasks WHERE home_id = ? AND done_by IS NOT NULL GROUP BY done_by`,
).all(home) as { uid: number; pts: number }[];
const pts: Record<number, number> = { [u1]: 0, [u2]: 0 };
for (const r of choreRows) pts[r.uid] += r.pts;
for (const r of taskRows) pts[r.uid] += r.pts;

assert.equal(pts[u1], 5 + 5 + 8, "u1: 2 trash logs (10) + task (8) = 18");
assert.equal(pts[u2], 35 + 5, "u2: floor (35) + trash (5) = 40");

// --- lastDoneByChore SQL ---
const last = db.prepare(
  `SELECT l.chore_id AS id, MAX(l.date) AS last FROM chore_logs l
   JOIN chores c ON c.id = l.chore_id WHERE c.home_id = ? GROUP BY l.chore_id`,
).all(home) as { id: number; last: string }[];
const lastMap = Object.fromEntries(last.map((r) => [r.id, r.last]));
assert.equal(lastMap[trash], "2026-06-20", "trash last done = latest of its logs");
assert.equal(lastMap[floor], "2026-06-15");

// --- since-window filter ---
const since = db.prepare(
  `SELECT SUM(l.points) AS pts FROM chore_logs l JOIN chores c ON c.id=l.chore_id
   WHERE c.home_id=? AND l.user_id=? AND l.date >= ?`,
).get(home, u1, "2026-06-19") as { pts: number };
assert.equal(since.pts, 5, "u1 since 06-19: only the 06-19 trash log (5)");

// --- Premier: wallet = earned - spent (mirrors walletByMember) ---
const massage = Number(db.prepare("INSERT INTO home_rewards (home_id,title,cost) VALUES (?,?,?)").run(home, "Massasje", 10).lastInsertRowid);
db.prepare("INSERT INTO home_redemptions (home_id,reward_id,title,cost,user_id) VALUES (?,?,?,?,?)").run(home, massage, "Massasje", 10, u1);
const spent = db.prepare(
  `SELECT user_id AS uid, SUM(cost) AS pts FROM home_redemptions WHERE home_id = ? GROUP BY user_id`,
).all(home) as { uid: number; pts: number }[];
const wallet = { ...pts };
for (const r of spent) wallet[r.uid] -= r.pts;
assert.equal(wallet[u1], 18 - 10, "u1 spent 10 on a massage");
assert.equal(wallet[u2], 40, "u2 spent nothing");
const pending = db.prepare(
  `SELECT id FROM home_redemptions WHERE home_id = ? ORDER BY given_at IS NULL DESC, id DESC`,
).all(home);
assert.equal(pending.length, 1);

// --- Angre restores the snapshot columns ---
db.prepare("UPDATE chores SET next_due = '2026-06-21', given_to = ? WHERE id = ?").run(u2, trash);
const log = Number(db.prepare("INSERT INTO chore_logs (chore_id,user_id,date,points,prev_due,prev_given_to) VALUES (?,?,?,?,?,?)").run(trash, u1, "2026-06-21", 6, "2026-06-21", u2).lastInsertRowid);
db.prepare("UPDATE chores SET next_due = '2026-06-22', given_to = NULL WHERE id = ?").run(trash);
const l = db.prepare("SELECT prev_due, prev_given_to FROM chore_logs WHERE id = ?").get(log) as { prev_due: string; prev_given_to: number };
db.prepare("DELETE FROM chore_logs WHERE id = ?").run(log);
db.prepare("UPDATE chores SET next_due = ?, given_to = ? WHERE id = ?").run(l.prev_due, l.prev_given_to, trash);
const back = db.prepare("SELECT next_due, given_to FROM chores WHERE id = ?").get(trash) as { next_due: string; given_to: number };
assert.deepEqual([back.next_due, back.given_to], ["2026-06-21", u2], "Angre puts due date and Gi bort back");

console.log("✓ all home SQL checks passed");
