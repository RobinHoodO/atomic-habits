"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";
import { isUniqueViolation } from "@/lib/db-errors";
import { requireUser } from "@/lib/session";
import { createUser, getUserById } from "@/lib/users";
import {
  createIdentity,
  createHabit,
  updateHabit,
  setArchived,
  toggleCompletion,
  unlockBadges,
  getIdentity,
  assertCanEdit,
  areConnected,
  addStack,
  removeStack,
  addBundle,
  removeBundle,
  addEnvItem,
  removeEnvItem,
  upsertContract,
  requestConnection,
  acceptConnection,
  addPartner,
  createChallenge,
  respondChallenge,
  spendFreeze,
  type HabitInput,
  type HabitType,
  type Visibility,
} from "@/lib/habits";
import { todayStr } from "@/lib/score";

// ---- form helpers ----
function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}
function reqStr(fd: FormData, key: string): string {
  const v = str(fd, key);
  if (!v) throw new Error(`Missing required field: ${key}`);
  return v;
}
function num(fd: FormData, key: string): number {
  const v = str(fd, key);
  const n = v ? Number(v) : NaN;
  if (!Number.isFinite(n)) throw new Error(`Invalid number: ${key}`);
  return n;
}
function buildSchedule(fd: FormData): string {
  if (fd.get("scheduleMode") !== "weekly") return "daily";
  const days = fd.getAll("day").map((d) => Number(d)).filter((n) => n >= 0 && n <= 6);
  return days.length === 0 || days.length === 7 ? "daily" : JSON.stringify(days);
}
// identity_id comes from a form field — only keep it if it is one of the user's own identities.
async function withOwnedIdentity(input: HabitInput, userId: number): Promise<HabitInput> {
  const id = input.identity_id;
  if (id == null) return input;
  if (!Number.isInteger(id) || !(await getIdentity(id, userId))) return { ...input, identity_id: null };
  return input;
}
// Closed signup: ALLOWED_SIGNUP_EMAILS (comma list); unset/empty = open.
function signupAllowed(email: string): boolean {
  const list = (process.env.ALLOWED_SIGNUP_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.length === 0 || list.includes(email.toLowerCase());
}
function parseHabitInput(fd: FormData): HabitInput {
  const identity = str(fd, "identity_id");
  return {
    name: reqStr(fd, "name"),
    type: (str(fd, "type") ?? "good") as HabitType,
    identity_id: identity ? Number(identity) : null,
    cue: str(fd, "cue"),
    craving: str(fd, "craving"),
    response: str(fd, "response"),
    reward: str(fd, "reward"),
    intention_time: str(fd, "intention_time"),
    intention_location: str(fd, "intention_location"),
    gateway_text: str(fd, "gateway_text"),
    schedule: buildSchedule(fd),
    visibility: (str(fd, "visibility") === "connections" ? "connections" : "private") as Visibility,
  };
}

// ======================= auth =======================

export async function registerAction(fd: FormData) {
  const email = reqStr(fd, "email").toLowerCase();
  const name = reqStr(fd, "name");
  const password = reqStr(fd, "password");
  if (!signupAllowed(email)) redirect("/register?error=closed");
  if (password.length < 8) redirect("/register?error=short");

  let createUserError: unknown;
  let createUserFailed = false;
  try {
    await createUser(email, name, password);
  } catch (error) {
    createUserError = error;
    createUserFailed = true;
  }
  if (createUserFailed) {
    if (isUniqueViolation(createUserError)) {
      redirect("/register?error=exists");
    }
    console.error("Failed to create user during registration", createUserError);
    redirect("/register?error=server");
  }

  await signIn("credentials", { email, password, redirectTo: "/" });
}

export async function loginAction(fd: FormData) {
  const email = reqStr(fd, "email").toLowerCase();
  const password = reqStr(fd, "password");

  let signInError: unknown;
  let signInFailed = false;
  try {
    await signIn("credentials", { email, password, redirectTo: "/" });
  } catch (error) {
    signInError = error;
    signInFailed = true;
  }
  if (!signInFailed) return;

  if (signInError instanceof AuthError) {
    if (signInError.type === "CredentialsSignin") {
      redirect("/login?error=1");
    }
    console.error("Authentication failed during login", signInError);
    redirect("/login?error=server");
  }

  throw signInError;
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

// ======================= identities =======================

export async function createIdentityAction(fd: FormData) {
  const user = await requireUser();
  await createIdentity(user.id, reqStr(fd, "name"), reqStr(fd, "statement"));
  revalidatePath("/identities");
  redirect("/identities");
}

// ======================= habits =======================

export async function createHabitAction(fd: FormData) {
  const user = await requireUser();
  const id = await createHabit(user.id, await withOwnedIdentity(parseHabitInput(fd), user.id));
  revalidatePath("/");
  revalidatePath("/habits");
  redirect(`/habits/${id}`);
}

export async function updateHabitAction(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  await updateHabit(id, user.id, await withOwnedIdentity(parseHabitInput(fd), user.id));
  revalidatePath("/");
  revalidatePath("/habits");
  redirect(`/habits/${id}`);
}

export async function archiveHabitAction(fd: FormData) {
  const user = await requireUser();
  await setArchived(num(fd, "id"), user.id, str(fd, "archived") === "1");
  revalidatePath("/");
  revalidatePath("/habits");
  redirect("/habits");
}

export async function toggleCompletionAction(fd: FormData) {
  const user = await requireUser();
  const habitId = num(fd, "habit_id");
  // date comes from a hidden field — only trust a real ISO day, else fall back
  // to today so a garbage value can't corrupt streak math.
  const raw = str(fd, "date");
  const date = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayStr();
  await toggleCompletion(habitId, user.id, date, str(fd, "is_gateway") === "1");
  after(async () => {
    try {
      await unlockBadges(user.id);
    } catch (error) {
      console.error("unlockBadges failed", error);
    }
  });
  revalidatePath("/");
  revalidatePath(`/habits/${habitId}`);
  revalidatePath("/progress");
}

// ======================= stacks =======================

export async function addStackAction(fd: FormData) {
  const user = await requireUser();
  const anchor = num(fd, "anchor_habit_id");
  const stacked = num(fd, "stacked_habit_id");
  await assertCanEdit(anchor, user.id);
  await assertCanEdit(stacked, user.id);
  await addStack(anchor, stacked);
  revalidatePath(`/habits/${num(fd, "from")}`);
}

export async function removeStackAction(fd: FormData) {
  const user = await requireUser();
  await assertCanEdit(num(fd, "from"), user.id);
  await removeStack(num(fd, "id"), num(fd, "from"));
  revalidatePath(`/habits/${num(fd, "from")}`);
}

// ======================= bundles / env / contract =======================

export async function addBundleAction(fd: FormData) {
  const user = await requireUser();
  const habitId = num(fd, "habit_id");
  await assertCanEdit(habitId, user.id);
  await addBundle(habitId, reqStr(fd, "want_text"));
  revalidatePath(`/habits/${habitId}`);
}

export async function removeBundleAction(fd: FormData) {
  const user = await requireUser();
  const habitId = num(fd, "habit_id");
  await assertCanEdit(habitId, user.id);
  await removeBundle(num(fd, "id"), habitId);
  revalidatePath(`/habits/${habitId}`);
}

export async function addEnvItemAction(fd: FormData) {
  const user = await requireUser();
  const habitId = num(fd, "habit_id");
  await assertCanEdit(habitId, user.id);
  const kind = str(fd, "kind") === "friction" ? "friction" : "obvious";
  await addEnvItem(habitId, reqStr(fd, "text"), kind);
  revalidatePath(`/habits/${habitId}`);
}

export async function removeEnvItemAction(fd: FormData) {
  const user = await requireUser();
  const habitId = num(fd, "habit_id");
  await assertCanEdit(habitId, user.id);
  await removeEnvItem(num(fd, "id"), habitId);
  revalidatePath(`/habits/${habitId}`);
}

export async function saveContractAction(fd: FormData) {
  const user = await requireUser();
  const habitId = num(fd, "habit_id");
  const habit = await assertCanEdit(habitId, user.id);

  const partnerRaw = str(fd, "partner_user_id");
  let partnerId = partnerRaw ? Number(partnerRaw) : null;
  // only accept a partner the owner is actually connected to — a crafted POST
  // can't pin a stranger as your accountability partner.
  if (partnerId && !(await areConnected(user.id, partnerId))) partnerId = null;
  let partnerName = str(fd, "partner_name");
  if (partnerId) {
    const u = await getUserById(partnerId);
    if (u) partnerName = u.name;
  }

  await upsertContract({
    habit_id: habitId,
    commitment: reqStr(fd, "commitment"),
    stake: str(fd, "stake"),
    consequence: str(fd, "consequence"),
    partner_name: partnerName,
    partner_user_id: partnerId,
  });

  // auto-pair the partner on a shared habit so they can follow + nudge
  if (
    partnerId &&
    habit.owner_id === user.id &&
    habit.visibility === "connections" &&
    (await areConnected(user.id, partnerId))
  ) {
    await addPartner(habitId, user.id, partnerId);
  }

  revalidatePath(`/habits/${habitId}`);
  revalidatePath("/people");
}

// ======================= social =======================

export async function requestConnectionAction(fd: FormData) {
  const user = await requireUser();
  await requestConnection(user.id, reqStr(fd, "email"));
  revalidatePath("/people");
  redirect("/people");
}

export async function acceptConnectionAction(fd: FormData) {
  const user = await requireUser();
  await acceptConnection(num(fd, "id"), user.id);
  revalidatePath("/people");
}

export async function addPartnerAction(fd: FormData) {
  const user = await requireUser();
  const habitId = num(fd, "habit_id");
  await addPartner(habitId, user.id, num(fd, "partner_id"));
  revalidatePath(`/habits/${habitId}`);
}

// ======================= challenges =======================

export async function createChallengeAction(fd: FormData) {
  const user = await requireUser();
  await createChallenge(user.id, num(fd, "to_user_id"), Math.min(365, Math.max(1, Math.floor(num(fd, "days")))));
  revalidatePath("/challenges");
  redirect("/challenges");
}

export async function respondChallengeAction(fd: FormData) {
  const user = await requireUser();
  await respondChallenge(num(fd, "id"), user.id, str(fd, "accept") === "1");
  revalidatePath("/challenges");
}

export async function useFreezeAction(fd: FormData) {
  const user = await requireUser();
  const habitId = num(fd, "habit_id");
  const rawDate = str(fd, "date");
  const date = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayStr();
  await spendFreeze(habitId, user.id, date);
  revalidatePath("/");
  revalidatePath(`/habits/${habitId}`);
  revalidatePath("/progress");
}

// ======================= onboarding =======================

export async function onboardingAction(fd: FormData) {
  const user = await requireUser();

  const idName = str(fd, "identity_name");
  const idStatement = str(fd, "identity_statement");
  const identityId =
    idName && idStatement ? await createIdentity(user.id, idName, idStatement) : null;

  await createHabit(user.id, {
    name: reqStr(fd, "name"),
    type: (str(fd, "type") ?? "good") as HabitType,
    identity_id: identityId,
    cue: str(fd, "cue"),
    craving: null,
    response: null,
    reward: null,
    intention_time: str(fd, "intention_time"),
    intention_location: str(fd, "intention_location"),
    gateway_text: str(fd, "gateway_text"),
    schedule: "daily",
    visibility: "private",
  });

  revalidatePath("/");
  redirect("/");
}
