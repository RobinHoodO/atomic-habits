import Link from "next/link";
import { requireUser } from "@/lib/session";
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
  type Chore,
} from "@/lib/home";
import { dbGet } from "@/lib/db";
import { isWeekend, taskIsStale } from "@/lib/home-cadence";
import { buildToday, type Item } from "@/lib/home-today";
import { todayStr } from "@/lib/score";
import {
  createHomeAction,
  addMemberAction,
  seedStarterAction,
  logChoreAction,
  undoChoreAction,
  skipChoreAction,
  postponeChoreAction,
  giveAwayChoreAction,
  addTaskAction,
  completeTaskAction,
  setTaskDayAction,
  deleteTaskAction,
  markGivenAction,
} from "@/app/home-actions";

export const dynamic = "force-dynamic";

const PILL =
  "btn cursor-pointer has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-white";
const DAYS_CHOICES = [3, 7, 14];

// Day buttons shared by "add Task", Task menu and Utsett. `withLater` adds "Senere".
function DayPicker({ first, withLater }: { first: "today" | "tomorrow"; withLater?: boolean }) {
  const opts: [string, string][] = [
    [first, first === "today" ? "I dag" : "I morgen"],
    ["weekend", "I helgen"],
    ...(withLater ? ([["later", "Senere"]] as [string, string][]) : []),
  ];
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {opts.map(([v, l], i) => (
        <label key={v} className={PILL}>
          <input type="radio" name="day" value={v} defaultChecked={i === 0} className="sr-only" />
          {l}
        </label>
      ))}
      <label className={PILL}>
        <input type="radio" name="day" value="date" className="sr-only" />
        Velg dato
      </label>
      <input type="date" name="date" className="input w-auto py-1 text-xs" aria-label="Dato" />
    </div>
  );
}

function Hidden({ id, from = true }: { id: number; from?: boolean }) {
  return (
    <>
      <input type="hidden" name="id" value={id} />
      {from && <input type="hidden" name="from" value="today" />}
    </>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; undo?: string; undoTask?: string; n?: string }>;
}) {
  const user = await requireUser();
  const home = await homeForUser(user.id);
  const { invite, undo, undoTask, n } = await searchParams;

  // ---- no home yet: create one ----
  if (!home) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Vårt hjem</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Rutiner og oppgaver for oss to. Én liste hver dag.
          </p>
        </header>
        <form action={createHomeAction} className="card flex flex-col gap-3">
          <div>
            <label className="label req">Navn på hjemmet</label>
            <input className="input" name="name" placeholder="Vårt hjem" required />
          </div>
          <button className="btn btn-primary self-start">Lag hjem</button>
        </form>
      </div>
    );
  }

  const today = todayStr();
  const days = DAYS_CHOICES.includes(Number(n)) ? Number(n) : 7;
  const members = await homeMembers(home.id);
  const ids = await memberIds(home.id);
  const nameOf = new Map(members.map((m) => [Number(m.user_id), m.name]));
  const chores = await listChores(home.id);
  const choreById = new Map(chores.map((c) => [c.id, c]));
  const lastDone = await lastDoneByChore(home.id);
  const lastDoer = await lastDoerByChore(home.id);
  const allTasks = await listTasks(home.id);
  const openTasks = allTasks.filter((t) => !t.done_at);
  const weekend = isWeekend(today);

  const t = buildToday(
    chores.map((c) => ({ ...c, due: effectiveDue(c, lastDone[c.id] ?? null), lastDoer: lastDoer[c.id] ?? null })),
    openTasks,
    ids,
    user.id,
    days,
    today,
  );
  // Doc §9: a "Senere" Task older than 2 weeks shows up on Today at the weekend.
  const staleIds = new Set(
    openTasks.filter((x) => !x.due_on && taskIsStale(x.created_at, today)).map((x) => x.id),
  );
  const later = weekend ? t.later.filter((i) => !staleIds.has(i.id)) : t.later;
  const mine = weekend ? [...t.mine, ...t.later.filter((i) => staleIds.has(i.id))] : t.mine;

  // Angre bar: only for the viewer's own last tick.
  const undoLog = undo
    ? await dbGet<{ id: number; chore_id: number; user_id: number }>(
        `SELECT id, chore_id, user_id FROM chore_logs WHERE id = ?`,
        [Number(undo)],
      )
    : undefined;
  const undoChore = undoLog && Number(undoLog.user_id) === user.id ? choreById.get(Number(undoLog.chore_id)) : undefined;
  const undoneTask = undoTask ? allTasks.find((x) => x.id === Number(undoTask) && x.done_at) : undefined;
  const partner = members.find((m) => Number(m.user_id) !== user.id);
  const wallet = await walletByMember(home.id);
  const toGive = (await listRedemptions(home.id)).filter((d) => !d.given_at && Number(d.user_id) !== user.id);
  const taskById = new Map(openTasks.map((x) => [x.id, x]));
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
    if (i.kind === "task" && staleIds.has(i.id) && !i.due) return "over 2 uker";
    if (!i.due) return "";
    if (i.daysLate > 0) return `${i.daysLate} d på overtid`;
    if (i.daysLate === 0) return "i dag";
    return new Date(i.due + "T00:00:00").toLocaleDateString("nb-NO", { weekday: "short", day: "numeric", month: "short" });
  }

  function Row({ i, dim }: { i: Item; dim?: boolean }) {
    const c: Chore | undefined = i.kind === "routine" ? choreById.get(i.id) : undefined;
    const late = i.daysLate > 0 || (i.kind === "task" && staleIds.has(i.id) && !i.due);
    return (
      <li className={`card flex flex-col gap-2 py-3 ${dim ? "opacity-70" : ""}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-medium tracking-tight">{i.title}</div>
            <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
              {when(i) && <span className={late ? "font-medium text-bad" : ""}>{when(i)}</span>}
              <span>{i.kind === "task" ? "Oppgave · " : ""}{ownerLabel(i)}</span>
              <span>+{points(i)} p</span>
              {c?.standard && <span title={c.standard}>📋</span>}
            </div>
          </div>
          <form action={i.kind === "routine" ? logChoreAction : completeTaskAction} className="shrink-0">
            <Hidden id={i.id} />
            <button className="btn btn-primary whitespace-nowrap">Gjort</button>
          </form>
        </div>
        <details className="text-xs">
          <summary className="cursor-pointer list-none text-muted hover:text-foreground">⋯ Mer</summary>
          <div className="mt-2 flex flex-col gap-2">
            {i.kind === "routine" ? (
              <>
                <form action={postponeChoreAction} className="flex flex-wrap items-center gap-2">
                  <Hidden id={i.id} from={false} />
                  <span className="text-muted">Utsett:</span>
                  <DayPicker first="tomorrow" />
                  <button className="btn">OK</button>
                </form>
                <div className="flex flex-wrap gap-2">
                  <form action={skipChoreAction}>
                    <Hidden id={i.id} from={false} />
                    <button className="btn">Hopp over</button>
                  </form>
                  {i.owner === user.id && partner && (
                    <form action={giveAwayChoreAction}>
                      <Hidden id={i.id} from={false} />
                      <button className="btn">Gi bort til {partner.name}</button>
                    </form>
                  )}
                  <Link href={`/home/chores#c${i.id}`} className="btn">Endre</Link>
                </div>
              </>
            ) : (
              <>
                <form action={setTaskDayAction} className="flex flex-wrap items-center gap-2">
                  <Hidden id={i.id} from={false} />
                  <DayPicker first="today" withLater />
                  <button className="btn">OK</button>
                </form>
                <form action={deleteTaskAction}>
                  <Hidden id={i.id} from={false} />
                  <button className="text-muted hover:text-bad">Slett oppgaven</button>
                </form>
              </>
            )}
          </div>
        </details>
      </li>
    );
  }

  function Fold({ title, items, dim, open, children }: { title: string; items: Item[]; dim?: boolean; open?: boolean; children?: React.ReactNode }) {
    return (
      <details open={open} className="flex flex-col gap-2">
        <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-muted">
          ▸ {title} ({items.length})
        </summary>
        {children}
        <ul className="mt-2 flex flex-col gap-2">
          {items.map((i) => <Row key={`${i.kind}${i.id}`} i={i} dim={dim} />)}
        </ul>
      </details>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{home.name}</h1>
          <p className="mt-0.5 text-sm text-muted">{members.map((m) => m.name).join(" · ")}</p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href="/home/premier" className="btn">🎁 {wallet[user.id] ?? 0} p</Link>
          <Link href="/home/chores" className="btn">Rutiner</Link>
        </div>
      </header>

      {toGive.map((d) => (
        <form key={d.id} action={markGivenAction} className="card flex items-center justify-between gap-3 py-2 text-sm">
          <input type="hidden" name="id" value={d.id} />
          <span className="min-w-0 truncate">🎁 {nameOf.get(Number(d.user_id))} løste inn: «{d.title}»</span>
          <button className="btn btn-primary">Gitt ✓</button>
        </form>
      ))}

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
          <span className="min-w-0 truncate">✓ «{undoneTask.title}» gjort</span>
          <button className="btn">Angre</button>
        </form>
      )}

      {/* invite a partner */}
      {members.length < 2 && (
        <section className="card flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Inviter partneren din</h2>
          {invite === "no-account" && (
            <p className="text-xs text-bad">Ingen konto med den e-posten ennå. De må registrere seg først.</p>
          )}
          {invite === "already" && <p className="text-xs text-muted">Allerede med.</p>}
          {invite === "added" && <p className="text-xs text-good">Lagt til! 🎉</p>}
          <form action={addMemberAction} className="flex gap-2 text-sm">
            <input className="input flex-1" name="email" type="email" placeholder="partner@epost.no" required />
            <button className="btn btn-primary">Legg til</button>
          </form>
        </section>
      )}

      {/* fast add: a Task, in one line; a Routine is one tap away */}
      <form action={addTaskAction} className="card flex flex-col gap-2 text-sm">
        <input type="hidden" name="from" value="today" />
        <div className="flex gap-2">
          <input className="input flex-1" name="title" placeholder="Ny oppgave…" required />
          <input className="input w-16" type="number" name="points" min={0} defaultValue={5} aria-label="Poeng" title="Poeng" />
          <button className="btn btn-primary">Legg til</button>
        </div>
        <DayPicker first="today" withLater />
        <Link href="/home/chores#ny" className="text-xs text-muted hover:text-foreground">+ Ny rutine</Link>
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">I dag</h2>
        {chores.length === 0 ? (
          <div className="card flex flex-col items-start gap-3 text-sm text-muted">
            <span>Ingen rutiner ennå. Last inn listen fra «Vårt hjem» med ett trykk.</span>
            <form action={seedStarterAction}>
              <button className="btn btn-primary">Last inn startlisten</button>
            </form>
          </div>
        ) : mine.length === 0 ? (
          <div className="card text-sm text-muted">Alt er gjort for i dag 🎉</div>
        ) : (
          <ul className="flex flex-col gap-2">
            {mine.map((i) => <Row key={`${i.kind}${i.id}`} i={i} />)}
          </ul>
        )}
      </section>

      {partner && t.theirs.length > 0 && <Fold title={`${partner.name} i dag`} items={t.theirs} dim />}

      <Fold title={`Neste ${days} dager`} items={t.upcoming} open={!!n}>
        <div className="mt-2 flex gap-2 text-xs">
          {DAYS_CHOICES.map((d) => (
            <Link key={d} href={`/home?n=${d}`} className={`btn ${d === days ? "btn-primary" : ""}`}>{d} dager</Link>
          ))}
        </div>
      </Fold>
      {t.vedBehov.length > 0 && <Fold title="Ved behov" items={t.vedBehov} />}
      {later.length > 0 && <Fold title="Senere" items={later} />}
    </div>
  );
}
