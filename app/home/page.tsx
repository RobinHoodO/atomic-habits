import Link from "next/link";
import { requireUser } from "@/lib/session";
import {
  homeForUser,
  homeMembers,
  memberIds,
  listChores,
  lastDoneByChore,
  pointsByMember,
  listTasks,
} from "@/lib/home";
import { dueFor, rotatingAssignee, cadenceLabel, homeHealth } from "@/lib/home-cadence";
import { todayStr, addDays } from "@/lib/score";
import { createHomeAction, addMemberAction, seedStarterAction, logChoreAction } from "@/app/home-actions";
import FairnessBar from "@/components/FairnessBar";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const user = await requireUser();
  const home = homeForUser(user.id);
  const { invite } = await searchParams;

  // ---- no home yet: create one ----
  if (!home) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Vårt hjem</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            A shared space for two. Co-design the chores, split them fairly, earn points
            for showing up — and keep the home (and the relationship) running smoothly.
          </p>
        </header>
        <form action={createHomeAction} className="card flex flex-col gap-3">
          <div>
            <label className="label req">Name your home</label>
            <input className="input" name="name" placeholder="Vårt hjem" required />
          </div>
          <button className="btn btn-primary self-start">Create home</button>
        </form>
      </div>
    );
  }

  const today = todayStr();
  const members = homeMembers(home.id);
  const ids = memberIds(home.id);
  const nameOf = new Map(members.map((m) => [m.user_id, m.name]));
  const lastDone = lastDoneByChore(home.id);
  const chores = listChores(home.id);
  const since30 = addDays(today, -29);
  const pts30 = pointsByMember(home.id, since30);
  const health = homeHealth(
    chores.map((c) => ({ cadence: c.cadence, lastDone: lastDone[c.id] ?? null })),
    today,
  );

  // build the "due now" list (overdue + due today), each with assignment context
  const due = chores
    .map((c) => {
      const d = dueFor(c.cadence, lastDone[c.id] ?? null, today);
      let owner: string | null = null;
      let mine = false;
      if (c.conditional_note) owner = c.conditional_note;
      else if (c.rotating) {
        const who = rotatingAssignee(ids, c.cadence, today);
        owner = who ? `${nameOf.get(who)} (rullerer)` : null;
        mine = who === user.id;
      } else if (c.assignee_user_id) {
        owner = nameOf.get(c.assignee_user_id) ?? null;
        mine = c.assignee_user_id === user.id;
      }
      return { c, d, owner, mine };
    })
    .filter((x) => x.d.state === "overdue" || x.d.state === "due")
    .sort((a, b) => (a.d.daysLeft ?? 0) - (b.d.daysLeft ?? 0));

  const openTasks = listTasks(home.id).filter((t) => !t.done_at).length;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{home.name}</h1>
          <p className="mt-0.5 text-sm text-muted">{members.map((m) => m.name).join(" · ")}</p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href="/home/chores" className="btn">Chores</Link>
          <Link href="/home/tasks" className="btn">
            Backlog{openTasks > 0 && <span className="ml-1 text-muted">({openTasks})</span>}
          </Link>
        </div>
      </header>

      {/* cooperative goal: a shared "Hyggelig hjem" health meter (Tody-style) */}
      {chores.length > 0 && (
        <div className="card flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold">Hyggelig hjem</span>
            <span className="text-xs text-muted">
              {health.onTrack}/{health.total} à jour · {Math.round(health.score * 100)}%
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${
                health.score >= 0.8 ? "bg-good" : health.score >= 0.5 ? "bg-neutral" : "bg-bad"
              }`}
              style={{ width: `${Math.round(health.score * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted">Et felles mål — vi holder hjemmet i orden sammen.</p>
        </div>
      )}

      <FairnessBar members={members} points={pts30} label="Fordeling — siste 30 dager" />

      {/* invite a partner */}
      {members.length < 2 && (
        <section className="card flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Invite your partner</h2>
          {invite === "no-account" && (
            <p className="text-xs text-bad">No account with that email yet — they need to register first.</p>
          )}
          {invite === "already" && <p className="text-xs text-muted">Already a member.</p>}
          {invite === "added" && <p className="text-xs text-good">Added! 🎉</p>}
          <form action={addMemberAction} className="flex gap-2 text-sm">
            <input className="input flex-1" name="email" type="email" placeholder="partner@email.com" required />
            <button className="btn btn-primary">Add</button>
          </form>
        </section>
      )}

      {/* due now */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Å gjøre nå</h2>
        {chores.length === 0 ? (
          <div className="card flex flex-col items-start gap-3 text-sm text-muted">
            <span>No chores yet. Load your real list to get going in one click.</span>
            <form action={seedStarterAction}>
              <button className="btn btn-primary">Load the “Vårt hjem” starter set</button>
            </form>
          </div>
        ) : due.length === 0 ? (
          <div className="card text-sm text-muted">Alt er ajour 🎉 Nothing due right now.</div>
        ) : (
          due.map(({ c, d, owner, mine }) => (
            <div key={c.id} className="card flex items-center justify-between gap-3 py-3 transition-colors hover:border-border-strong">
              <div className="min-w-0">
                <div className="truncate font-medium tracking-tight">{c.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className={d.state === "overdue" ? "font-medium text-bad" : "font-medium text-accent"}>
                    {d.state === "overdue" ? `${-(d.daysLeft ?? 0)} d på overtid` : "i dag"}
                  </span>
                  <span>· {cadenceLabel(c.cadence)}</span>
                  {c.area && <span>· {c.area}</span>}
                  {owner && <span>· {mine ? <strong className="text-foreground">din tur</strong> : owner}</span>}
                </div>
                {c.standard && <div className="mt-0.5 text-xs text-muted italic">📋 {c.standard}</div>}
              </div>
              <form action={logChoreAction} className="shrink-0">
                <input type="hidden" name="id" value={c.id} />
                <button className="btn btn-primary whitespace-nowrap">Gjort +{c.points}</button>
              </form>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
