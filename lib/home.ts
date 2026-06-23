import "server-only";
import { dbGet, dbAll, dbRun } from "./db";
import { AuthzError } from "./habits";
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
  standard: string | null;
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
export interface ChoreInput {
  title: string;
  area: string | null;
  cadence: Cadence;
  points: number;
  assignee_user_id: number | null;
  rotating: boolean;
  conditional_note: string | null;
  standard: string | null;
}

export async function listChores(homeId: number): Promise<Chore[]> {
  return dbAll<Chore>(
    `SELECT * FROM chores WHERE home_id = ? AND active = 1 ORDER BY id`,
    [homeId],
  );
}

export async function getChore(choreId: number, userId: number): Promise<Chore> {
  const c = await dbGet<Chore>(`SELECT * FROM chores WHERE id = ?`, [choreId]);
  if (!c) throw new AuthzError("chore not found");
  await assertHomeMember(c.home_id, userId);
  return c;
}

export async function addChore(homeId: number, userId: number, input: ChoreInput): Promise<number> {
  await assertHomeMember(homeId, userId);
  const info = await dbRun(
    `INSERT INTO chores (home_id, title, area, cadence, points, assignee_user_id, rotating, conditional_note, standard)
         VALUES (@home_id, @title, @area, @cadence, @points, @assignee_user_id, @rotating, @conditional_note, @standard)`,
    {
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
  return Number(info.lastInsertRowid);
}

export async function updateChore(choreId: number, userId: number, input: ChoreInput): Promise<void> {
  await getChore(choreId, userId); // authz
  await dbRun(
    `UPDATE chores SET title=@title, area=@area, cadence=@cadence, points=@points,
       assignee_user_id=@assignee_user_id, rotating=@rotating, conditional_note=@conditional_note,
       standard=@standard WHERE id=@id`,
    {
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
}

export async function deleteChore(choreId: number, userId: number): Promise<void> {
  await getChore(choreId, userId);
  await dbRun(`UPDATE chores SET active = 0 WHERE id = ?`, [choreId]);
}

// Log a completion → snapshot the chore's current points to the doer.
export async function logChore(choreId: number, userId: number, date = todayStr()): Promise<void> {
  const c = await getChore(choreId, userId);
  await dbRun(`INSERT INTO chore_logs (chore_id, user_id, date, points) VALUES (?, ?, ?, ?)`, [
    choreId,
    userId,
    date,
    c.points,
  ]);
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
export async function pointsByMember(homeId: number, since?: string): Promise<Record<number, number>> {
  const out: Record<number, number> = {};
  for (const id of await memberIds(homeId)) out[id] = 0;

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

export async function addTask(homeId: number, userId: number, title: string, points: number): Promise<void> {
  await assertHomeMember(homeId, userId);
  await dbRun(`INSERT INTO home_tasks (home_id, title, points, created_by) VALUES (?, ?, ?, ?)`, [
    homeId,
    title,
    points,
    userId,
  ]);
}

export async function completeTask(taskId: number, userId: number): Promise<void> {
  const t = await dbGet<HomeTask>(`SELECT * FROM home_tasks WHERE id = ?`, [taskId]);
  if (!t) throw new AuthzError("task not found");
  await assertHomeMember(t.home_id, userId);
  if (t.done_at) {
    await dbRun(`UPDATE home_tasks SET done_at = NULL, done_by = NULL WHERE id = ?`, [taskId]);
  } else {
    await dbRun(`UPDATE home_tasks SET done_at = datetime('now'), done_by = ? WHERE id = ?`, [
      userId,
      taskId,
    ]);
  }
}

export async function deleteTask(taskId: number, userId: number): Promise<void> {
  const t = await dbGet<{ home_id: number }>(`SELECT home_id FROM home_tasks WHERE id = ?`, [taskId]);
  if (!t) return;
  await assertHomeMember(t.home_id, userId);
  await dbRun(`DELETE FROM home_tasks WHERE id = ?`, [taskId]);
}

// Re-export so pages can default new chore points by cadence.
export { cadencePoints, addDays };
