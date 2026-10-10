// Pure: sorts Routines and Tasks into the parts of the Today screen. No DB.
import { addDays, todayStr } from "./score";
import { daysBetween, isVedBehov, turnOwner, type RuleFields } from "./home-cadence";

export interface TodayRoutine extends RuleFields {
  id: number;
  title: string;
  assignee_user_id: number | null;
  rotating: number;
  given_to: number | null;
  due: string | null; // effective due date
  lastDoer: number | null;
}
export interface TodayTask {
  id: number;
  title: string;
  due_on: string | null;
  owner_user_id: number | null;
  created_at: string;
}

export interface Item {
  kind: "routine" | "task";
  id: number;
  title: string;
  due: string | null;
  owner: number | null; // null = Felles
  given: boolean; // Gi bort this round
  daysLate: number; // > 0 = overdue
}

export interface Today {
  mine: Item[]; // due now, mine or Felles
  theirs: Item[]; // due now, the other person's
  upcoming: Item[]; // next N days, everyone's
  vedBehov: Item[];
  later: Item[]; // Tasks with no day
}

export function routineOwner(r: TodayRoutine, memberIds: number[]): number | null {
  if (r.given_to != null) return r.given_to;
  if (r.rotating) return turnOwner(memberIds, r.lastDoer);
  return r.assignee_user_id;
}

export function buildToday(
  routines: TodayRoutine[],
  tasks: TodayTask[],
  memberIds: number[],
  userId: number,
  days = 7,
  today = todayStr(),
): Today {
  const out: Today = { mine: [], theirs: [], upcoming: [], vedBehov: [], later: [] };
  const horizon = addDays(today, days);
  const items: (Item & { vedBehov: boolean })[] = [
    ...routines.map((r) => ({
      kind: "routine" as const,
      id: r.id,
      title: r.title,
      due: r.due,
      owner: routineOwner(r, memberIds),
      given: r.given_to != null,
      daysLate: r.due ? daysBetween(r.due, today) : 0,
      vedBehov: isVedBehov(r) && !r.due,
    })),
    ...tasks.map((t) => ({
      kind: "task" as const,
      id: t.id,
      title: t.title,
      due: t.due_on,
      owner: t.owner_user_id,
      given: false,
      daysLate: t.due_on ? daysBetween(t.due_on, today) : 0,
      vedBehov: false,
    })),
  ];
  for (const { vedBehov, ...it } of items) {
    if (vedBehov) out.vedBehov.push(it);
    else if (!it.due) out.later.push(it);
    else if (it.due <= today) (it.owner == null || it.owner === userId ? out.mine : out.theirs).push(it);
    else if (it.due <= horizon) out.upcoming.push(it);
  }
  const byDue = (a: Item, b: Item) => (a.due ?? "").localeCompare(b.due ?? "") || a.title.localeCompare(b.title);
  out.mine.sort(byDue);
  out.theirs.sort(byDue);
  out.upcoming.sort(byDue);
  return out;
}
