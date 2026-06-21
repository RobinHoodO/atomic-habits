import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import {
  homeForUser,
  homeMembers,
  listChores,
  lastDoneByChore,
  type Chore,
  type HomeMember,
} from "@/lib/home";
import { CADENCES, cadenceLabel, dueFor } from "@/lib/home-cadence";
import { todayStr } from "@/lib/score";
import {
  addChoreAction,
  updateChoreAction,
  deleteChoreAction,
  logChoreAction,
  seedStarterAction,
} from "@/app/home-actions";

export const dynamic = "force-dynamic";

// Shared form fields for add + edit. `chore` undefined = the add form.
function Fields({ members, chore }: { members: HomeMember[]; chore?: Chore }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <input className="input" name="title" placeholder="Oppgave" defaultValue={chore?.title ?? ""} required />
      <div className="grid grid-cols-2 gap-2">
        <input className="input" name="area" placeholder="Område (Kjøkken…)" defaultValue={chore?.area ?? ""} />
        <select className="select" name="cadence" defaultValue={chore?.cadence ?? "weekly"}>
          {CADENCES.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2">
          <span className="text-muted">Poeng</span>
          <input className="input" type="number" name="points" min={0} defaultValue={chore?.points ?? ""} placeholder="auto" />
        </label>
        <select className="select" name="assignee_user_id" defaultValue={chore?.assignee_user_id ?? ""}>
          <option value="">Åpen / hvem som helst</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>{m.name}</option>
          ))}
        </select>
      </div>
      <input
        className="input"
        name="conditional_note"
        placeholder="Betinget eier, f.eks. «Den som lagde mat»"
        defaultValue={chore?.conditional_note ?? ""}
      />
      <label className="flex items-center gap-2 text-muted">
        <input type="checkbox" name="rotating" value="1" defaultChecked={!!chore?.rotating} />
        Rullerer mellom oss hver periode
      </label>
    </div>
  );
}

export default async function ChoresPage() {
  const user = await requireUser();
  const home = homeForUser(user.id);
  if (!home) redirect("/home");

  const members = homeMembers(home.id);
  const chores = listChores(home.id);
  const lastDone = lastDoneByChore(home.id);
  const today = todayStr();

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Co-design the chores</h1>
          <p className="text-sm text-muted">Set the cadence, the points, and who owns each one.</p>
        </div>
        <Link href="/home" className="btn">← Home</Link>
      </header>

      {/* add */}
      <details className="card">
        <summary className="cursor-pointer list-none font-medium">+ New chore</summary>
        <form action={addChoreAction} className="mt-3 flex flex-col gap-3">
          <Fields members={members} />
          <button className="btn btn-primary self-start">Add chore</button>
        </form>
      </details>

      {chores.length === 0 && (
        <div className="card flex flex-col items-start gap-3 text-sm text-muted">
          <span>No chores yet — load your real list.</span>
          <form action={seedStarterAction}>
            <button className="btn btn-primary">Load the “Vårt hjem” starter set</button>
          </form>
        </div>
      )}

      {/* grouped by cadence */}
      {CADENCES.map((cad) => {
        const group = chores.filter((c) => c.cadence === cad.key);
        if (group.length === 0) return null;
        return (
          <section key={cad.key} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-muted">
              {cad.label} <span className="text-xs">· {group.length}</span>
            </h2>
            {group.map((c) => {
              const d = dueFor(c.cadence, lastDone[c.id] ?? null, today);
              const owner = c.conditional_note
                ? c.conditional_note
                : c.rotating
                  ? "rullerer"
                  : c.assignee_user_id
                    ? members.find((m) => m.user_id === c.assignee_user_id)?.name
                    : "åpen";
              return (
                <details key={c.id} className="card group p-0">
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.title}</span>
                      <span className="text-xs text-muted">
                        {c.points} p · {owner}
                        {d.state === "overdue" && <span className="text-bad"> · på overtid</span>}
                        {d.state === "due" && <span className="text-accent"> · i dag</span>}
                      </span>
                    </span>
                    <form action={logChoreAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="btn whitespace-nowrap">Gjort +{c.points}</button>
                    </form>
                    <span className="text-xs text-muted group-open:hidden">edit ▸</span>
                  </summary>
                  <form action={updateChoreAction} className="flex flex-col gap-3 border-t border-border p-3">
                    <input type="hidden" name="id" value={c.id} />
                    <Fields members={members} chore={c} />
                    <div className="flex items-center gap-2">
                      <button className="btn btn-primary">Save</button>
                      <span className="flex-1" />
                    </div>
                  </form>
                  <form action={deleteChoreAction} className="px-3 pb-3">
                    <input type="hidden" name="id" value={c.id} />
                    <button className="text-xs text-muted hover:text-bad">Remove chore</button>
                  </form>
                </details>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
