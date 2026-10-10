import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { homeForUser, homeMembers, listTasks, getSeenAt, type HomeTask } from "@/lib/home";
import { unreadThreshold, isFresh } from "@/lib/home-events";
import { parseWho, matchesWho } from "@/lib/home-who";
import WhoFilter from "@/components/WhoFilter";
import { taskIsStale, daysBetween } from "@/lib/home-cadence";
import { todayStr } from "@/lib/score";
import { addTaskAction } from "@/app/home-actions";
import DayPicker from "@/components/DayPicker";
import TodayRow from "@/components/TodayRow";
import GjortProvider, { UndoBars } from "@/components/GjortProvider";

export const dynamic = "force-dynamic";

const PILL =
  "btn cursor-pointer px-2 py-1.5 text-xs shadow-none has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-white";

// Oppgaver: every open Task (the backlog), dated ones first, then Senere.
export default async function TasksPage({ searchParams }: { searchParams: Promise<{ who?: string }> }) {
  const user = await requireUser();
  const { who: whoRaw } = await searchParams;
  const home = await homeForUser(user.id);
  if (!home) redirect("/home");

  const today = todayStr();
  const members = await homeMembers(home.id);
  const nameOf = new Map(members.map((m) => [Number(m.user_id), m.name]));
  const who = parseWho(whoRaw, members.map((m) => Number(m.user_id)), user.id, false);
  const threshold = unreadThreshold(await getSeenAt(home.id, user.id));
  const tasks = await listTasks(home.id);
  const open = tasks.filter(
    (t) => !t.done_at && matchesWho(who, t.owner_user_id == null ? null : Number(t.owner_user_id), false, user.id),
  );
  const dated = open.filter((t) => t.due_on).sort((a, b) => a.due_on!.localeCompare(b.due_on!));
  const later = open.filter((t) => !t.due_on);
  const done = tasks.filter((t) => t.done_at).sort((a, b) => b.done_at!.localeCompare(a.done_at!)).slice(0, 20);

  function owner(t: HomeTask): string {
    if (t.owner_user_id == null) return "Felles";
    return Number(t.owner_user_id) === user.id ? "Meg" : nameOf.get(Number(t.owner_user_id)) ?? "";
  }
  function Row({ t }: { t: HomeTask }) {
    const late = t.due_on ? daysBetween(t.due_on, today) : 0;
    const stale = !t.due_on && taskIsStale(t.created_at, today);
    const when = t.due_on
      ? late > 0
        ? `${late} d på overtid`
        : late === 0
          ? "i dag"
          : new Date(t.due_on + "T00:00:00").toLocaleDateString("nb-NO", { weekday: "short", day: "numeric", month: "short" })
      : stale
        ? "over 2 uker"
        : undefined;
    return (
      <TodayRow
        kind="task"
        id={t.id}
        title={t.title}
        when={when}
        late={late > 0 || stale}
        meta={[owner(t), `+${t.points} p`]}
        date={today}
        isNew={isFresh(t.created_by, t.created_at, user.id, threshold)}
      />
    );
  }

  return (
    <GjortProvider>
    <div className="flex flex-col gap-2">
      <UndoBars />

      <form action={addTaskAction} className="group card flex flex-col gap-1.5 rounded-xl px-2 py-2 text-sm shadow-none">
        <input type="hidden" name="back" value="/home/tasks" />
        <div className="flex gap-1.5">
          <input className="input h-10 min-w-0 flex-1 py-1" name="title" placeholder="Ny oppgave…" aria-label="Ny oppgave" required />
          <input className="input h-10 w-14 px-2 py-1" type="number" name="points" min={0} defaultValue={5} aria-label="Poeng" title="Poeng" />
          <button className="btn btn-primary h-10 w-10 px-0 text-lg" aria-label="Legg til" title="Legg til">+</button>
        </div>
        <div className="hidden flex-col gap-1 group-focus-within:flex">
        <DayPicker first="today" withLater />
        <div className="flex flex-wrap gap-1">
          <label className={PILL}>
            <input type="radio" name="owner" value="me" defaultChecked className="sr-only" />
            Meg
          </label>
          {members
            .filter((m) => Number(m.user_id) !== user.id)
            .map((m) => (
              <label key={m.user_id} className={PILL}>
                <input type="radio" name="owner" value={String(m.user_id)} className="sr-only" />
                {m.name}
              </label>
            ))}
          <label className={PILL}>
            <input type="radio" name="owner" value="felles" className="sr-only" />
            Felles
          </label>
        </div>
        </div>
      </form>

      <WhoFilter path="/home/tasks" members={members} me={user.id} current={who} />

      {open.length === 0 && <p className="text-sm text-muted">Tomt. Ingenting venter 🎉</p>}

      {dated.length > 0 && (
        <section className="flex flex-col gap-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Med dag</h2>
          <ul className="flex flex-col gap-1.5">{dated.map((t) => <Row key={t.id} t={t} />)}</ul>
        </section>
      )}
      {later.length > 0 && (
        <section className="flex flex-col gap-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Senere</h2>
          <ul className="flex flex-col gap-1.5">{later.map((t) => <Row key={t.id} t={t} />)}</ul>
        </section>
      )}

      {done.length > 0 && (
        <details>
          <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-muted">
            ▸ Ferdig ({done.length})
          </summary>
          <ul className="mt-1 flex flex-col gap-0.5 text-sm">
            {done.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-1 text-muted">
                <span className="truncate line-through">{t.title}</span>
                <span className="shrink-0 text-xs">{t.done_by ? nameOf.get(Number(t.done_by)) : ""} · +{t.points}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
    </GjortProvider>
  );
}
