import "server-only";
import { getDb } from "./db";
import { AuthzError } from "./habits";
import { getUserById } from "./users";
import { todayStr, addDays } from "./score";
import { cadencePoints, type Cadence } from "./home-cadence";

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
  active: number;
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
}

// ===== membership / authz =====
export function isHomeMember(homeId: number, userId: number): boolean {
  return !!getDb()
    .prepare(`SELECT 1 FROM home_members WHERE home_id = ? AND user_id = ?`)
    .get(homeId, userId);
}
export function assertHomeMember(homeId: number, userId: number): void {
  if (!isHomeMember(homeId, userId)) throw new AuthzError("not a member of this home");
}

// The user's home (v1: a person belongs to one home; first wins).
export function homeForUser(userId: number): Home | null {
  return (
    (getDb()
      .prepare(
        `SELECT h.* FROM homes h JOIN home_members m ON m.home_id = h.id
         WHERE m.user_id = ? ORDER BY h.id LIMIT 1`,
      )
      .get(userId) as Home | undefined) ?? null
  );
}

export function createHome(userId: number, name: string): number {
  const db = getDb();
  const id = Number(
    db.prepare(`INSERT INTO homes (name, created_by) VALUES (?, ?)`).run(name, userId)
      .lastInsertRowid,
  );
  db.prepare(`INSERT OR IGNORE INTO home_members (home_id, user_id, role) VALUES (?, ?, 'owner')`)
    .run(id, userId);
  return id;
}

export function homeMembers(homeId: number): HomeMember[] {
  return getDb()
    .prepare(
      `SELECT m.user_id, u.name, m.role FROM home_members m
       JOIN users u ON u.id = m.user_id WHERE m.home_id = ?
       ORDER BY (m.role = 'owner') DESC, u.name`,
    )
    .all(homeId) as HomeMember[];
}

export function memberIds(homeId: number): number[] {
  return homeMembers(homeId)
    .map((m) => m.user_id)
    .sort((a, b) => a - b); // stable order for rotation
}

// Add another registered user (e.g. a partner) by email. Returns a status the
// action can surface without leaking whether the email exists beyond "no account".
export function addMemberByEmail(
  homeId: number,
  actingUserId: number,
  email: string,
): "added" | "no-account" | "already" {
  assertHomeMember(homeId, actingUserId);
  const u = getDb()
    .prepare(`SELECT id FROM users WHERE email = ?`)
    .get(email.toLowerCase()) as { id: number } | undefined;
  if (!u) return "no-account";
  if (isHomeMember(homeId, u.id)) return "already";
  getDb()
    .prepare(`INSERT OR IGNORE INTO home_members (home_id, user_id, role) VALUES (?, ?, 'member')`)
    .run(homeId, u.id);
  return "added";
}

// ===== chores =====
export interface ChoreInput {
  title: string;
  area: string | null;
  cadence: Cadence;
  points: number;
  assignee_user_id: number | null;
  rotating: boolean;
  conditional_note: string | null;
}

export function listChores(homeId: number): Chore[] {
  return getDb()
    .prepare(`SELECT * FROM chores WHERE home_id = ? AND active = 1 ORDER BY id`)
    .all(homeId) as Chore[];
}

export function getChore(choreId: number, userId: number): Chore {
  const c = getDb().prepare(`SELECT * FROM chores WHERE id = ?`).get(choreId) as Chore | undefined;
  if (!c) throw new AuthzError("chore not found");
  assertHomeMember(c.home_id, userId);
  return c;
}

export function addChore(homeId: number, userId: number, input: ChoreInput): number {
  assertHomeMember(homeId, userId);
  return Number(
    getDb()
      .prepare(
        `INSERT INTO chores (home_id, title, area, cadence, points, assignee_user_id, rotating, conditional_note)
         VALUES (@home_id, @title, @area, @cadence, @points, @assignee_user_id, @rotating, @conditional_note)`,
      )
      .run({
        home_id: homeId,
        title: input.title,
        area: input.area,
        cadence: input.cadence,
        points: input.points,
        assignee_user_id: input.assignee_user_id,
        rotating: input.rotating ? 1 : 0,
        conditional_note: input.conditional_note,
      }).lastInsertRowid,
  );
}

export function updateChore(choreId: number, userId: number, input: ChoreInput): void {
  getChore(choreId, userId); // authz
  getDb()
    .prepare(
      `UPDATE chores SET title=@title, area=@area, cadence=@cadence, points=@points,
       assignee_user_id=@assignee_user_id, rotating=@rotating, conditional_note=@conditional_note WHERE id=@id`,
    )
    .run({
      id: choreId,
      title: input.title,
      area: input.area,
      cadence: input.cadence,
      points: input.points,
      assignee_user_id: input.assignee_user_id,
      rotating: input.rotating ? 1 : 0,
      conditional_note: input.conditional_note,
    });
}

export function deleteChore(choreId: number, userId: number): void {
  getChore(choreId, userId);
  getDb().prepare(`UPDATE chores SET active = 0 WHERE id = ?`).run(choreId);
}

// Log a completion → snapshot the chore's current points to the doer.
export function logChore(choreId: number, userId: number, date = todayStr()): void {
  const c = getChore(choreId, userId);
  getDb()
    .prepare(`INSERT INTO chore_logs (chore_id, user_id, date, points) VALUES (?, ?, ?, ?)`)
    .run(choreId, userId, date, c.points);
}

// Last completion date per chore in a home → { choreId: 'YYYY-MM-DD' }.
export function lastDoneByChore(homeId: number): Record<number, string> {
  const rows = getDb()
    .prepare(
      `SELECT l.chore_id AS id, MAX(l.date) AS last FROM chore_logs l
       JOIN chores c ON c.id = l.chore_id WHERE c.home_id = ? GROUP BY l.chore_id`,
    )
    .all(homeId) as { id: number; last: string }[];
  const out: Record<number, string> = {};
  for (const r of rows) out[r.id] = r.last;
  return out;
}

// Who last did each chore (for "done by X" labels).
export function lastDoerByChore(homeId: number): Record<number, number> {
  const rows = getDb()
    .prepare(
      `SELECT l.chore_id AS id, l.user_id AS uid FROM chore_logs l
       JOIN chores c ON c.id = l.chore_id
       WHERE c.home_id = ? AND l.id IN (
         SELECT MAX(id) FROM chore_logs GROUP BY chore_id
       )`,
    )
    .all(homeId) as { id: number; uid: number }[];
  const out: Record<number, number> = {};
  for (const r of rows) out[r.id] = r.uid;
  return out;
}

// ===== points / fairness =====
// Points per member from chore logs + completed ad-hoc tasks, optionally since a date.
export function pointsByMember(homeId: number, since?: string): Record<number, number> {
  const db = getDb();
  const out: Record<number, number> = {};
  for (const id of memberIds(homeId)) out[id] = 0;

  const choreRows = db
    .prepare(
      `SELECT l.user_id AS uid, SUM(l.points) AS pts FROM chore_logs l
       JOIN chores c ON c.id = l.chore_id
       WHERE c.home_id = ?${since ? " AND l.date >= ?" : ""} GROUP BY l.user_id`,
    )
    .all(...(since ? [homeId, since] : [homeId])) as { uid: number; pts: number }[];
  for (const r of choreRows) out[r.uid] = (out[r.uid] ?? 0) + (r.pts ?? 0);

  const taskRows = db
    .prepare(
      `SELECT done_by AS uid, SUM(points) AS pts FROM home_tasks
       WHERE home_id = ? AND done_by IS NOT NULL${since ? " AND done_at >= ?" : ""} GROUP BY done_by`,
    )
    .all(...(since ? [homeId, since] : [homeId])) as { uid: number; pts: number }[];
  for (const r of taskRows) out[r.uid] = (out[r.uid] ?? 0) + (r.pts ?? 0);

  return out;
}

// ===== ad-hoc backlog =====
export function listTasks(homeId: number): HomeTask[] {
  return getDb()
    .prepare(
      `SELECT * FROM home_tasks WHERE home_id = ? ORDER BY (done_at IS NULL) DESC, created_at`,
    )
    .all(homeId) as HomeTask[];
}

export function addTask(homeId: number, userId: number, title: string, points: number): void {
  assertHomeMember(homeId, userId);
  getDb()
    .prepare(`INSERT INTO home_tasks (home_id, title, points, created_by) VALUES (?, ?, ?, ?)`)
    .run(homeId, title, points, userId);
}

export function completeTask(taskId: number, userId: number): void {
  const t = getDb().prepare(`SELECT * FROM home_tasks WHERE id = ?`).get(taskId) as
    | HomeTask
    | undefined;
  if (!t) throw new AuthzError("task not found");
  assertHomeMember(t.home_id, userId);
  if (t.done_at) {
    getDb().prepare(`UPDATE home_tasks SET done_at = NULL, done_by = NULL WHERE id = ?`).run(taskId);
  } else {
    getDb()
      .prepare(`UPDATE home_tasks SET done_at = datetime('now'), done_by = ? WHERE id = ?`)
      .run(userId, taskId);
  }
}

export function deleteTask(taskId: number, userId: number): void {
  const t = getDb().prepare(`SELECT home_id FROM home_tasks WHERE id = ?`).get(taskId) as
    | { home_id: number }
    | undefined;
  if (!t) return;
  assertHomeMember(t.home_id, userId);
  getDb().prepare(`DELETE FROM home_tasks WHERE id = ?`).run(taskId);
}

// Re-export so pages can default new chore points by cadence.
export { cadencePoints, addDays };
