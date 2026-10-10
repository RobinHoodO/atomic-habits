import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import {
  homeForUser,
  homeMembers,
  listChores,
  lastDoneByChore,
  effectiveDue,
  pointsByMember,
  getSeenAt,
  type Chore,
  type HomeMember,
} from "@/lib/home";
import {
  CADENCES,
  WEEKDAY_PICK,
  dueState,
  parseWeekdays,
  periodDays,
  ruleLabel,
  type DueState,
} from "@/lib/home-cadence";
import { todayStr, addDays } from "@/lib/score";
import FairnessBar from "@/components/FairnessBar";
import WhoFilter from "@/components/WhoFilter";
import NyPill, { NY_RING } from "@/components/NyPill";
import { unreadThreshold, isFresh } from "@/lib/home-events";
import { parseWho, matchesWho } from "@/lib/home-who";
import {
  addChoreAction,
  updateChoreAction,
  deleteChoreAction,
  logChoreAction,
  seedStarterAction,
  addMemberAction,
} from "@/app/home-actions";

export const dynamic = "force-dynamic";

const PILL =
  "btn cursor-pointer px-2 py-1.5 text-xs shadow-none has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-white";

function Pill({ name, value, label, checked, type = "radio" }: {
  name: string; value: string; label: string; checked?: boolean; type?: "radio" | "checkbox";
}) {
  return (
    <label className={PILL}>
      <input type={type} name={name} value={value} defaultChecked={checked} className="sr-only" />
      {label}
    </label>
  );
}

// Shared form fields for add + edit. `chore` undefined = the add form.
// Sections show/hide with CSS :has() on the checked radio — no client JS.
function Fields({ members, me, chore }: { members: HomeMember[]; me: number; chore?: Chore }) {
  const owner = !chore
    ? "me"
    : chore.rotating
      ? "turns"
      : chore.assignee_user_id == null
        ? "felles"
        : Number(chore.assignee_user_id) === me
          ? "me"
          : String(chore.assignee_user_id);
  const fixed = !!chore && parseWeekdays(chore.weekdays).length > 0;
  const custom = !!chore && !fixed && !!chore.every_days;
  const cadence = custom ? "custom" : chore?.cadence ?? "weekly";
  const days = parseWeekdays(chore?.weekdays ?? null);
  const unit = custom && chore!.every_days! % 7 === 0 ? "w" : "d";
  const n = custom ? (unit === "w" ? chore!.every_days! / 7 : chore!.every_days!) : 2;

  return (
    <div className="group flex flex-col gap-2 text-sm">
      <input className="input py-1.5" name="title" placeholder="Rutine" defaultValue={chore?.title ?? ""} required />

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted">Hvem</span>
        <div className="flex flex-wrap gap-1">
          <Pill name="owner" value="me" label="Meg" checked={owner === "me"} />
          {members.filter((m) => Number(m.user_id) !== me).map((m) => (
            <Pill key={m.user_id} name="owner" value={String(m.user_id)} label={m.name} checked={owner === String(m.user_id)} />
          ))}
          <Pill name="owner" value="turns" label="Bytter på" checked={owner === "turns"} />
          <Pill name="owner" value="felles" label="Felles" checked={owner === "felles"} />
        </div>
        <input
          className="input hidden group-has-[[name=owner][value=felles]:checked]:block"
          name="conditional_note"
          placeholder="«Den som …» (valgfritt)"
          defaultValue={chore?.conditional_note ?? ""}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted">Hvor ofte</span>
        <div className="flex flex-wrap gap-1">
          <Pill name="rule" value="after" label="Etter utført" checked={!fixed} />
          <Pill name="rule" value="fixed" label="Faste dager" checked={fixed} />
        </div>
        <div className="flex flex-col gap-1 group-has-[[name=rule][value=fixed]:checked]:hidden">
          <div className="flex flex-wrap gap-1">
            {CADENCES.filter((c) => c.key !== "seasonal" || chore?.cadence === "seasonal").map((c) => (
              <Pill key={c.key} name="cadence" value={c.key} label={c.label} checked={cadence === c.key} />
            ))}
            <Pill name="cadence" value="custom" label="Annet" checked={cadence === "custom"} />
          </div>
          <div className="hidden items-center gap-2 group-has-[[name=cadence][value=custom]:checked]:flex">
            <span className="text-muted">Hver</span>
            <input className="input w-20 py-1.5" type="number" name="every_n" min={1} max={999} defaultValue={n} />
            <select className="select w-auto py-1.5" name="unit" defaultValue={unit}>
              <option value="d">dag</option>
              <option value="w">uke</option>
              <option value="m">måned</option>
            </select>
          </div>
        </div>
        <div className="hidden flex-col gap-1 group-has-[[name=rule][value=fixed]:checked]:flex">
          <div className="flex flex-wrap gap-1">
            {WEEKDAY_PICK.map(([d, l]) => (
              <Pill key={d} type="checkbox" name="wd" value={String(d)} label={l} checked={days.includes(d)} />
            ))}
          </div>
          <select className="select w-auto py-1.5" name="every_weeks" defaultValue={String(chore?.every_weeks ?? 1)}>
            <option value="1">hver uke</option>
            <option value="2">hver 2. uke</option>
            <option value="3">hver 3. uke</option>
            <option value="4">hver 4. uke</option>
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2">
        <span className="text-xs text-muted">Poeng</span>
        <input className="input w-24 py-1.5" type="number" name="points" min={0} defaultValue={chore?.points ?? ""} placeholder="auto" />
      </label>

      <details>
        <summary className="cursor-pointer list-none text-xs text-muted">▸ Mer</summary>
        <div className="mt-1.5 flex flex-col gap-1.5">
          <label className="flex items-center gap-2">
            <span className="w-24 text-muted">Neste dato</span>
            <input className="input py-1.5" type="date" name="next_due" defaultValue={chore?.next_due ?? ""} />
          </label>
          <input className="input py-1.5" name="area" placeholder="Område (Kjøkken…)" defaultValue={chore?.area ?? ""} />
          <input
            className="input py-1.5"
            name="standard"
            placeholder="Standard: hva er «gjort skikkelig»?"
            defaultValue={chore?.standard ?? ""}
          />
        </div>
      </details>
    </div>
  );
}

const DOT: Record<DueState, string> = {
  upcoming: "bg-good",
  due: "bg-neutral",
  overdue: "bg-bad",
  none: "bg-border",
};

export default async function ChoresPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; saved?: string; who?: string }>;
}) {
  const user = await requireUser();
  const { invite, saved, who: whoRaw } = await searchParams;
  const home = await homeForUser(user.id);
  if (!home) redirect("/home");

  const members = await homeMembers(home.id);
  const nameOf = new Map(members.map((m) => [Number(m.user_id), m.name]));
  const who = parseWho(whoRaw, members.map((m) => Number(m.user_id)), user.id, true);
  const threshold = unreadThreshold(await getSeenAt(home.id, user.id));
  const allChores = await listChores(home.id);
  const chores = allChores.filter((c) =>
    matchesWho(who, c.assignee_user_id == null ? null : Number(c.assignee_user_id), !!c.rotating, user.id),
  );
  const savedId = saved && /^\d+$/.test(saved) ? Number(saved) : null; // only an integer id is trusted
  const savedChore = savedId != null ? allChores.find((c) => c.id === savedId) : undefined;
  const lastDone = await lastDoneByChore(home.id);
  const today = todayStr();
  const pts30 = await pointsByMember(home.id, addDays(today, -29));

  // group by repeat rule, shortest period first; Ved behov last
  const groups = new Map<string, { order: number; items: Chore[] }>();
  for (const c of chores) {
    const label = ruleLabel(c);
    const order = parseWeekdays(c.weekdays).length ? 7 : periodDays(c) || 99999;
    const g = groups.get(label) ?? { order, items: [] };
    g.items.push(c);
    groups.set(label, g);
  }
  const sorted = [...groups.entries()].sort((a, b) => a[1].order - b[1].order);

  function ChoreItem(c: Chore) {
    const d = dueState(effectiveDue(c, lastDone[c.id] ?? null), today);
    const isNew = isFresh(c.created_by, c.created_at, user.id, threshold);
    const owner = c.rotating
      ? "Bytter på"
      : c.assignee_user_id != null
        ? nameOf.get(Number(c.assignee_user_id))
        : c.conditional_note || "Felles";
    return (
      <details
        key={c.id}
        id={`c${c.id}`}
        className={`card group/item rounded-xl p-0 shadow-none ${c.id === savedChore?.id ? "saved-flash" : isNew ? NY_RING : ""}`}
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-1.5 [&::-webkit-details-marker]:hidden">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[d.state]}`} title={d.state} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium">
              {c.title}
              {isNew && (
                <span className="ml-2 align-middle">
                  <NyPill />
                </span>
              )}
            </span>
            <span className="text-xs text-muted">
              {owner}
              {d.state === "overdue" && <span className="text-bad"> · på overtid</span>}
              {d.state === "due" && <span className="text-accent"> · i dag</span>}
              {d.state === "upcoming" && <span> · {d.dueOn}</span>}
            </span>
          </span>
          <form action={logChoreAction}>
            <input type="hidden" name="id" value={c.id} />
            <button className="btn h-10 whitespace-nowrap px-3">Gjort</button>
          </form>
          <span className="text-xs text-muted group-open/item:hidden" aria-hidden>▸</span>
        </summary>
        <form action={updateChoreAction} className="flex flex-col gap-2 border-t border-border p-3">
          <input type="hidden" name="id" value={c.id} />
          <Fields members={members} me={user.id} chore={c} />
          <button className="btn btn-primary h-10 self-start px-4">Lagre</button>
        </form>
        <form action={deleteChoreAction} className="px-3 pb-2">
          <input type="hidden" name="id" value={c.id} />
          <button className="text-xs text-muted hover:text-bad">Fjern rutinen</button>
        </form>
      </details>
    );
  }

  return (
    <div className="flex flex-col gap-3">

      {savedChore && (
        <div role="status" className="card border-good px-3 py-1.5 text-sm text-good shadow-none">
          Lagret ✓ «{savedChore.title}»
        </div>
      )}

      {members.length < 2 && (
        <section className="card flex flex-col gap-1.5 rounded-xl px-3 py-2 shadow-none">
          <h2 className="text-xs font-semibold text-muted">Inviter partneren din</h2>
          {invite === "no-account" && (
            <p className="text-xs text-bad">Ingen konto med den e-posten ennå. De må registrere seg først.</p>
          )}
          {invite === "already" && <p className="text-xs text-muted">Allerede med.</p>}
          {invite === "added" && <p className="text-xs text-good">Lagt til! 🎉</p>}
          <form action={addMemberAction} className="flex gap-2 text-sm">
            <input className="input flex-1 py-1.5" name="email" type="email" placeholder="partner@epost.no" required />
            <button className="btn btn-primary h-10 px-3">Legg til</button>
          </form>
        </section>
      )}

      <details id="ny" className="card rounded-xl px-3 py-2 shadow-none" open={allChores.length > 0 ? undefined : true}>
        <summary className="flex min-h-8 cursor-pointer list-none items-center text-sm font-medium">+ Ny rutine</summary>
        <form action={addChoreAction} className="mt-2 flex flex-col gap-2">
          <Fields members={members} me={user.id} />
          <button className="btn btn-primary h-10 self-start px-4">Legg til</button>
        </form>
      </details>

      {allChores.length > 0 && <WhoFilter path="/home/chores" members={members} me={user.id} current={who} withTurns />}

      {allChores.length === 0 && (
        <div className="card flex flex-col items-start gap-2 px-3 py-2 text-sm text-muted shadow-none">
          <span>Ingen rutiner ennå. Last inn listen fra «Vårt hjem».</span>
          <form action={seedStarterAction}>
            <button className="btn btn-primary">Last inn startlisten</button>
          </form>
        </div>
      )}

      {sorted.map(([label, g]) => (
        <section key={label} className="flex flex-col gap-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
            {label} <span className="font-normal">· {g.items.length}</span>
          </h2>
          {g.items.map((c) => ChoreItem(c))}
        </section>
      ))}

      {members.length > 1 && (
        <FairnessBar members={members} points={pts30} label="Fordeling: siste 30 dager" />
      )}
    </div>
  );
}
