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
  addTask,
  completeTask,
  deleteTask,
  homeForUser,
  type ChoreInput,
} from "@/lib/home";
import { seedStarter } from "@/lib/home-seed";
import { cadencePoints, type Cadence } from "@/lib/home-cadence";

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

function parseChore(fd: FormData): ChoreInput {
  const cadenceRaw = str(fd, "cadence") as Cadence | null;
  const cadence: Cadence = cadenceRaw && CADENCE_KEYS.has(cadenceRaw) ? cadenceRaw : "weekly";
  const assigneeRaw = str(fd, "assignee_user_id");
  const pointsRaw = str(fd, "points");
  return {
    title: reqStr(fd, "title"),
    area: str(fd, "area"),
    cadence,
    points: pointsRaw && Number.isFinite(Number(pointsRaw)) ? Math.max(0, Number(pointsRaw)) : cadencePoints(cadence),
    assignee_user_id: assigneeRaw ? Number(assigneeRaw) : null,
    rotating: str(fd, "rotating") === "1",
    conditional_note: str(fd, "conditional_note"),
    standard: str(fd, "standard"),
  };
}

// ===== home setup =====
export async function createHomeAction(fd: FormData) {
  const user = await requireUser();
  if (await homeForUser(user.id)) redirect("/home"); // already has one
  await createHome(user.id, reqStr(fd, "name"));
  revalidatePath("/home");
  redirect("/home");
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
  redirect(`/home?invite=${res}`);
}

// ===== chores =====
export async function addChoreAction(fd: FormData) {
  const user = await requireUser();
  await addChore(await requireHomeId(user.id), user.id, parseChore(fd));
  revalidatePath("/home");
  revalidatePath("/home/chores");
}

export async function updateChoreAction(fd: FormData) {
  const user = await requireUser();
  await updateChore(int(fd, "id"), user.id, parseChore(fd));
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
  await logChore(int(fd, "id"), user.id);
  revalidatePath("/home");
  revalidatePath("/home/chores");
}

// ===== ad-hoc backlog =====
export async function addTaskAction(fd: FormData) {
  const user = await requireUser();
  const pts = str(fd, "points");
  await addTask(await requireHomeId(user.id), user.id, reqStr(fd, "title"), pts ? Math.max(0, Number(pts)) : 5);
  revalidatePath("/home/tasks");
  revalidatePath("/home");
}

export async function completeTaskAction(fd: FormData) {
  const user = await requireUser();
  await completeTask(int(fd, "id"), user.id);
  revalidatePath("/home/tasks");
  revalidatePath("/home");
}

export async function deleteTaskAction(fd: FormData) {
  const user = await requireUser();
  await deleteTask(int(fd, "id"), user.id);
  revalidatePath("/home/tasks");
}
