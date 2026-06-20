import "server-only";
import { getDb } from "./db";
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

export function isMember(habitId: number, userId: number): boolean {
  return !!getDb()
    .prepare("SELECT 1 FROM habit_members WHERE habit_id = ? AND user_id = ?")
    .get(habitId, userId);
}

export function areConnected(a: number, b: number): boolean {
  if (a === b) return true;
  return !!getDb()
    .prepare(
      `SELECT 1 FROM connections
       WHERE status = 'accepted'
         AND ((requester_id = ? AND addressee_id = ?)
           OR (requester_id = ? AND addressee_id = ?))`,
    )
    .get(a, b, b, a);
}

// View: member, or a connection when the habit is shared to connections.
export function canView(habit: Habit, userId: number): boolean {
  if (isMember(habit.id, userId)) return true;
  return habit.visibility === "connections" && areConnected(habit.owner_id, userId);
}

// Edit/complete: members only (owner + invited partners).
export function canEdit(habit: Habit, userId: number): boolean {
  return isMember(habit.id, userId);
}

function rawHabit(id: number): Habit | undefined {
  return getDb().prepare("SELECT * FROM habits WHERE id = ?").get(id) as
    | Habit
    | undefined;
}

export function assertCanView(habitId: number, userId: number): Habit {
  const h = rawHabit(habitId);
  if (!h || !canView(h, userId)) throw new AuthzError();
  return h;
}

export function assertCanEdit(habitId: number, userId: number): Habit {
  const h = rawHabit(habitId);
  if (!h || !canEdit(h, userId)) throw new AuthzError();
  return h;
}

// ======================================================================
// Identities  (scoped to owner)
// ======================================================================

export function listIdentities(userId: number): Identity[] {
  return getDb()
    .prepare("SELECT * FROM identities WHERE owner_id = ? ORDER BY name")
    .all(userId) as Identity[];
}

export function getIdentity(id: number, userId: number): Identity | undefined {
  return getDb()
    .prepare("SELECT * FROM identities WHERE id = ? AND owner_id = ?")
    .get(id, userId) as Identity | undefined;
}

export function createIdentity(
  userId: number,
  name: string,
  statement: string,
): number {
  const info = getDb()
    .prepare("INSERT INTO identities (owner_id, name, statement) VALUES (?, ?, ?)")
    .run(userId, name, statement);
  return Number(info.lastInsertRowid);
}

// Votes = the owner's completions on habits tied to this identity.
export function identityVotes(identityId: number, ownerId: number): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM completions c
       JOIN habits h ON h.id = c.habit_id
       WHERE h.identity_id = ? AND c.user_id = ?`,
    )
    .get(identityId, ownerId) as { n: number };
  return row.n;
}

// ======================================================================
// Habits  (membership-based)
// ======================================================================

// Habits the user participates in (owner or invited partner).
export function listHabits(userId: number, includeArchived = false): Habit[] {
  const sql = `SELECT h.* FROM habits h
     JOIN habit_members m ON m.habit_id = h.id AND m.user_id = ?
     ${includeArchived ? "" : "WHERE h.archived = 0"}
     ORDER BY h.archived, h.name`;
  return getDb().prepare(sql).all(userId) as Habit[];
}

// A habit the user is allowed to VIEW (throws otherwise).
export function getHabit(id: number, userId: number): Habit {
  return assertCanView(id, userId);
}

export function createHabit(userId: number, input: HabitInput): number {
  const db = getDb();
  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO habits
         (owner_id, name, type, identity_id, cue, craving, response, reward,
          intention_time, intention_location, gateway_text, schedule, visibility)
         VALUES (@owner_id, @name, @type, @identity_id, @cue, @craving, @response,
          @reward, @intention_time, @intention_location, @gateway_text, @schedule,
          @visibility)`,
      )
      .run({ ...input, owner_id: userId });
    const habitId = Number(info.lastInsertRowid);
    db.prepare(
      "INSERT INTO habit_members (habit_id, user_id, role) VALUES (?, ?, 'owner')",
    ).run(habitId, userId);
    return habitId;
  });
  return tx();
}

export function updateHabit(id: number, userId: number, input: HabitInput): void {
  assertCanEdit(id, userId);
  getDb()
    .prepare(
      `UPDATE habits SET
        name=@name, type=@type, identity_id=@identity_id, cue=@cue,
        craving=@craving, response=@response, reward=@reward,
        intention_time=@intention_time, intention_location=@intention_location,
        gateway_text=@gateway_text, schedule=@schedule, visibility=@visibility
       WHERE id=@id`,
    )
    .run({ ...input, id });
}

export function setArchived(id: number, userId: number, archived: boolean): void {
  const h = assertCanEdit(id, userId);
  if (h.owner_id !== userId) throw new AuthzError("Only the owner can archive");
  getDb()
    .prepare("UPDATE habits SET archived = ? WHERE id = ?")
    .run(archived ? 1 : 0, id);
}

// ======================================================================
// Completions  (per user, per habit, per day)
// ======================================================================

export function completionDates(habitId: number, userId: number): string[] {
  const rows = getDb()
    .prepare(
      "SELECT date FROM completions WHERE habit_id = ? AND user_id = ? ORDER BY date",
    )
    .all(habitId, userId) as { date: string }[];
  return rows.map((r) => r.date);
}

export function completionSet(habitId: number, userId: number): Set<string> {
  return new Set(completionDates(habitId, userId));
}

export function isDone(habitId: number, userId: number, date: string): boolean {
  return !!getDb()
    .prepare(
      "SELECT 1 FROM completions WHERE habit_id = ? AND user_id = ? AND date = ?",
    )
    .get(habitId, userId, date);
}

// Toggle the acting user's completion. Requires membership.
export function toggleCompletion(
  habitId: number,
  userId: number,
  date: string,
  isGateway = false,
): boolean {
  assertCanEdit(habitId, userId);
  const db = getDb();
  if (isDone(habitId, userId, date)) {
    db.prepare(
      "DELETE FROM completions WHERE habit_id = ? AND user_id = ? AND date = ?",
    ).run(habitId, userId, date);
    return false;
  }
  db.prepare(
    "INSERT INTO completions (habit_id, user_id, date, is_gateway) VALUES (?, ?, ?, ?)",
  ).run(habitId, userId, date, isGateway ? 1 : 0);
  return true;
}

// ======================================================================
// Stats
// ======================================================================

export function statsFor(
  habit: Habit,
  userId: number,
  today = todayStr(),
): HabitStats {
  const schedule: Schedule = parseSchedule(habit.schedule);
  const done = completionSet(habit.id, userId);
  const frozen = freezesFor(habit.id, userId);
  const since = habitStartDate(habit.id);
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
export function habitStartDate(habitId: number): string {
  const row = getDb()
    .prepare(`SELECT created_at FROM habits WHERE id = ?`)
    .get(habitId) as { created_at?: string } | undefined;
  return (row?.created_at ?? todayStr()).slice(0, 10);
}

// ======================================================================
// Members / paired habits
// ======================================================================

export interface Member {
  user_id: number;
  name: string;
  role: string;
}

export function membersOf(habitId: number): Member[] {
  return getDb()
    .prepare(
      `SELECT m.user_id, u.name, m.role FROM habit_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.habit_id = ? ORDER BY m.role DESC, u.name`,
    )
    .all(habitId) as Member[];
}

export function isPaired(habitId: number): boolean {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS n FROM habit_members WHERE habit_id = ?")
    .get(habitId) as { n: number };
  return row.n > 1;
}

// Owner invites a partner who must be an accepted connection.
export function addPartner(
  habitId: number,
  ownerId: number,
  partnerId: number,
): void {
  const h = assertCanEdit(habitId, ownerId);
  if (h.owner_id !== ownerId) throw new AuthzError("Only the owner can invite");
  if (!areConnected(ownerId, partnerId))
    throw new AuthzError("You can only pair with a connection");
  getDb()
    .prepare(
      "INSERT OR IGNORE INTO habit_members (habit_id, user_id, role) VALUES (?, ?, 'partner')",
    )
    .run(habitId, partnerId);
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

export function requestConnection(fromId: number, toEmail: string): string {
  const db = getDb();
  const target = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(toEmail.trim().toLowerCase()) as { id: number } | undefined;
  if (!target) return "No user with that email.";
  if (target.id === fromId) return "That's you.";
  if (areConnected(fromId, target.id)) return "Already connected.";
  // accept silently if they already requested you
  const reverse = db
    .prepare(
      "SELECT id FROM connections WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'",
    )
    .get(target.id, fromId) as { id: number } | undefined;
  if (reverse) {
    db.prepare("UPDATE connections SET status = 'accepted' WHERE id = ?").run(reverse.id);
    return "Connected!";
  }
  db.prepare(
    "INSERT OR IGNORE INTO connections (requester_id, addressee_id) VALUES (?, ?)",
  ).run(fromId, target.id);
  return "Request sent.";
}

export function acceptConnection(connId: number, userId: number): void {
  getDb()
    .prepare(
      "UPDATE connections SET status = 'accepted' WHERE id = ? AND addressee_id = ?",
    )
    .run(connId, userId);
}

export function listConnections(userId: number): ConnectionRow[] {
  return getDb()
    .prepare(
      `SELECT c.id,
              u.id AS user_id, u.name, u.email, c.status
       FROM connections c
       JOIN users u ON u.id = CASE WHEN c.requester_id = ? THEN c.addressee_id ELSE c.requester_id END
       WHERE (c.requester_id = ? OR c.addressee_id = ?) AND c.status = 'accepted'
       ORDER BY u.name`,
    )
    .all(userId, userId, userId) as ConnectionRow[];
}

export function pendingIncoming(userId: number): ConnectionRow[] {
  return getDb()
    .prepare(
      `SELECT c.id, u.id AS user_id, u.name, u.email, c.status
       FROM connections c JOIN users u ON u.id = c.requester_id
       WHERE c.addressee_id = ? AND c.status = 'pending' ORDER BY u.name`,
    )
    .all(userId) as ConnectionRow[];
}

// Habits of a connection that the viewer is allowed to see (visibility=connections).
export function visibleHabitsOf(ownerId: number, viewerId: number): Habit[] {
  if (!areConnected(ownerId, viewerId)) return [];
  return getDb()
    .prepare(
      `SELECT h.* FROM habits h
       JOIN habit_members m ON m.habit_id = h.id AND m.user_id = ? AND m.role = 'owner'
       WHERE h.archived = 0 AND h.visibility = 'connections'
       ORDER BY h.name`,
    )
    .all(ownerId) as Habit[];
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

export function stacksInvolving(habitId: number): StackRow[] {
  return getDb()
    .prepare(
      `SELECT s.id, s.anchor_habit_id, s.stacked_habit_id,
              a.name AS anchor_name, b.name AS stacked_name
       FROM habit_stacks s
       JOIN habits a ON a.id = s.anchor_habit_id
       JOIN habits b ON b.id = s.stacked_habit_id
       WHERE s.anchor_habit_id = ? OR s.stacked_habit_id = ?`,
    )
    .all(habitId, habitId) as StackRow[];
}

export function addStack(anchorId: number, stackedId: number): void {
  if (anchorId === stackedId) return;
  getDb()
    .prepare(
      "INSERT OR IGNORE INTO habit_stacks (anchor_habit_id, stacked_habit_id) VALUES (?, ?)",
    )
    .run(anchorId, stackedId);
}

export function removeStack(id: number): void {
  getDb().prepare("DELETE FROM habit_stacks WHERE id = ?").run(id);
}

export interface Bundle {
  id: number;
  habit_id: number;
  want_text: string;
}

export function bundlesFor(habitId: number): Bundle[] {
  return getDb()
    .prepare("SELECT * FROM temptation_bundles WHERE habit_id = ?")
    .all(habitId) as Bundle[];
}

export function addBundle(habitId: number, wantText: string): void {
  getDb()
    .prepare("INSERT INTO temptation_bundles (habit_id, want_text) VALUES (?, ?)")
    .run(habitId, wantText);
}

export function removeBundle(id: number): void {
  getDb().prepare("DELETE FROM temptation_bundles WHERE id = ?").run(id);
}

export interface EnvItem {
  id: number;
  habit_id: number;
  text: string;
  kind: "obvious" | "friction";
}

export function envFor(habitId: number): EnvItem[] {
  return getDb()
    .prepare("SELECT * FROM environment_items WHERE habit_id = ? ORDER BY id")
    .all(habitId) as EnvItem[];
}

export function addEnvItem(
  habitId: number,
  text: string,
  kind: "obvious" | "friction",
): void {
  getDb()
    .prepare("INSERT INTO environment_items (habit_id, text, kind) VALUES (?, ?, ?)")
    .run(habitId, text, kind);
}

export function removeEnvItem(id: number): void {
  getDb().prepare("DELETE FROM environment_items WHERE id = ?").run(id);
}

export interface Contract {
  habit_id: number;
  commitment: string;
  stake: string | null;
  consequence: string | null;
  partner_name: string | null;
  partner_user_id: number | null;
}

export function contractFor(habitId: number): Contract | undefined {
  return getDb()
    .prepare("SELECT * FROM contracts WHERE habit_id = ?")
    .get(habitId) as Contract | undefined;
}

export function upsertContract(c: Contract): void {
  getDb()
    .prepare(
      `INSERT INTO contracts (habit_id, commitment, stake, consequence, partner_name, partner_user_id)
       VALUES (@habit_id, @commitment, @stake, @consequence, @partner_name, @partner_user_id)
       ON CONFLICT(habit_id) DO UPDATE SET
         commitment=@commitment, stake=@stake, consequence=@consequence,
         partner_name=@partner_name, partner_user_id=@partner_user_id`,
    )
    .run(c);
}

// Habits where the given user is the accountability partner (people counting on them).
export interface BackingRow {
  habit: Habit;
  owner_name: string;
  commitment: string;
}
export function listBacking(userId: number): BackingRow[] {
  const rows = getDb()
    .prepare(
      `SELECT h.*, u.name AS owner_name, c.commitment AS commitment
       FROM contracts c
       JOIN habits h ON h.id = c.habit_id
       JOIN users u ON u.id = h.owner_id
       WHERE c.partner_user_id = ? AND h.archived = 0
       ORDER BY u.name`,
    )
    .all(userId) as (Habit & { owner_name: string; commitment: string })[];
  return rows.map(({ owner_name, commitment, ...habit }) => ({
    habit: habit as Habit,
    owner_name,
    commitment,
  }));
}

// ======================================================================
// Gamification (XP derived from activity; badges persisted on unlock)
// ======================================================================

export function userTotalCheckins(userId: number): number {
  return (
    getDb()
      .prepare("SELECT COUNT(*) AS n FROM completions WHERE user_id = ?")
      .get(userId) as { n: number }
  ).n;
}

export function userXp(userId: number): number {
  let streakSum = 0;
  for (const h of listHabits(userId, true)) streakSum += statsFor(h, userId).streak;
  return computeXp(userTotalCheckins(userId), streakSum);
}

export function badgeContext(userId: number): BadgeCtx {
  const habits = listHabits(userId, true);
  let maxStreak = 0;
  let hasRecovery = false;
  let paired = false;
  for (const h of habits) {
    const s = statsFor(h, userId);
    if (s.streak > maxStreak) maxStreak = s.streak;
    if (s.recovery != null && s.recovery > 0) hasRecovery = true;
    if (isPaired(h.id)) paired = true;
  }
  return {
    habitCount: habits.length,
    totalCheckins: userTotalCheckins(userId),
    maxStreak,
    hasRecovery,
    paired,
  };
}

export interface Achievement {
  key: string;
  earned_at: string;
}
export function listAchievements(userId: number): Achievement[] {
  return getDb()
    .prepare("SELECT key, earned_at FROM achievements WHERE user_id = ? ORDER BY earned_at DESC")
    .all(userId) as Achievement[];
}

// Evaluate + persist any newly-earned badges; returns the newly unlocked keys.
export function unlockBadges(userId: number): string[] {
  const earned = earnedBadgeKeys(badgeContext(userId));
  const have = new Set(listAchievements(userId).map((a) => a.key));
  const fresh = earned.filter((k) => !have.has(k));
  const ins = getDb().prepare(
    "INSERT OR IGNORE INTO achievements (user_id, key) VALUES (?, ?)",
  );
  for (const k of fresh) ins.run(userId, k);
  if (fresh.length) {
    ensureFreezeRow(userId);
    getDb()
      .prepare("UPDATE freeze_credits SET earned = earned + ? WHERE user_id = ?")
      .run(fresh.length, userId);
  }
  return fresh;
}

// ---- streak freezes (power-ups) ----
export function freezesFor(habitId: number, userId: number): Set<string> {
  const rows = getDb()
    .prepare("SELECT date FROM streak_freezes WHERE habit_id = ? AND user_id = ?")
    .all(habitId, userId) as { date: string }[];
  return new Set(rows.map((r) => r.date));
}

function ensureFreezeRow(userId: number): void {
  getDb()
    .prepare("INSERT OR IGNORE INTO freeze_credits (user_id, earned) VALUES (?, 2)")
    .run(userId);
}

export function availableFreezes(userId: number): number {
  ensureFreezeRow(userId);
  const earned = (
    getDb().prepare("SELECT earned FROM freeze_credits WHERE user_id = ?").get(userId) as {
      earned: number;
    }
  ).earned;
  const used = (
    getDb()
      .prepare("SELECT COUNT(*) AS n FROM streak_freezes WHERE user_id = ?")
      .get(userId) as { n: number }
  ).n;
  return Math.max(0, earned - used);
}

// Spend a freeze to protect one scheduled day from counting as a miss.
export function spendFreeze(habitId: number, userId: number, date: string): boolean {
  assertCanEdit(habitId, userId);
  if (availableFreezes(userId) <= 0) return false;
  getDb()
    .prepare("INSERT OR IGNORE INTO streak_freezes (user_id, habit_id, date) VALUES (?, ?, ?)")
    .run(userId, habitId, date);
  return true;
}

// The most recent past scheduled day that was missed and not already frozen.
export function lastMissedDay(habit: Habit, userId: number): string | null {
  const schedule = parseSchedule(habit.schedule);
  const done = completionSet(habit.id, userId);
  const frozen = freezesFor(habit.id, userId);
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
export function leaderboard(userId: number): LeaderRow[] {
  const rows: LeaderRow[] = [];
  const me = getUserById(userId);
  if (me) rows.push({ user_id: userId, name: me.name, xp: userXp(userId), me: true });
  for (const c of listConnections(userId)) {
    rows.push({ user_id: c.user_id, name: c.name, xp: userXp(c.user_id), me: false });
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

export function createChallenge(fromId: number, toId: number, days: number): void {
  if (fromId === toId || !areConnected(fromId, toId)) throw new AuthzError();
  const start = todayStr();
  const end = addDays(start, Math.max(1, days) - 1);
  getDb()
    .prepare(
      "INSERT INTO challenges (a_user_id, b_user_id, starts_on, ends_on, status) VALUES (?, ?, ?, ?, 'pending')",
    )
    .run(fromId, toId, start, end);
}

export function respondChallenge(id: number, userId: number, accept: boolean): void {
  getDb()
    .prepare(
      "UPDATE challenges SET status = ? WHERE id = ? AND b_user_id = ? AND status = 'pending'",
    )
    .run(accept ? "active" : "declined", id, userId);
}

export function listChallenges(userId: number): Challenge[] {
  return getDb()
    .prepare(
      "SELECT * FROM challenges WHERE a_user_id = ? OR b_user_id = ? ORDER BY ends_on DESC",
    )
    .all(userId, userId) as Challenge[];
}

// check-ins by a user within [start, end] inclusive — the challenge metric.
export function checkinsBetween(userId: number, start: string, end: string): number {
  return (
    getDb()
      .prepare(
        "SELECT COUNT(*) AS n FROM completions WHERE user_id = ? AND date >= ? AND date <= ?",
      )
      .get(userId, start, end) as { n: number }
  ).n;
}
