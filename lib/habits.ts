import "server-only";
import { dbGet, dbAll, dbRun } from "./db";
import {
  parseSchedule,
  currentStreak,
  consistencyScore,
  recoveryRate,
  missedTwiceActive,
  isDueToday,
  todayStr,
  type Schedule,
} from "./score";
import { computeXp, earnedBadgeKeys, type BadgeCtx } from "./gamify";
import { getUserById } from "./users";
import { addDays, scheduledDaysBetween } from "./score";

export type HabitType = "good" | "bad" | "neutral";
export type Visibility = "private" | "connections";

export interface Identity {
  id: number;
  owner_id: number;
  name: string;
  statement: string;
}

export interface Habit {
  id: number;
  owner_id: number;
  name: string;
  type: HabitType;
  identity_id: number | null;
  cue: string | null;
  craving: string | null;
  response: string | null;
  reward: string | null;
  intention_time: string | null;
  intention_location: string | null;
  gateway_text: string | null;
  schedule: string;
  visibility: Visibility;
  archived: number;
}

export interface HabitInput {
  name: string;
  type: HabitType;
  identity_id: number | null;
  cue: string | null;
  craving: string | null;
  response: string | null;
  reward: string | null;
  intention_time: string | null;
  intention_location: string | null;
  gateway_text: string | null;
  schedule: string;
  visibility: Visibility;
}

export interface HabitStats {
  streak: number;
  consistency: number | null;
  recovery: number | null;
  missedTwice: boolean;
  due: boolean;
  totalVotes: number;
}

// ======================================================================
// Authorization — the security boundary. Every entry point goes through
// these. They throw on violation; callers must pass the SESSION user id.
// ======================================================================

export class AuthzError extends Error {
  constructor(msg = "Not authorized") {
    super(msg);
    this.name = "AuthzError";
  }
}

export async function isMember(habitId: number, userId: number): Promise<boolean> {
  return !!(await dbGet(
    "SELECT 1 FROM habit_members WHERE habit_id = ? AND user_id = ?",
    [habitId, userId],
  ));
}

export async function areConnected(a: number, b: number): Promise<boolean> {
  if (a === b) return true;
  return !!(await dbGet(
    `SELECT 1 FROM connections
       WHERE status = 'accepted'
         AND ((requester_id = ? AND addressee_id = ?)
           OR (requester_id = ? AND addressee_id = ?))`,
    [a, b, b, a],
  ));
}

// View: member, or a connection when the habit is shared to connections.
export async function canView(habit: Habit, userId: number): Promise<boolean> {
  if (await isMember(habit.id, userId)) return true;
  return habit.visibility === "connections" && (await areConnected(habit.owner_id, userId));
}

// Edit/complete: members only (owner + invited partners).
export async function canEdit(habit: Habit, userId: number): Promise<boolean> {
  return isMember(habit.id, userId);
}

async function rawHabit(id: number): Promise<Habit | undefined> {
  return dbGet<Habit>("SELECT * FROM habits WHERE id = ?", [id]);
}

export async function assertCanView(habitId: number, userId: number): Promise<Habit> {
  const h = await rawHabit(habitId);
  if (!h || !(await canView(h, userId))) throw new AuthzError();
  return h;
}

export async function assertCanEdit(habitId: number, userId: number): Promise<Habit> {
  const h = await rawHabit(habitId);
  if (!h || !(await canEdit(h, userId))) throw new AuthzError();
  return h;
}

// ======================================================================
// Identities  (scoped to owner)
// ======================================================================

export async function listIdentities(userId: number): Promise<Identity[]> {
  return dbAll<Identity>(
    "SELECT * FROM identities WHERE owner_id = ? ORDER BY name",
    [userId],
  );
}

export async function getIdentity(id: number, userId: number): Promise<Identity | undefined> {
  return dbGet<Identity>(
    "SELECT * FROM identities WHERE id = ? AND owner_id = ?",
    [id, userId],
  );
}

export async function createIdentity(
  userId: number,
  name: string,
  statement: string,
): Promise<number> {
  const info = await dbRun(
    "INSERT INTO identities (owner_id, name, statement) VALUES (?, ?, ?)",
    [userId, name, statement],
  );
  return Number(info.lastInsertRowid);
}

// Votes = the owner's completions on habits tied to this identity.
export async function identityVotes(identityId: number, ownerId: number): Promise<number> {
  const row = await dbGet<{ n: number }>(
    `SELECT COUNT(*) AS n FROM completions c
       JOIN habits h ON h.id = c.habit_id
       WHERE h.identity_id = ? AND c.user_id = ?`,
    [identityId, ownerId],
  );
  return Number(row?.n ?? 0);
}

// ======================================================================
// Habits  (membership-based)
// ======================================================================

// Habits the user participates in (owner or invited partner).
export async function listHabits(userId: number, includeArchived = false): Promise<Habit[]> {
  const sql = `SELECT h.* FROM habits h
     JOIN habit_members m ON m.habit_id = h.id AND m.user_id = ?
     ${includeArchived ? "" : "WHERE h.archived = 0"}
     ORDER BY h.archived, h.name`;
  return dbAll<Habit>(sql, [userId]);
}

// A habit the user is allowed to VIEW (throws otherwise).
export async function getHabit(id: number, userId: number): Promise<Habit> {
  return assertCanView(id, userId);
}

export async function createHabit(userId: number, input: HabitInput): Promise<number> {
  const info = await dbRun(
    `INSERT INTO habits
       (owner_id, name, type, identity_id, cue, craving, response, reward,
        intention_time, intention_location, gateway_text, schedule, visibility)
       VALUES (@owner_id, @name, @type, @identity_id, @cue, @craving, @response,
        @reward, @intention_time, @intention_location, @gateway_text, @schedule,
        @visibility)`,
    { ...input, owner_id: userId },
  );
  const habitId = Number(info.lastInsertRowid);
  await dbRun(
    "INSERT INTO habit_members (habit_id, user_id, role) VALUES (?, ?, 'owner')",
    [habitId, userId],
  );
  return habitId;
}

export async function updateHabit(id: number, userId: number, input: HabitInput): Promise<void> {
  await assertCanEdit(id, userId);
  await dbRun(
    `UPDATE habits SET
        name=@name, type=@type, identity_id=@identity_id, cue=@cue,
        craving=@craving, response=@response, reward=@reward,
        intention_time=@intention_time, intention_location=@intention_location,
        gateway_text=@gateway_text, schedule=@schedule, visibility=@visibility
       WHERE id=@id`,
    { ...input, id },
  );
}

export async function setArchived(id: number, userId: number, archived: boolean): Promise<void> {
  const h = await assertCanEdit(id, userId);
  if (h.owner_id !== userId) throw new AuthzError("Only the owner can archive");
  await dbRun("UPDATE habits SET archived = ? WHERE id = ?", [archived ? 1 : 0, id]);
}

// ======================================================================
// Completions  (per user, per habit, per day)
// ======================================================================

export async function completionDates(habitId: number, userId: number): Promise<string[]> {
  const rows = await dbAll<{ date: string }>(
    "SELECT date FROM completions WHERE habit_id = ? AND user_id = ? ORDER BY date",
    [habitId, userId],
  );
  return rows.map((r) => r.date);
}

export async function completionSet(habitId: number, userId: number): Promise<Set<string>> {
  return new Set(await completionDates(habitId, userId));
}

export async function isDone(habitId: number, userId: number, date: string): Promise<boolean> {
  return !!(await dbGet(
    "SELECT 1 FROM completions WHERE habit_id = ? AND user_id = ? AND date = ?",
    [habitId, userId, date],
  ));
}

// Toggle the acting user's completion. Requires membership.
export async function toggleCompletion(
  habitId: number,
  userId: number,
  date: string,
  isGateway = false,
): Promise<boolean> {
  await assertCanEdit(habitId, userId);
  if (await isDone(habitId, userId, date)) {
    await dbRun(
      "DELETE FROM completions WHERE habit_id = ? AND user_id = ? AND date = ?",
      [habitId, userId, date],
    );
    return false;
  }
  await dbRun(
    "INSERT INTO completions (habit_id, user_id, date, is_gateway) VALUES (?, ?, ?, ?)",
    [habitId, userId, date, isGateway ? 1 : 0],
  );
  return true;
}

// ======================================================================
// Stats
// ======================================================================

export async function statsFor(
  habit: Habit,
  userId: number,
  today = todayStr(),
): Promise<HabitStats> {
  const schedule: Schedule = parseSchedule(habit.schedule);
  const done = await completionSet(habit.id, userId);
  const frozen = await freezesFor(habit.id, userId);
  const since = await habitStartDate(habit.id);
  return {
    streak: currentStreak(schedule, done, today, frozen),
    consistency: consistencyScore(schedule, done, today, 30, frozen, since),
    recovery: recoveryRate(schedule, done, today, 90, since),
    missedTwice: missedTwiceActive(schedule, done, today, frozen, since),
    due: isDueToday(schedule, done, today, frozen),
    totalVotes: done.size,
  };
}

// The date this habit was created. Scoring never looks before it, so days
// before the habit existed don't count as misses.
export async function habitStartDate(habitId: number): Promise<string> {
  const row = await dbGet<{ created_at?: string }>(
    `SELECT created_at FROM habits WHERE id = ?`,
    [habitId],
  );
  const start = (row?.created_at ?? todayStr()).slice(0, 10);
  const t = todayStr();
  return start > t ? t : start; // never floor scoring in the future
}

// ======================================================================
// Members / paired habits
// ======================================================================

export interface Member {
  user_id: number;
  name: string;
  role: string;
}

export async function membersOf(habitId: number): Promise<Member[]> {
  return dbAll<Member>(
    `SELECT m.user_id, u.name, m.role FROM habit_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.habit_id = ? ORDER BY m.role DESC, u.name`,
    [habitId],
  );
}

export async function isPaired(habitId: number): Promise<boolean> {
  const row = await dbGet<{ n: number }>(
    "SELECT COUNT(*) AS n FROM habit_members WHERE habit_id = ?",
    [habitId],
  );
  return Number(row?.n ?? 0) > 1;
}

// Owner invites a partner who must be an accepted connection.
export async function addPartner(
  habitId: number,
  ownerId: number,
  partnerId: number,
): Promise<void> {
  const h = await assertCanEdit(habitId, ownerId);
  if (h.owner_id !== ownerId) throw new AuthzError("Only the owner can invite");
  if (!(await areConnected(ownerId, partnerId)))
    throw new AuthzError("You can only pair with a connection");
  await dbRun(
    "INSERT OR IGNORE INTO habit_members (habit_id, user_id, role) VALUES (?, ?, 'partner')",
    [habitId, partnerId],
  );
}

// ======================================================================
// Connections
// ======================================================================

export interface ConnectionRow {
  id: number;
  user_id: number;
  name: string;
  email: string;
  status: string;
}

export async function requestConnection(fromId: number, toEmail: string): Promise<string> {
  const target = await dbGet<{ id: number }>(
    "SELECT id FROM users WHERE email = ?",
    [toEmail.trim().toLowerCase()],
  );
  if (!target) return "No user with that email.";
  if (Number(target.id) === fromId) return "That's you.";
  if (await areConnected(fromId, Number(target.id))) return "Already connected.";
  // accept silently if they already requested you
  const reverse = await dbGet<{ id: number }>(
    "SELECT id FROM connections WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'",
    [Number(target.id), fromId],
  );
  if (reverse) {
    await dbRun("UPDATE connections SET status = 'accepted' WHERE id = ?", [Number(reverse.id)]);
    return "Connected!";
  }
  await dbRun(
    "INSERT OR IGNORE INTO connections (requester_id, addressee_id) VALUES (?, ?)",
    [fromId, Number(target.id)],
  );
  return "Request sent.";
}

export async function acceptConnection(connId: number, userId: number): Promise<void> {
  await dbRun(
    "UPDATE connections SET status = 'accepted' WHERE id = ? AND addressee_id = ?",
    [connId, userId],
  );
}

export async function listConnections(userId: number): Promise<ConnectionRow[]> {
  return dbAll<ConnectionRow>(
    `SELECT c.id,
              u.id AS user_id, u.name, u.email, c.status
       FROM connections c
       JOIN users u ON u.id = CASE WHEN c.requester_id = ? THEN c.addressee_id ELSE c.requester_id END
       WHERE (c.requester_id = ? OR c.addressee_id = ?) AND c.status = 'accepted'
       ORDER BY u.name`,
    [userId, userId, userId],
  );
}

export async function pendingIncoming(userId: number): Promise<ConnectionRow[]> {
  return dbAll<ConnectionRow>(
    `SELECT c.id, u.id AS user_id, u.name, u.email, c.status
       FROM connections c JOIN users u ON u.id = c.requester_id
       WHERE c.addressee_id = ? AND c.status = 'pending' ORDER BY u.name`,
    [userId],
  );
}

// Habits of a connection that the viewer is allowed to see (visibility=connections).
export async function visibleHabitsOf(ownerId: number, viewerId: number): Promise<Habit[]> {
  if (!(await areConnected(ownerId, viewerId))) return [];
  return dbAll<Habit>(
    `SELECT h.* FROM habits h
       JOIN habit_members m ON m.habit_id = h.id AND m.user_id = ? AND m.role = 'owner'
       WHERE h.archived = 0 AND h.visibility = 'connections'
       ORDER BY h.name`,
    [ownerId],
  );
}

// ======================================================================
// Stacks / bundles / environment / contract  (per habit; callers assert access)
// ======================================================================

export interface StackRow {
  id: number;
  anchor_habit_id: number;
  stacked_habit_id: number;
  anchor_name: string;
  stacked_name: string;
}

export async function stacksInvolving(habitId: number): Promise<StackRow[]> {
  return dbAll<StackRow>(
    `SELECT s.id, s.anchor_habit_id, s.stacked_habit_id,
              a.name AS anchor_name, b.name AS stacked_name
       FROM habit_stacks s
       JOIN habits a ON a.id = s.anchor_habit_id
       JOIN habits b ON b.id = s.stacked_habit_id
       WHERE s.anchor_habit_id = ? OR s.stacked_habit_id = ?`,
    [habitId, habitId],
  );
}

export async function addStack(anchorId: number, stackedId: number): Promise<void> {
  if (anchorId === stackedId) return;
  await dbRun(
    "INSERT OR IGNORE INTO habit_stacks (anchor_habit_id, stacked_habit_id) VALUES (?, ?)",
    [anchorId, stackedId],
  );
}

export async function removeStack(id: number): Promise<void> {
  await dbRun("DELETE FROM habit_stacks WHERE id = ?", [id]);
}

export interface Bundle {
  id: number;
  habit_id: number;
  want_text: string;
}

export async function bundlesFor(habitId: number): Promise<Bundle[]> {
  return dbAll<Bundle>("SELECT * FROM temptation_bundles WHERE habit_id = ?", [habitId]);
}

export async function addBundle(habitId: number, wantText: string): Promise<void> {
  await dbRun("INSERT INTO temptation_bundles (habit_id, want_text) VALUES (?, ?)", [
    habitId,
    wantText,
  ]);
}

export async function removeBundle(id: number): Promise<void> {
  await dbRun("DELETE FROM temptation_bundles WHERE id = ?", [id]);
}

export interface EnvItem {
  id: number;
  habit_id: number;
  text: string;
  kind: "obvious" | "friction";
}

export async function envFor(habitId: number): Promise<EnvItem[]> {
  return dbAll<EnvItem>(
    "SELECT * FROM environment_items WHERE habit_id = ? ORDER BY id",
    [habitId],
  );
}

export async function addEnvItem(
  habitId: number,
  text: string,
  kind: "obvious" | "friction",
): Promise<void> {
  await dbRun("INSERT INTO environment_items (habit_id, text, kind) VALUES (?, ?, ?)", [
    habitId,
    text,
    kind,
  ]);
}

export async function removeEnvItem(id: number): Promise<void> {
  await dbRun("DELETE FROM environment_items WHERE id = ?", [id]);
}

export interface Contract {
  habit_id: number;
  commitment: string;
  stake: string | null;
  consequence: string | null;
  partner_name: string | null;
  partner_user_id: number | null;
}

export async function contractFor(habitId: number): Promise<Contract | undefined> {
  return dbGet<Contract>("SELECT * FROM contracts WHERE habit_id = ?", [habitId]);
}

export async function upsertContract(c: Contract): Promise<void> {
  await dbRun(
    `INSERT INTO contracts (habit_id, commitment, stake, consequence, partner_name, partner_user_id)
       VALUES (@habit_id, @commitment, @stake, @consequence, @partner_name, @partner_user_id)
       ON CONFLICT(habit_id) DO UPDATE SET
         commitment=@commitment, stake=@stake, consequence=@consequence,
         partner_name=@partner_name, partner_user_id=@partner_user_id`,
    { ...c },
  );
}

// Habits where the given user is the accountability partner (people counting on them).
export interface BackingRow {
  habit: Habit;
  owner_name: string;
  commitment: string;
}
export async function listBacking(userId: number): Promise<BackingRow[]> {
  const rows = await dbAll<Habit & { owner_name: string; commitment: string }>(
    `SELECT h.*, u.name AS owner_name, c.commitment AS commitment
       FROM contracts c
       JOIN habits h ON h.id = c.habit_id
       JOIN users u ON u.id = h.owner_id
       WHERE c.partner_user_id = ? AND h.archived = 0
       ORDER BY u.name`,
    [userId],
  );
  return rows.map(({ owner_name, commitment, ...habit }) => ({
    habit: habit as Habit,
    owner_name,
    commitment,
  }));
}

// ======================================================================
// Gamification (XP derived from activity; badges persisted on unlock)
// ======================================================================

export async function userTotalCheckins(userId: number): Promise<number> {
  const row = await dbGet<{ n: number }>(
    "SELECT COUNT(*) AS n FROM completions WHERE user_id = ?",
    [userId],
  );
  return Number(row?.n ?? 0);
}

export async function userXp(userId: number): Promise<number> {
  let streakSum = 0;
  for (const h of await listHabits(userId, true)) streakSum += (await statsFor(h, userId)).streak;
  return computeXp(await userTotalCheckins(userId), streakSum);
}

export async function badgeContext(userId: number): Promise<BadgeCtx> {
  const habits = await listHabits(userId, true);
  let maxStreak = 0;
  let hasRecovery = false;
  let paired = false;
  for (const h of habits) {
    const s = await statsFor(h, userId);
    if (s.streak > maxStreak) maxStreak = s.streak;
    if (s.recovery != null && s.recovery > 0) hasRecovery = true;
    if (await isPaired(h.id)) paired = true;
  }
  return {
    habitCount: habits.length,
    totalCheckins: await userTotalCheckins(userId),
    maxStreak,
    hasRecovery,
    paired,
  };
}

export interface Achievement {
  key: string;
  earned_at: string;
}
export async function listAchievements(userId: number): Promise<Achievement[]> {
  return dbAll<Achievement>(
    "SELECT key, earned_at FROM achievements WHERE user_id = ? ORDER BY earned_at DESC",
    [userId],
  );
}

// Evaluate + persist any newly-earned badges; returns the newly unlocked keys.
export async function unlockBadges(userId: number): Promise<string[]> {
  const earned = earnedBadgeKeys(await badgeContext(userId));
  const have = new Set((await listAchievements(userId)).map((a) => a.key));
  const fresh = earned.filter((k) => !have.has(k));
  for (const k of fresh) {
    await dbRun("INSERT OR IGNORE INTO achievements (user_id, key) VALUES (?, ?)", [userId, k]);
  }
  if (fresh.length) {
    await ensureFreezeRow(userId);
    await dbRun("UPDATE freeze_credits SET earned = earned + ? WHERE user_id = ?", [
      fresh.length,
      userId,
    ]);
  }
  return fresh;
}

// ---- streak freezes (power-ups) ----
export async function freezesFor(habitId: number, userId: number): Promise<Set<string>> {
  const rows = await dbAll<{ date: string }>(
    "SELECT date FROM streak_freezes WHERE habit_id = ? AND user_id = ?",
    [habitId, userId],
  );
  return new Set(rows.map((r) => r.date));
}

async function ensureFreezeRow(userId: number): Promise<void> {
  await dbRun("INSERT OR IGNORE INTO freeze_credits (user_id, earned) VALUES (?, 2)", [userId]);
}

export async function availableFreezes(userId: number): Promise<number> {
  await ensureFreezeRow(userId);
  const earnedRow = await dbGet<{ earned: number }>(
    "SELECT earned FROM freeze_credits WHERE user_id = ?",
    [userId],
  );
  const earned = Number(earnedRow?.earned ?? 0);
  const usedRow = await dbGet<{ n: number }>(
    "SELECT COUNT(*) AS n FROM streak_freezes WHERE user_id = ?",
    [userId],
  );
  const used = Number(usedRow?.n ?? 0);
  return Math.max(0, earned - used);
}

// Spend a freeze to protect one scheduled day from counting as a miss.
export async function spendFreeze(habitId: number, userId: number, date: string): Promise<boolean> {
  await assertCanEdit(habitId, userId);
  if ((await availableFreezes(userId)) <= 0) return false;
  await dbRun(
    "INSERT OR IGNORE INTO streak_freezes (user_id, habit_id, date) VALUES (?, ?, ?)",
    [userId, habitId, date],
  );
  return true;
}

// The most recent past scheduled day that was missed and not already frozen.
export async function lastMissedDay(habit: Habit, userId: number): Promise<string | null> {
  const schedule = parseSchedule(habit.schedule);
  const done = await completionSet(habit.id, userId);
  const frozen = await freezesFor(habit.id, userId);
  const today = todayStr();
  const days = scheduledDaysBetween(addDays(today, -30), today, schedule).filter(
    (d) => d < today && !done.has(d) && !frozen.has(d),
  );
  return days.length ? days[days.length - 1] : null;
}

// ---- leaderboard (you + connections, ranked by XP) ----
export interface LeaderRow {
  user_id: number;
  name: string;
  xp: number;
  me: boolean;
}
export async function leaderboard(userId: number): Promise<LeaderRow[]> {
  const rows: LeaderRow[] = [];
  const me = await getUserById(userId);
  if (me) rows.push({ user_id: userId, name: me.name, xp: await userXp(userId), me: true });
  for (const c of await listConnections(userId)) {
    rows.push({ user_id: c.user_id, name: c.name, xp: await userXp(c.user_id), me: false });
  }
  rows.sort((a, b) => b.xp - a.xp);
  return rows;
}

// ---- head-to-head challenges ----
export interface Challenge {
  id: number;
  a_user_id: number;
  b_user_id: number;
  metric: string;
  starts_on: string;
  ends_on: string;
  status: string;
}

export async function createChallenge(fromId: number, toId: number, days: number): Promise<void> {
  if (fromId === toId || !(await areConnected(fromId, toId))) throw new AuthzError();
  const start = todayStr();
  const end = addDays(start, Math.max(1, days) - 1);
  await dbRun(
    "INSERT INTO challenges (a_user_id, b_user_id, starts_on, ends_on, status) VALUES (?, ?, ?, ?, 'pending')",
    [fromId, toId, start, end],
  );
}

export async function respondChallenge(id: number, userId: number, accept: boolean): Promise<void> {
  await dbRun(
    "UPDATE challenges SET status = ? WHERE id = ? AND b_user_id = ? AND status = 'pending'",
    [accept ? "active" : "declined", id, userId],
  );
}

export async function listChallenges(userId: number): Promise<Challenge[]> {
  return dbAll<Challenge>(
    "SELECT * FROM challenges WHERE a_user_id = ? OR b_user_id = ? ORDER BY ends_on DESC",
    [userId, userId],
  );
}

// check-ins by a user within [start, end] inclusive — the challenge metric.
export async function checkinsBetween(userId: number, start: string, end: string): Promise<number> {
  const row = await dbGet<{ n: number }>(
    "SELECT COUNT(*) AS n FROM completions WHERE user_id = ? AND date >= ? AND date <= ?",
    [userId, start, end],
  );
  return Number(row?.n ?? 0);
}
