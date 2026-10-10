"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import {
  createHome,
  addMemberByEmail,
  addChore,
  updateChore,
  deleteChore,
  logChore,
  undoChoreLog,
  skipChore,
  postponeChore,
  giveAwayChore,
  memberIds,
  addReward,
  deleteReward,
  redeemReward,
  markRedemptionGiven,
  addTask,
  setTaskDay,
  setTaskDone,
  deleteTask,
  homeForUser,
  type ChoreInput,
} from "@/lib/home";
import { seedStarter } from "@/lib/home-seed";
import { cadencePoints, nearestWeekend, type Cadence } from "@/lib/home-cadence";
import { todayStr, addDays } from "@/lib/score";

const CADENCE_KEYS = new Set<Cadence>([
  "daily", "weekly", "biweekly", "monthly", "quarterly", "semiannual", "annual", "seasonal", "adhoc",
]);

function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}
function reqStr(fd: FormData, k: string): string {
  const v = str(fd, k);
  if (!v) throw new Error(`Missing required field: ${k}`);
  return v;
}
function int(fd: FormData, k: string): number {
  return Number(str(fd, k));
}
// The acting user's home, or throw — every chore/task action is home-scoped.
async function requireHomeId(userId: number): Promise<number> {
  const h = await homeForUser(userId);
  if (!h) throw new Error("no home");
  return h.id;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function date(fd: FormData, k: string): string | null {
  const v = str(fd, k);
  return v && DATE_RE.test(v) ? v : null;
}

// Owner picker: "me" | "felles" | "turns" | a member's user id.
async function parseOwner(fd: FormData, homeId: number, userId: number): Promise<number | "felles" | "turns"> {
  const o = str(fd, "owner") ?? "me";
  if (o === "felles" || o === "turns") return o;
  if (o === "me") return userId;
  const id = Number(o);
  if (!(await memberIds(homeId)).includes(id)) throw new Error("owner is not in this home");
  return id;
}

// Day picker for Tasks and Utsett: "today" | "tomorrow" | "weekend" | "later" | "date" (+ field "date").
function parseDay(fd: FormData): string | null {
  const today = todayStr();
  switch (str(fd, "day")) {
    case "today":
      return today;
    case "tomorrow":
      return addDays(today, 1);
    case "weekend":
      return nearestWeekend(today);
    case "date":
      return date(fd, "date");
    default:
      return null; // Senere
  }
}

// Poeng: a whole number 0–1000; blank or junk → the fallback.
function pointsOr(fd: FormData, fallback: number): number {
  const n = Math.round(Number(str(fd, "points")));
  return Number.isFinite(n) && str(fd, "points") != null ? Math.max(0, Math.min(1000, n)) : fallback;
}

const UNIT_DAYS: Record<string, number> = { d: 1, w: 7, m: 30 }; // ponytail: a month is 30 days

async function parseChore(fd: FormData, homeId: number, userId: number): Promise<ChoreInput> {
  const fixed = str(fd, "rule") === "fixed";
  const cadenceRaw = str(fd, "cadence");
  const custom = cadenceRaw === "custom";
  const cadence: Cadence =
    cadenceRaw && CADENCE_KEYS.has(cadenceRaw as Cadence) ? (cadenceRaw as Cadence) : "weekly";
  const n = Math.max(1, Math.min(999, Math.floor(Number(str(fd, "every_n")) || 1)));
  const weekdays = fd
    .getAll("wd")
    .map(Number)
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  if (fixed && weekdays.length === 0) throw new Error("Velg minst én dag for Faste dager");
  const owner = await parseOwner(fd, homeId, userId);
  return {
    title: reqStr(fd, "title"),
    area: str(fd, "area"),
    cadence: fixed || custom ? "weekly" : cadence,
    every_days: !fixed && custom ? n * (UNIT_DAYS[str(fd, "unit") ?? "d"] ?? 1) : null,
    weekdays: fixed && weekdays.length ? weekdays.join(",") : null,
    every_weeks: fixed ? Math.max(1, Math.min(4, Number(str(fd, "every_weeks")) || 1)) : null,
    next_due: date(fd, "next_due"),
    points: pointsOr(fd, cadencePoints(cadence)),
    assignee_user_id: typeof owner === "number" ? owner : null,
    rotating: owner === "turns",
    conditional_note: owner === "felles" ? str(fd, "conditional_note") : null,
    standard: str(fd, "standard"),
  };
}

// Where Gjort / add lands afterwards. Allowlist: no open redirect.
const BACK = new Set(["/", "/home/tasks"]);
function backTo(fd: FormData): string | null {
  const b = str(fd, "back");
  return b && BACK.has(b) ? b : null;
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/home");
  revalidatePath("/home/chores");
}

// ===== home setup =====
export async function createHomeAction(fd: FormData) {
  const user = await requireUser();
  if (await homeForUser(user.id)) redirect("/home"); // already has one
  await createHome(user.id, reqStr(fd, "name"));
  revalidatePath("/home");
  redirect("/home/chores");
}

export async function seedStarterAction() {
  const user = await requireUser();
  await seedStarter(await requireHomeId(user.id), user.id);
  revalidatePath("/home");
  revalidatePath("/home/chores");
  redirect("/home/chores");
}

export async function addMemberAction(fd: FormData) {
  const user = await requireUser();
  const res = await addMemberByEmail(await requireHomeId(user.id), user.id, reqStr(fd, "email"));
  revalidatePath("/home");
  redirect(`/home/chores?invite=${res}`);
}

// ===== chores =====
export async function addChoreAction(fd: FormData) {
  const user = await requireUser();
  const homeId = await requireHomeId(user.id);
  await addChore(homeId, user.id, await parseChore(fd, homeId, user.id));
  revalidatePath("/home");
  revalidatePath("/home/chores");
}

export async function updateChoreAction(fd: FormData) {
  const user = await requireUser();
  const homeId = await requireHomeId(user.id);
  await updateChore(int(fd, "id"), user.id, await parseChore(fd, homeId, user.id));
  revalidatePath("/home");
  revalidatePath("/home/chores");
}

export async function deleteChoreAction(fd: FormData) {
  const user = await requireUser();
  await deleteChore(int(fd, "id"), user.id);
  revalidatePath("/home");
  revalidatePath("/home/chores");
}

export async function logChoreAction(fd: FormData) {
  const user = await requireUser();
  const logId = await logChore(int(fd, "id"), user.id);
  refresh();
  const back = backTo(fd);
  if (back) redirect(logId ? `${back}?undo=${logId}` : back);
}

export async function undoChoreAction(fd: FormData) {
  const user = await requireUser();
  await undoChoreLog(int(fd, "log"), user.id);
  refresh();
  redirect(backTo(fd) ?? "/");
}

export async function skipChoreAction(fd: FormData) {
  const user = await requireUser();
  await skipChore(int(fd, "id"), user.id);
  refresh();
}

export async function postponeChoreAction(fd: FormData) {
  const user = await requireUser();
  const day = parseDay(fd);
  if (!day) throw new Error("Pick a day");
  await postponeChore(int(fd, "id"), user.id, day);
  refresh();
}

export async function giveAwayChoreAction(fd: FormData) {
  const user = await requireUser();
  await giveAwayChore(int(fd, "id"), user.id);
  refresh();
}

// ===== ad-hoc backlog =====
export async function addTaskAction(fd: FormData) {
  const user = await requireUser();
  const homeId = await requireHomeId(user.id);
  const owner = await parseOwner(fd, homeId, user.id);
  await addTask(
    homeId,
    user.id,
    reqStr(fd, "title"),
    pointsOr(fd, 5),
    parseDay(fd),
    typeof owner === "number" ? owner : null, // a Task has no Bytter på
  );
  refresh();
  const back = backTo(fd);
  if (back) redirect(back);
}

export async function setTaskDayAction(fd: FormData) {
  const user = await requireUser();
  await setTaskDay(int(fd, "id"), user.id, parseDay(fd));
  refresh();
}

export async function completeTaskAction(fd: FormData) {
  const user = await requireUser();
  const id = int(fd, "id");
  const undo = str(fd, "undo") === "1";
  await setTaskDone(id, user.id, !undo);
  refresh();
  const back = backTo(fd);
  if (back) redirect(undo ? back : `${back}?undoTask=${id}`);
}

export async function deleteTaskAction(fd: FormData) {
  const user = await requireUser();
  await deleteTask(int(fd, "id"), user.id);
  refresh();
}

// ===== Premier: prizes bought with Home points =====
export async function addRewardAction(fd: FormData) {
  const user = await requireUser();
  const cost = Math.floor(Number(str(fd, "cost")));
  if (!Number.isFinite(cost) || cost < 1) throw new Error("Cost must be at least 1 point");
  await addReward(await requireHomeId(user.id), user.id, reqStr(fd, "title"), cost);
  revalidatePath("/home/premier");
}

export async function deleteRewardAction(fd: FormData) {
  const user = await requireUser();
  await deleteReward(int(fd, "id"), user.id);
  revalidatePath("/home/premier");
}

export async function redeemRewardAction(fd: FormData) {
  const user = await requireUser();
  const res = await redeemReward(int(fd, "id"), user.id);
  refresh();
  revalidatePath("/home/premier");
  redirect(`/home/premier?r=${res}`);
}

export async function markGivenAction(fd: FormData) {
  const user = await requireUser();
  await markRedemptionGiven(int(fd, "id"), user.id);
  refresh();
  revalidatePath("/home/premier");
}
