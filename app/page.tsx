import Link from "next/link";
import { redirect } from "next/navigation";
import { listHabits, listIdentities, statsFor, isDone } from "@/lib/habits";
import { parseSchedule, isScheduledDay, todayStr } from "@/lib/score";
import { requireUser } from "@/lib/session";
import { dbGet } from "@/lib/db";
import {
  homeForUser,
  homeMembers,
  memberIds,
  listChores,
  lastDoneByChore,
  lastDoerByChore,
  effectiveDue,
  listTasks,
  listRedemptions,
  walletByMember,
  FELLES_BONUS,
} from "@/lib/home";
import { isWeekend, taskIsStale } from "@/lib/home-cadence";
import { buildToday, type Item } from "@/lib/home-today";
import { toggleCompletionAction } from "@/app/actions";
import { addTaskAction, completeTaskAction, undoChoreAction, markGivenAction } from "@/app/home-actions";
import GameStrip from "@/components/GameStrip";
import DayPicker from "@/components/DayPicker";
import TodayRow from "@/components/TodayRow";

export const dynamic = "force-dynamic";

const DAYS_CHOICES = [3, 7, 14];

// I dag: the start page. Today's habits and the Home Routines and Tasks due for
// me (or Felles) in one list; the partner's, the coming days and Ved behov fold away.
export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ undo?: string; undoTask?: string; n?: string }>;
}) {
  const user = await requireUser();
  const today = todayStr();
  const { undo, undoTask, n } = await searchParams;
  const days = DAYS_CHOICES.includes(Number(n)) ? Number(n) : 7;

  const habits = await listHabits(user.id);
  const identities = await listIdentities(user.id);
  const home = await homeForUser(user.id);
  // Only greet true cold-starts with the wizard.
  if (habits.length === 0 && identities.length === 0 && !home) redirect("/onboarding");

  // ---- habits ----
  const habitRows = await Promise.all(
    habits.map(async (h) => ({
      habit: h,
      stats: await statsFor(h, user.id, today),
      done: await isDone(h.id, user.id, today),
      scheduledToday: isScheduledDay(today, parseSchedule(h.schedule)),
    })),
  );
  const dueHabits = habitRows.filter((r) => r.scheduledToday && !r.done);
  const doneHabits = habitRows.filter((r) => r.done);

  // ---- home ----
  const members = home ? await homeMembers(home.id) : [];
  const nameOf = new Map(members.map((m) => [Number(m.user_id), m.name]));
  const partner = members.find((m) => Number(m.user_id) !== user.id);
  const chores = home ? await listChores(home.id) : [];
  const choreById = new Map(chores.map((c) => [c.id, c]));
  const lastDone = home ? await lastDoneByChore(home.id) : {};
  const lastDoer = home ? await lastDoerByChore(home.id) : {};
  const allTasks = home ? await listTasks(home.id) : [];
  const openTasks = allTasks.filter((t) => !t.done_at);
  const taskById = new Map(openTasks.map((x) => [x.id, x]));
  const t = buildToday(
    chores.map((c) => ({ ...c, due: effectiveDue(c, lastDone[c.id] ?? null), lastDoer: lastDoer[c.id] ?? null })),
    openTasks,
    home ? await memberIds(home.id) : [],
    user.id,
    days,
    today,
  );
  // Doc §9: an old Senere Task (mine or Felles) shows up at the weekend.
  const staleIds = new Set(
    openTasks
      .filter((x) => !x.due_on && taskIsStale(x.created_at, today))
      .filter((x) => x.owner_user_id == null || Number(x.owner_user_id) === user.id)
      .map((x) => x.id),
  );
  const weekend = isWeekend(today);
  const homeMine = weekend ? [...t.mine, ...t.later.filter((i) => staleIds.has(i.id))] : t.mine;
  const wallet = home ? await walletByMember(home.id) : {};
  const toGive = home
    ? (await listRedemptions(home.id)).filter((d) => !d.given_at && Number(d.user_id) !== user.id)
    : [];

  // Angre bars: only for the viewer's own last tick.
  const undoLog = Number.isInteger(Number(undo)) && undo
    ? await dbGet<{ id: number; chore_id: number; user_id: number }>(
        `SELECT id, chore_id, user_id FROM chore_logs WHERE id = ?`,
        [Number(undo)],
      )
    : undefined;
  const undoChore = undoLog && Number(undoLog.user_id) === user.id ? choreById.get(Number(undoLog.chore_id)) : undefined;
  const undoneTask = Number.isInteger(Number(undoTask)) && undoTask
    ? allTasks.find((x) => x.id === Number(undoTask) && x.done_at)
    : undefined;

  function points(i: Item): number {
    if (i.kind === "task") return taskById.get(i.id)?.points ?? 0;
    const c = choreById.get(i.id);
    return c ? c.points + (c.assignee_user_id == null && !c.rotating ? FELLES_BONUS : 0) : 0;
  }
  function ownerLabel(i: Item): string {
    const c = i.kind === "routine" ? choreById.get(i.id) : undefined;
    if (i.given) return i.owner === user.id ? "fra " + (partner?.name ?? "") : "gitt bort";
    if (i.owner == null) return c?.conditional_note || "Felles";
    if (c?.rotating) return i.owner === user.id ? "din tur" : `${nameOf.get(i.owner)} sin tur`;
    return i.owner === user.id ? "Meg" : nameOf.get(i.owner) ?? "";
  }
  function when(i: Item): string {
    if (i.kind === "task" && !i.due && staleIds.has(i.id)) return "over 2 uker";
    if (!i.due) return "";
    if (i.daysLate > 0) return `${i.daysLate} d på overtid`;
    if (i.daysLate === 0) return "i dag";
    return new Date(i.due + "T00:00:00").toLocaleDateString("nb-NO", { weekday: "short", day: "numeric", month: "short" });
  }
  function HomeRow({ i, dim }: { i: Item; dim?: boolean }) {
    return (
      <TodayRow
        kind={i.kind}
        id={i.id}
        title={i.title}
        when={when(i)}
        late={i.daysLate > 0 || (i.kind === "task" && !i.due && staleIds.has(i.id))}
        meta={[ownerLabel(i), `+${points(i)} p`]}
        dim={dim}
        giveTo={i.kind === "routine" && i.owner === user.id && partner ? partner.name : null}
        date={today}
        back="/"
      />
    );
  }
  function Fold({ title, count, open, children }: { title: string; count: number; open?: boolean; children: React.ReactNode }) {
    return (
      <details open={open} className="flex flex-col gap-2">
        <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-muted">
          ▸ {title} ({count})
        </summary>
        <div className="mt-2 flex flex-col gap-2">{children}</div>
      </details>
    );
  }

  const late = homeMine.filter((i) => i.daysLate > 0);
  const onTime = homeMine.filter((i) => i.daysLate <= 0);
  const nothing = late.length + dueHabits.length + onTime.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <GameStrip userId={user.id} />
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">I dag</h1>
          <p className="mt-0.5 text-sm text-muted">
            {new Date(today + "T00:00:00").toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        {home && <Link href="/home/premier" className="btn text-sm">🎁 {wallet[user.id] ?? 0} p</Link>}
      </header>

      {undoChore && (
        <form action={undoChoreAction} className="card flex items-center justify-between gap-3 py-2 text-sm">
          <input type="hidden" name="log" value={undoLog!.id} />
          <span className="min-w-0 truncate">✓ «{undoChore.title}» gjort</span>
          <button className="btn">Angre</button>
        </form>
      )}
      {undoneTask && (
        <form action={completeTaskAction} className="card flex items-center justify-between gap-3 py-2 text-sm">
          <input type="hidden" name="id" value={undoneTask.id} />
          <input type="hidden" name="undo" value="1" />
          <span className="min-w-0 truncate">✓ «{undoneTask.title}» gjort</span>
          <button className="btn">Angre</button>
        </form>
      )}
      {toGive.map((d) => (
        <form key={d.id} action={markGivenAction} className="card flex items-center justify-between gap-3 py-2 text-sm">
          <input type="hidden" name="id" value={d.id} />
          <span className="min-w-0 truncate">🎁 {nameOf.get(Number(d.user_id))} løste inn: «{d.title}»</span>
          <button className="btn btn-primary">Gitt ✓</button>
        </form>
      ))}

      {/* quick add: a Task in one line */}
      {home ? (
        <form action={addTaskAction} className="card flex flex-col gap-2 text-sm">
          <input type="hidden" name="back" value="/" />
          <div className="flex gap-2">
            <input className="input flex-1" name="title" placeholder="Ny oppgave…" required />
            <input className="input w-16" type="number" name="points" min={0} defaultValue={5} aria-label="Poeng" title="Poeng" />
            <button className="btn btn-primary">Legg til</button>
          </div>
          <DayPicker first="today" withLater />
        </form>
      ) : (
        <Link href="/home" className="card text-sm text-muted hover:text-foreground">
          🏠 Lag et hjem for rutiner og oppgaver sammen →
        </Link>
      )}

      <section className="flex flex-col gap-2">
        {nothing ? (
          <div className="card text-sm text-muted">Alt er gjort for i dag 🎉</div>
        ) : (
          <ul className="flex flex-col gap-2">
            {late.map((i) => <HomeRow key={`${i.kind}${i.id}`} i={i} />)}
            {dueHabits.map((r) => (
              <TodayRow
                key={`h${r.habit.id}`}
                kind="habit"
                id={r.habit.id}
                title={r.habit.name}
                meta={[r.stats.streak > 0 ? `🔥 ${r.stats.streak}` : "Vane"]}
                date={today}
                back="/"
              />
            ))}
            {onTime.map((i) => <HomeRow key={`${i.kind}${i.id}`} i={i} />)}
          </ul>
        )}
      </section>

      {partner && t.theirs.length > 0 && (
        <Fold title={`${partner.name} i dag`} count={t.theirs.length}>
          <ul className="flex flex-col gap-2">{t.theirs.map((i) => <HomeRow key={`${i.kind}${i.id}`} i={i} dim />)}</ul>
        </Fold>
      )}
      {home && (
        <Fold title={`Neste ${days} dager`} count={t.upcoming.length} open={!!n}>
          <div className="flex gap-2 text-xs">
            {DAYS_CHOICES.map((d) => (
              <Link key={d} href={`/?n=${d}`} className={`btn ${d === days ? "btn-primary" : ""}`}>{d} dager</Link>
            ))}
          </div>
          <ul className="flex flex-col gap-2">{t.upcoming.map((i) => <HomeRow key={`${i.kind}${i.id}`} i={i} />)}</ul>
        </Fold>
      )}
      {t.vedBehov.length > 0 && (
        <Fold title="Ved behov" count={t.vedBehov.length}>
          <ul className="flex flex-col gap-2">{t.vedBehov.map((i) => <HomeRow key={`${i.kind}${i.id}`} i={i} />)}</ul>
        </Fold>
      )}
      {doneHabits.length > 0 && (
        <Fold title="Vaner gjort i dag" count={doneHabits.length}>
          <ul className="flex flex-col gap-1 text-sm">
            {doneHabits.map((r) => (
              <li key={r.habit.id} className="flex items-center justify-between gap-3 px-1">
                <span className="truncate text-muted line-through">🔁 {r.habit.name}</span>
                <form action={toggleCompletionAction}>
                  <input type="hidden" name="habit_id" value={r.habit.id} />
                  <input type="hidden" name="date" value={today} />
                  <button className="text-xs text-muted hover:text-foreground">Angre</button>
                </form>
              </li>
            ))}
          </ul>
        </Fold>
      )}
    </div>
  );
}
