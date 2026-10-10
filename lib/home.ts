import "server-only";
import { dbGet, dbAll, dbRun } from "./db";
import { AuthzError } from "./habits";
import { todayStr, addDays } from "./score";
import {
  cadencePoints,
  firstDue,
  nextAfterRound,
  isVedBehov,
  dueAfterEdit,
  type Cadence,
  type RuleFields,
} from "./home-cadence";
import { unreadThreshold, type EventKind, type HomeEvent } from "./home-events";

// ===== types =====
export interface Home {
  id: number;
  name: string;
  created_by: number;
}
export interface HomeMember {
  user_id: number;
  name: string;
  role: string;
}
export interface Chore {
  id: number;
  home_id: number;
  title: string;
  area: string | null;
  cadence: Cadence;
  points: number;
  assignee_user_id: number | null;
  rotating: number;
  conditional_note: string | null;
  standard: string | null;
  active: number;
  created_at: string;
  every_days: number | null;
  weekdays: string | null;
  every_weeks: number | null;
  next_due: string | null;
  given_to: number | null;
  created_by: number | null; // null for seeded starter Routines
}
export interface HomeTask {
  id: number;
  home_id: number;
  title: string;
  points: number;
  created_by: number;
  created_at: string;
  done_at: string | null;
  done_by: number | null;
  due_on: string | null; // null = Senere (backlog)
  owner_user_id: number | null; // null = Felles
}

// ===== membership / authz =====
export async function isHomeMember(homeId: number, userId: number): Promise<boolean> {
  return !!(await dbGet(
    `SELECT 1 FROM home_members WHERE home_id = ? AND user_id = ?`,
    [homeId, userId],
  ));
}
export async function assertHomeMember(homeId: number, userId: number): Promise<void> {
  if (!(await isHomeMember(homeId, userId))) throw new AuthzError("not a member of this home");
}

// The user's home (v1: a person belongs to one home; first wins).
export async function homeForUser(userId: number): Promise<Home | null> {
  return (
    (await dbGet<Home>(
      `SELECT h.* FROM homes h JOIN home_members m ON m.home_id = h.id
         WHERE m.user_id = ? ORDER BY h.id LIMIT 1`,
      [userId],
    )) ?? null
  );
}

export async function createHome(userId: number, name: string): Promise<number> {
  const info = await dbRun(`INSERT INTO homes (name, created_by) VALUES (?, ?)`, [name, userId]);
  const id = Number(info.lastInsertRowid);
  await dbRun(
    `INSERT OR IGNORE INTO home_members (home_id, user_id, role) VALUES (?, ?, 'owner')`,
    [id, userId],
  );
  return id;
}

export async function homeMembers(homeId: number): Promise<HomeMember[]> {
  return dbAll<HomeMember>(
    `SELECT m.user_id, u.name, m.role FROM home_members m
       JOIN users u ON u.id = m.user_id WHERE m.home_id = ?
       ORDER BY (m.role = 'owner') DESC, u.name`,
    [homeId],
  );
}

export async function memberIds(homeId: number): Promise<number[]> {
  return (await homeMembers(homeId))
    .map((m) => Number(m.user_id))
    .sort((a, b) => a - b); // stable order for rotation
}

// Add another registered user (e.g. a partner) by email. Returns a status the
// action can surface without leaking whether the email exists beyond "no account".
export async function addMemberByEmail(
  homeId: number,
  actingUserId: number,
  email: string,
): Promise<"added" | "no-account" | "already"> {
  await assertHomeMember(homeId, actingUserId);
  const u = await dbGet<{ id: number }>(`SELECT id FROM users WHERE email = ?`, [
    email.toLowerCase(),
  ]);
  if (!u) return "no-account";
  if (await isHomeMember(homeId, Number(u.id))) return "already";
  await dbRun(
    `INSERT OR IGNORE INTO home_members (home_id, user_id, role) VALUES (?, ?, 'member')`,
    [homeId, Number(u.id)],
  );
  return "added";
}

// ===== chores =====
export interface ChoreInput extends RuleFields {
  next_due: string | null; // "first date"; null → one round out
  title: string;
  area: string | null;
  cadence: Cadence;
  points: number;
  assignee_user_id: number | null;
  rotating: boolean;
  conditional_note: string | null;
  standard: string | null;
}

function ruleArgs(input: ChoreInput, nextDue: string | null) {
  return {
    every_days: input.every_days,
    weekdays: input.weekdays,
    every_weeks: input.every_weeks,
    next_due: nextDue,
  };
}

// The date a Routine is due. Stored next_due wins; rows from before it existed
// fall back to "one round after the last done (or after it was made)".
export function effectiveDue(c: Chore, lastDone: string | null): string | null {
  if (c.next_due) return c.next_due;
  if (isVedBehov(c)) return null;
  return lastDone ? nextAfterRound(c, null, lastDone) : firstDue(c, c.created_at.slice(0, 10));
}

export async function listChores(homeId: number): Promise<Chore[]> {
  return dbAll<Chore>(
    `SELECT * FROM chores WHERE home_id = ? AND active = 1 ORDER BY id`,
    [homeId],
  );
}

export async function getChore(choreId: number, userId: number): Promise<Chore> {
  const c = await dbGet<Chore>(`SELECT * FROM chores WHERE id = ? AND active = 1`, [choreId]);
  if (!c) throw new AuthzError("chore not found");
  await assertHomeMember(c.home_id, userId);
  return c;
}

export async function addChore(homeId: number, userId: number, input: ChoreInput): Promise<number> {
  await assertHomeMember(homeId, userId);
  const info = await dbRun(
    `INSERT INTO chores (home_id, title, area, cadence, points, assignee_user_id, rotating, conditional_note, standard,
         every_days, weekdays, every_weeks, next_due, created_by)
         VALUES (@home_id, @title, @area, @cadence, @points, @assignee_user_id, @rotating, @conditional_note, @standard,
         @every_days, @weekdays, @every_weeks, @next_due, @created_by)`,
    {
      ...ruleArgs(input, input.next_due ?? firstDue(input)),
      created_by: userId,
      home_id: homeId,
      title: input.title,
      area: input.area,
      cadence: input.cadence,
      points: input.points,
      assignee_user_id: input.assignee_user_id,
      rotating: input.rotating ? 1 : 0,
      conditional_note: input.conditional_note,
      standard: input.standard,
    },
  );
  const id = Number(info.lastInsertRowid);
  await recordHomeEvent(homeId, userId, "chore_added", input.title, { refKind: "routine", refId: id });
  return id;
}

export async function updateChore(choreId: number, userId: number, input: ChoreInput): Promise<void> {
  const old = await getChore(choreId, userId); // authz
  const oldDue = effectiveDue(old, await lastDoneForChore(choreId));
  await dbRun(
    `UPDATE chores SET title=@title, area=@area, cadence=@cadence, points=@points,
       assignee_user_id=@assignee_user_id, rotating=@rotating, conditional_note=@conditional_note,
       standard=@standard, every_days=@every_days, weekdays=@weekdays, every_weeks=@every_weeks,
       next_due=@next_due WHERE id=@id`,
    {
      ...ruleArgs(input, dueAfterEdit(old, oldDue, input, input.next_due)),
      id: choreId,
      title: input.title,
      area: input.area,
      cadence: input.cadence,
      points: input.points,
      assignee_user_id: input.assignee_user_id,
      rotating: input.rotating ? 1 : 0,
      conditional_note: input.conditional_note,
      standard: input.standard,
    },
  );
  await recordHomeEvent(old.home_id, userId, "chore_changed", input.title, { refKind: "routine", refId: choreId });
}

export async function deleteChore(choreId: number, userId: number): Promise<void> {
  await getChore(choreId, userId);
  await dbRun(`UPDATE chores SET active = 0 WHERE id = ?`, [choreId]);
}

// Gjort: log it to the doer (points snapshot), move the Routine to its next
// round, end any Gi bort. The log keeps the old state so Angre can restore it.
// A Felles Routine (no owner) gives a small bonus to whoever takes it.
export const FELLES_BONUS = 1;

export async function logChore(choreId: number, userId: number, date = todayStr()): Promise<number> {
  const c = await getChore(choreId, userId);
  const bonus = c.assignee_user_id == null && !c.rotating ? FELLES_BONUS : 0;
  const due = effectiveDue(c, await lastDoneForChore(choreId));
  // Compare-and-set on the round: a double tap or a stale page cannot close it twice.
  const moved = await dbRun(
    `UPDATE chores SET next_due = ?, given_to = NULL WHERE id = ? AND COALESCE(next_due, '') = ?`,
    [nextAfterRound(c, due, date), choreId, c.next_due ?? ""],
  );
  if (moved.rowsAffected === 0) return 0; // someone closed this round a moment ago
  const info = await dbRun(
    `INSERT INTO chore_logs (chore_id, user_id, date, points, prev_due, prev_given_to) VALUES (?, ?, ?, ?, ?, ?)`,
    [choreId, userId, date, c.points + bonus, due, c.given_to],
  );
  return Number(info.lastInsertRowid);
}

// Angre: only the person who ticked can undo their own tick.
export async function undoChoreLog(logId: number, userId: number): Promise<void> {
  const l = await dbGet<{ chore_id: number; user_id: number; prev_due: string | null; prev_given_to: number | null }>(
    `SELECT chore_id, user_id, prev_due, prev_given_to FROM chore_logs WHERE id = ?`,
    [logId],
  );
  if (!l || Number(l.user_id) !== userId) throw new AuthzError("not your tick");
  await getChore(Number(l.chore_id), userId);
  // Only the newest tick of a Routine can be undone; an older one would rewind a later round.
  const latest = await dbGet<{ id: number }>(`SELECT MAX(id) AS id FROM chore_logs WHERE chore_id = ?`, [
    Number(l.chore_id),
  ]);
  if (Number(latest?.id) !== logId) throw new AuthzError("only the latest tick can be undone");
  await dbRun(`DELETE FROM chore_logs WHERE id = ?`, [logId]);
  await dbRun(`UPDATE chores SET next_due = ?, given_to = ? WHERE id = ?`, [
    l.prev_due,
    l.prev_given_to,
    Number(l.chore_id),
  ]);
}

// Hopp over: close the round without a log (Bytter på keeps the same turn).
export async function skipChore(choreId: number, userId: number, today = todayStr()): Promise<void> {
  const c = await getChore(choreId, userId);
  const due = effectiveDue(c, await lastDoneForChore(choreId));
  await dbRun(
    `UPDATE chores SET next_due = ?, given_to = NULL WHERE id = ? AND COALESCE(next_due, '') = ?`,
    [nextAfterRound(c, due, today), choreId, c.next_due ?? ""],
  );
}

// Utsett: same round, later day.
export async function postponeChore(choreId: number, userId: number, date: string): Promise<void> {
  await getChore(choreId, userId);
  await dbRun(`UPDATE chores SET next_due = ? WHERE id = ?`, [date, choreId]);
}

// Gi bort: this round goes to the other person; no yes needed.
export async function giveAwayChore(choreId: number, userId: number): Promise<void> {
  const c = await getChore(choreId, userId);
  const other = (await memberIds(c.home_id)).find((id) => id !== userId);
  if (other == null) throw new AuthzError("nobody to give it to");
  await dbRun(`UPDATE chores SET given_to = ? WHERE id = ?`, [other, choreId]);
  await recordHomeEvent(c.home_id, userId, "chore_given", c.title, {
    targetUserId: other,
    refKind: "routine",
    refId: choreId,
  });
}

// Last completion date of one chore.
export async function lastDoneForChore(choreId: number): Promise<string | null> {
  const r = await dbGet<{ last: string | null }>(`SELECT MAX(date) AS last FROM chore_logs WHERE chore_id = ?`, [
    choreId,
  ]);
  return r?.last ?? null;
}

// Last completion date per chore in a home → { choreId: 'YYYY-MM-DD' }.
export async function lastDoneByChore(homeId: number): Promise<Record<number, string>> {
  const rows = await dbAll<{ id: number; last: string }>(
    `SELECT l.chore_id AS id, MAX(l.date) AS last FROM chore_logs l
       JOIN chores c ON c.id = l.chore_id WHERE c.home_id = ? GROUP BY l.chore_id`,
    [homeId],
  );
  const out: Record<number, string> = {};
  for (const r of rows) out[Number(r.id)] = r.last;
  return out;
}

// Who last did each chore (for "done by X" labels).
export async function lastDoerByChore(homeId: number): Promise<Record<number, number>> {
  const rows = await dbAll<{ id: number; uid: number }>(
    `SELECT l.chore_id AS id, l.user_id AS uid FROM chore_logs l
       JOIN chores c ON c.id = l.chore_id
       WHERE c.home_id = ? AND l.id IN (
         SELECT MAX(id) FROM chore_logs GROUP BY chore_id
       )`,
    [homeId],
  );
  const out: Record<number, number> = {};
  for (const r of rows) out[Number(r.id)] = Number(r.uid);
  return out;
}

// ===== points / fairness =====
// Points per member from chore logs + completed ad-hoc tasks, optionally since a date.
export async function pointsByMember(
  homeId: number,
  since?: string,
  members?: number[], // pass the already-loaded member ids to skip a query
): Promise<Record<number, number>> {
  const out: Record<number, number> = {};
  for (const id of members ?? (await memberIds(homeId))) out[id] = 0;

  const choreRows = await dbAll<{ uid: number; pts: number }>(
    `SELECT l.user_id AS uid, SUM(l.points) AS pts FROM chore_logs l
       JOIN chores c ON c.id = l.chore_id
       WHERE c.home_id = ?${since ? " AND l.date >= ?" : ""} GROUP BY l.user_id`,
    since ? [homeId, since] : [homeId],
  );
  for (const r of choreRows) out[Number(r.uid)] = (out[Number(r.uid)] ?? 0) + Number(r.pts ?? 0);

  const taskRows = await dbAll<{ uid: number; pts: number }>(
    `SELECT done_by AS uid, SUM(points) AS pts FROM home_tasks
       WHERE home_id = ? AND done_by IS NOT NULL${since ? " AND done_at >= ?" : ""} GROUP BY done_by`,
    since ? [homeId, since] : [homeId],
  );
  for (const r of taskRows) out[Number(r.uid)] = (out[Number(r.uid)] ?? 0) + Number(r.pts ?? 0);

  return out;
}

// ===== ad-hoc backlog =====
export async function listTasks(homeId: number): Promise<HomeTask[]> {
  return dbAll<HomeTask>(
    `SELECT * FROM home_tasks WHERE home_id = ? ORDER BY (done_at IS NULL) DESC, created_at`,
    [homeId],
  );
}

export async function addTask(
  homeId: number,
  userId: number,
  title: string,
  points: number,
  dueOn: string | null,
  ownerUserId: number | null,
): Promise<void> {
  await assertHomeMember(homeId, userId);
  if (ownerUserId != null) await assertHomeMember(homeId, ownerUserId);
  const info = await dbRun(
    `INSERT INTO home_tasks (home_id, title, points, created_by, due_on, owner_user_id) VALUES (?, ?, ?, ?, ?, ?)`,
    [homeId, title, points, userId, dueOn, ownerUserId],
  );
  await recordHomeEvent(homeId, userId, "task_added", title, {
    targetUserId: ownerUserId != null && ownerUserId !== userId ? ownerUserId : null,
    refKind: "task",
    refId: Number(info.lastInsertRowid),
  });
}

// Give a Task a day (null = Senere).
export async function setTaskDay(taskId: number, userId: number, dueOn: string | null): Promise<void> {
  const t = await dbGet<{ home_id: number }>(`SELECT home_id FROM home_tasks WHERE id = ?`, [taskId]);
  if (!t) throw new AuthzError("task not found");
  await assertHomeMember(t.home_id, userId);
  await dbRun(`UPDATE home_tasks SET due_on = ? WHERE id = ?`, [dueOn, taskId]);
}

// Gjort / Angre on a Task. Idempotent: a second tap changes nothing.
export async function setTaskDone(taskId: number, userId: number, done: boolean): Promise<void> {
  const t = await dbGet<HomeTask>(`SELECT * FROM home_tasks WHERE id = ?`, [taskId]);
  if (!t) throw new AuthzError("task not found");
  await assertHomeMember(t.home_id, userId);
  if (done) {
    await dbRun(`UPDATE home_tasks SET done_at = datetime('now'), done_by = ? WHERE id = ? AND done_at IS NULL`, [
      userId,
      taskId,
    ]);
  } else {
    await dbRun(`UPDATE home_tasks SET done_at = NULL, done_by = NULL WHERE id = ? AND done_by = ?`, [taskId, userId]);
  }
}

export async function deleteTask(taskId: number, userId: number): Promise<void> {
  const t = await dbGet<{ home_id: number }>(`SELECT home_id FROM home_tasks WHERE id = ?`, [taskId]);
  if (!t) return;
  await assertHomeMember(t.home_id, userId);
  await dbRun(`DELETE FROM home_tasks WHERE id = ?`, [taskId]);
}

// ===== Varsler: what one person did that the other should see =====
export async function recordHomeEvent(
  homeId: number,
  actorId: number,
  kind: EventKind,
  title: string,
  opts: { targetUserId?: number | null; refKind?: "routine" | "task"; refId?: number } = {},
): Promise<void> {
  await dbRun(
    `INSERT INTO home_events (home_id, actor_id, kind, title, target_user_id, ref_kind, ref_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [homeId, actorId, kind, title, opts.targetUserId ?? null, opts.refKind ?? null, opts.refId ?? null],
  );
}

export async function getSeenAt(homeId: number, userId: number): Promise<string | null> {
  const r = await dbGet<{ seen_at: string | null }>(
    `SELECT seen_at FROM home_members WHERE home_id = ? AND user_id = ?`,
    [homeId, userId],
  );
  return r?.seen_at ?? null;
}

// Events by the other person that this user has not seen yet (newest first).
export async function unreadHomeEvents(homeId: number, userId: number, seenAt: string | null): Promise<HomeEvent[]> {
  return dbAll<HomeEvent>(
    `SELECT * FROM home_events WHERE home_id = ? AND actor_id != ? AND created_at > ? ORDER BY id DESC LIMIT 50`,
    [homeId, userId, unreadThreshold(seenAt)],
  );
}

export async function recentHomeEvents(homeId: number, limit = 30): Promise<HomeEvent[]> {
  return dbAll<HomeEvent>(`SELECT * FROM home_events WHERE home_id = ? ORDER BY id DESC LIMIT ${Math.floor(limit)}`, [
    homeId,
  ]);
}

export async function markHomeSeen(homeId: number, userId: number): Promise<void> {
  await dbRun(`UPDATE home_members SET seen_at = datetime('now') WHERE home_id = ? AND user_id = ?`, [homeId, userId]);
}

// ===== Premier (prizes) =====
export interface Reward {
  id: number;
  home_id: number;
  title: string;
  cost: number;
}
export interface Redemption {
  id: number;
  reward_id: number;
  title: string;
  cost: number;
  user_id: number;
  created_at: string;
  given_at: string | null;
}

export async function listRewards(homeId: number): Promise<Reward[]> {
  return dbAll<Reward>(`SELECT * FROM home_rewards WHERE home_id = ? AND active = 1 ORDER BY cost, title`, [homeId]);
}

export async function addReward(homeId: number, userId: number, title: string, cost: number): Promise<void> {
  await assertHomeMember(homeId, userId);
  await dbRun(`INSERT INTO home_rewards (home_id, title, cost) VALUES (?, ?, ?)`, [homeId, title, cost]);
}

async function getReward(rewardId: number, userId: number): Promise<Reward> {
  const r = await dbGet<Reward>(`SELECT * FROM home_rewards WHERE id = ? AND active = 1`, [rewardId]);
  if (!r) throw new AuthzError("prize not found");
  await assertHomeMember(r.home_id, userId);
  return r;
}

export async function deleteReward(rewardId: number, userId: number): Promise<void> {
  await getReward(rewardId, userId);
  await dbRun(`UPDATE home_rewards SET active = 0 WHERE id = ?`, [rewardId]);
}

export async function listRedemptions(homeId: number): Promise<Redemption[]> {
  return dbAll<Redemption>(
    `SELECT d.id, d.reward_id, d.title, d.cost, d.user_id, d.created_at, d.given_at
       FROM home_redemptions d WHERE d.home_id = ? ORDER BY d.given_at IS NULL DESC, d.id DESC`,
    [homeId],
  );
}

// Wallet: all Home points earned minus points spent on prizes.
export async function walletByMember(homeId: number, members?: number[]): Promise<Record<number, number>> {
  const out = await pointsByMember(homeId, undefined, members);
  const spent = await dbAll<{ uid: number; pts: number }>(
    `SELECT user_id AS uid, SUM(cost) AS pts FROM home_redemptions WHERE home_id = ? GROUP BY user_id`,
    [homeId],
  );
  for (const s of spent) out[Number(s.uid)] = (out[Number(s.uid)] ?? 0) - Number(s.pts ?? 0);
  return out;
}

// Løs inn: pay with points; the other person sees it until they mark it "Gitt".
// ponytail: balance check then insert is not atomic; two taps at once can overspend by one prize.
export async function redeemReward(rewardId: number, userId: number): Promise<"ok" | "poor"> {
  const r = await getReward(rewardId, userId);
  if (((await walletByMember(r.home_id))[userId] ?? 0) < r.cost) return "poor";
  await dbRun(
    `INSERT INTO home_redemptions (home_id, reward_id, title, cost, user_id) VALUES (?, ?, ?, ?, ?)`,
    [r.home_id, r.id, r.title, r.cost, userId],
  );
  return "ok";
}

// Only the other person (the giver) marks a prize as given.
export async function markRedemptionGiven(redemptionId: number, userId: number): Promise<void> {
  const d = await dbGet<{ home_id: number; user_id: number }>(
    `SELECT home_id, user_id FROM home_redemptions WHERE id = ?`,
    [redemptionId],
  );
  if (!d) throw new AuthzError("not found");
  await assertHomeMember(d.home_id, userId);
  if (Number(d.user_id) === userId) throw new AuthzError("the other person marks it given");
  await dbRun(`UPDATE home_redemptions SET given_at = datetime('now') WHERE id = ?`, [redemptionId]);
}

// Re-export so pages can default new chore points by cadence.
export { cadencePoints, addDays };
