import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { homeForUser, homeMembers, listTasks } from "@/lib/home";
import { taskIsStale } from "@/lib/home-cadence";
import { todayStr } from "@/lib/score";
import { addTaskAction, completeTaskAction, deleteTaskAction } from "@/app/home-actions";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const user = await requireUser();
  const home = homeForUser(user.id);
  if (!home) redirect("/home");

  const today = todayStr();
  const nameOf = new Map(homeMembers(home.id).map((m) => [m.user_id, m.name]));
  const tasks = listTasks(home.id);
  const open = tasks.filter((t) => !t.done_at);
  const done = tasks.filter((t) => t.done_at);
  const staleCount = open.filter((t) => taskIsStale(t.created_at, today)).length;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Backlog</h1>
          <p className="text-sm text-muted">
            Engangsoppgaver. Eldre enn 2 uker? Tas i nærmeste helg.
          </p>
        </div>
        <Link href="/home" className="btn">← Home</Link>
      </header>

      {staleCount > 0 && (
        <div className="rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
          ⚠ {staleCount} oppgave{staleCount > 1 ? "r" : ""} er over 2 uker gamle — ta {staleCount > 1 ? "dem" : "den"} i helgen.
        </div>
      )}

      <form action={addTaskAction} className="card flex flex-wrap items-end gap-2 text-sm">
        <input className="input flex-1" name="title" placeholder="Noe som dukket opp…" required />
        <label className="flex items-center gap-2">
          <span className="text-muted">Poeng</span>
          <input className="input w-20" type="number" name="points" min={0} defaultValue={5} />
        </label>
        <button className="btn btn-primary">Add</button>
      </form>

      {open.length === 0 ? (
        <p className="text-sm text-muted">Tomt — ingenting venter. 🎉</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {open.map((t) => {
            const stale = taskIsStale(t.created_at, today);
            return (
              <li key={t.id} className="card flex items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block truncate">{t.title}</span>
                  <span className="text-xs text-muted">
                    {t.created_at.slice(0, 10)} · +{t.points} p
                    {stale && <span className="text-bad"> · ta i helgen</span>}
                  </span>
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <form action={completeTaskAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="btn btn-primary whitespace-nowrap">Gjort +{t.points}</button>
                  </form>
                  <form action={deleteTaskAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="text-muted hover:text-bad">✕</button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {done.length > 0 && (
        <details className="flex flex-col gap-2">
          <summary className="cursor-pointer list-none text-sm font-semibold text-muted">
            ▸ Ferdig ({done.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {done.map((t) => (
              <li key={t.id} className="card flex items-center justify-between gap-3 py-2 text-sm opacity-70">
                <span className="min-w-0 truncate line-through">{t.title}</span>
                <div className="flex shrink-0 items-center gap-3 text-xs text-muted">
                  <span>{t.done_by ? nameOf.get(t.done_by) : ""} · +{t.points}</span>
                  <form action={completeTaskAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="hover:text-foreground">undo</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
