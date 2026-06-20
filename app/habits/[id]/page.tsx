import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getHabit,
  getIdentity,
  statsFor,
  completionSet,
  isDone,
  listHabits,
  stacksInvolving,
  bundlesFor,
  envFor,
  contractFor,
  membersOf,
  isPaired,
  listConnections,
  availableFreezes,
  lastMissedDay,
  AuthzError,
} from "@/lib/habits";
import { todayStr } from "@/lib/score";
import { requireUser } from "@/lib/session";
import { addPartnerAction, useFreezeAction } from "@/app/actions";
import PartnerProgress from "@/components/PartnerProgress";
import {
  addStackAction,
  removeStackAction,
  addBundleAction,
  removeBundleAction,
  addEnvItemAction,
  removeEnvItemAction,
  saveContractAction,
  archiveHabitAction,
} from "@/app/actions";
import CheckOff from "@/components/CheckOff";
import ChainCalendar from "@/components/ChainCalendar";
import ScoreBadge, { pct } from "@/components/ScoreBadge";
import SubmitButton from "@/components/SubmitButton";
import DetailCoach from "@/components/DetailCoach";

export const dynamic = "force-dynamic";

const LAWS = {
  good: { cue: "Make it obvious", craving: "Make it attractive", response: "Make it easy", reward: "Make it satisfying" },
  bad: { cue: "Make it invisible", craving: "Make it unattractive", response: "Make it difficult", reward: "Make it unsatisfying" },
  neutral: { cue: "Cue", craving: "Craving", response: "Response", reward: "Reward" },
} as const;

export default async function HabitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  let habit;
  try {
    habit = getHabit(Number(id), user.id);
  } catch (e) {
    if (e instanceof AuthzError) notFound();
    throw e;
  }

  const today = todayStr();
  const stats = statsFor(habit, user.id, today);
  const completed = completionSet(habit.id, user.id);
  const identity = habit.identity_id ? getIdentity(habit.identity_id, habit.owner_id) : undefined;
  const stacks = stacksInvolving(habit.id);
  const bundles = bundlesFor(habit.id);
  const env = envFor(habit.id);
  const contract = contractFor(habit.id);
  const others = listHabits(user.id, true).filter((h) => h.id !== habit.id);
  const laws = LAWS[habit.type];
  const isBad = habit.type === "bad";
  const isOwner = habit.owner_id === user.id;

  // paired-habit / accountability data
  const members = membersOf(habit.id);
  const paired = isPaired(habit.id);
  const connections = isOwner ? listConnections(user.id) : [];
  const memberIds = new Set(members.map((m) => m.user_id));
  const invitable = connections.filter((c) => !memberIds.has(c.user_id));
  const member = memberIds.has(user.id);
  const freezes = member ? availableFreezes(user.id) : 0;
  const lastMiss = member ? lastMissedDay(habit, user.id) : null;

  const intention =
    habit.intention_time || habit.intention_location
      ? `I will ${habit.name}${habit.intention_time ? ` at ${habit.intention_time}` : ""}${habit.intention_location ? ` in ${habit.intention_location}` : ""}`
      : null;

  // Hand the coach the habit's current state so it CONTINUES strengthening this
  // habit instead of starting a fresh setup conversation.
  const coachContext = [
    `This habit already exists and is set up — do NOT restart setup.`,
    `Habit: "${habit.name}" (${habit.type}).`,
    habit.cue && `Cue: ${habit.cue}.`,
    habit.craving && `Craving: ${habit.craving}.`,
    habit.response && `Response: ${habit.response}.`,
    habit.reward && `Reward: ${habit.reward}.`,
    intention && `Intention: ${intention}.`,
    habit.gateway_text && `2-minute version: ${habit.gateway_text}.`,
    `So far — environment items: ${env.length}, temptation bundles: ${bundles.length}, contract: ${contract ? "set" : "none"}.`,
    `Continue developing it: suggest what's still missing and strengthen it via environment cues, a temptation bundle, and an accountability contract.`,
  ]
    .filter(Boolean)
    .join(" ");
  const coachOpening = `Welcome back — your habit "${habit.name}" is set up. Let's make it stick. Want me to suggest an environment cue, a temptation bundle, or an accountability contract?`;

  return (
    <DetailCoach opening={coachOpening} context={coachContext}>
      {/* header */}
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{habit.name}</h1>
          <p className="text-sm text-muted">
            {habit.type === "good" ? "+ good" : isBad ? "− bad (breaking)" : "= neutral"}
            {identity && <> · votes for <span className="text-foreground">{identity.name}</span></>}
          </p>
          {intention && <p className="mt-1 text-sm italic text-muted">{intention}</p>}
        </div>
        <div className="flex gap-2">
          <Link href={`/habits/${habit.id}/edit`} className="btn">Edit</Link>
        </div>
      </header>

      <div className="card flex flex-col gap-4">
        <CheckOff habitId={habit.id} done={isDone(habit.id, user.id, today)} date={today} type={habit.type} gatewayText={habit.gateway_text} />
        {stats.missedTwice && (
          <div className="rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
            ⚠ Never miss twice — get back on today.
          </div>
        )}
        <div className="grid grid-cols-4 gap-2">
          <ScoreBadge label="streak" value={stats.streak} tone={stats.streak > 0 ? "good" : "default"} />
          <ScoreBadge label="consistency" value={pct(stats.consistency)} />
          <ScoreBadge label="recovery" value={pct(stats.recovery)} />
          <ScoreBadge label="votes" value={stats.totalVotes} />
        </div>
        {member && lastMiss && freezes > 0 && (
          <form action={useFreezeAction} className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
            <span>🧊 Protect your missed day ({lastMiss}) — {freezes} freeze{freezes > 1 ? "s" : ""} left</span>
            <input type="hidden" name="habit_id" value={habit.id} />
            <input type="hidden" name="date" value={lastMiss} />
            <button className="btn">Use freeze</button>
          </form>
        )}
      </div>

      {/* accountability partners (paired habit) */}
      {paired && (
        <section className="card">
          <h2 className="mb-3 text-sm font-semibold text-muted">
            Accountability — you're in this together
          </h2>
          <PartnerProgress habit={habit} members={members} today={today} />
        </section>
      )}

      {isOwner && invitable.length > 0 && (
        <section className="card">
          <h2 className="mb-2 text-sm font-semibold text-muted">Invite an accountability partner</h2>
          <form action={addPartnerAction} className="flex flex-wrap items-end gap-2 text-sm">
            <input type="hidden" name="habit_id" value={habit.id} />
            <select name="partner_id" className="select w-auto" required defaultValue="">
              <option value="" disabled>pick a connection</option>
              {invitable.map((c) => (
                <option key={c.user_id} value={c.user_id}>{c.name}</option>
              ))}
            </select>
            <button className="btn">Pair up</button>
          </form>
          <p className="mt-2 text-xs text-muted">
            Both of you check in on your own; you'll see each other's progress side by side.
          </p>
        </section>
      )}

      {/* chain */}
      <section className="card">
        <h2 className="mb-2 text-sm font-semibold text-muted">Don’t break the chain</h2>
        <ChainCalendar completed={completed} schedule={habit.schedule} />
      </section>

      {/* habit loop */}
      <section className="card">
        <h2 className="mb-3 text-sm font-semibold text-muted">
          The habit loop {isBad && "(inverted — breaking)"}
        </h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {(["cue", "craving", "response", "reward"] as const).map((k) => (
            <div key={k} className="rounded-lg border border-border bg-surface-2 p-3">
              <div className="text-xs uppercase tracking-wide text-accent">{laws[k]}</div>
              <div className="mt-1">{habit[k] || <span className="text-muted">—</span>}</div>
            </div>
          ))}
        </div>
        {habit.gateway_text && (
          <p className="mt-3 text-sm text-muted">
            <span className="text-foreground">2-minute version:</span> {habit.gateway_text}
          </p>
        )}
      </section>

      {/* habit stacking */}
      <section className="card">
        <h2 className="mb-2 text-sm font-semibold text-muted">Habit stacking</h2>
        <ul className="mb-3 flex flex-col gap-1 text-sm">
          {stacks.length === 0 && <li className="text-muted">No stacks yet.</li>}
          {stacks.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded border border-border bg-surface-2 px-3 py-1.5">
              <span>After <strong>{s.anchor_name}</strong>, I will <strong>{s.stacked_name}</strong></span>
              <form action={removeStackAction}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="from" value={habit.id} />
                <button className="text-muted hover:text-bad">✕</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addStackAction} className="flex flex-wrap items-end gap-2 text-sm">
          <input type="hidden" name="from" value={habit.id} />
          <input type="hidden" name="anchor_habit_id" value={habit.id} />
          <span className="text-muted">After <strong>{habit.name}</strong>, I will…</span>
          <select name="stacked_habit_id" className="select w-auto" required defaultValue="">
            <option value="" disabled>pick a habit</option>
            {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button className="btn">Stack</button>
        </form>
      </section>

      {/* temptation bundling */}
      <section className="card">
        <h2 className="mb-2 text-sm font-semibold text-muted">Temptation bundling — make it attractive</h2>
        <ul className="mb-3 flex flex-col gap-1 text-sm">
          {bundles.length === 0 && <li className="text-muted">No bundles yet.</li>}
          {bundles.map((b) => (
            <li key={b.id} className="flex items-center justify-between rounded border border-border bg-surface-2 px-3 py-1.5">
              <span>Only while doing <strong>{habit.name}</strong>: {b.want_text}</span>
              <form action={removeBundleAction}>
                <input type="hidden" name="id" value={b.id} />
                <input type="hidden" name="habit_id" value={habit.id} />
                <button className="text-muted hover:text-bad">✕</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addBundleAction} data-coach="bundle" className="flex gap-2 text-sm">
          <input type="hidden" name="habit_id" value={habit.id} />
          <input className="input" name="want_text" placeholder="the thing you want (podcast, treat…)" required />
          <button className="btn">Add</button>
        </form>
      </section>

      {/* environment design */}
      <section className="card">
        <h2 className="mb-2 text-sm font-semibold text-muted">
          Environment design — {isBad ? "add friction" : "make the cue obvious"}
        </h2>
        <ul className="mb-3 flex flex-col gap-1 text-sm">
          {env.length === 0 && <li className="text-muted">Nothing yet.</li>}
          {env.map((e) => (
            <li key={e.id} className="flex items-center justify-between rounded border border-border bg-surface-2 px-3 py-1.5">
              <span>
                <span className={e.kind === "friction" ? "text-bad" : "text-good"}>
                  {e.kind === "friction" ? "friction" : "obvious"}
                </span>{" "}
                · {e.text}
              </span>
              <form action={removeEnvItemAction}>
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="habit_id" value={habit.id} />
                <button className="text-muted hover:text-bad">✕</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addEnvItemAction} data-coach="environment" className="flex flex-wrap gap-2 text-sm">
          <input type="hidden" name="habit_id" value={habit.id} />
          <input className="input flex-1" name="text" placeholder="lay out gym clothes / hide the snacks" required />
          <select name="kind" className="select w-auto" defaultValue={isBad ? "friction" : "obvious"}>
            <option value="obvious">make obvious</option>
            <option value="friction">add friction</option>
          </select>
          <button className="btn">Add</button>
        </form>
      </section>

      {/* habit contract */}
      <section className="card">
        <h2 className="mb-2 text-sm font-semibold text-muted">Habit contract — accountability</h2>
        <form action={saveContractAction} data-coach="contract" className="flex flex-col gap-3 text-sm">
          <input type="hidden" name="habit_id" value={habit.id} />
          <div>
            <label className="label req">Commitment</label>
            <input className="input" name="commitment" data-label="your commitment" defaultValue={contract?.commitment ?? ""} placeholder="I will stick to this habit because…" required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Stake</label>
              <input className="input" name="stake" defaultValue={contract?.stake ?? ""} placeholder="what's on the line" />
            </div>
            <div>
              <label className="label">Consequence</label>
              <input className="input" name="consequence" defaultValue={contract?.consequence ?? ""} placeholder="if I slip…" />
            </div>
            <div>
              <label className="label">Accountability partner</label>
              {connections.length > 0 ? (
                <select className="select" name="partner_user_id" defaultValue={contract?.partner_user_id ?? ""}>
                  <option value="">— none —</option>
                  {connections.map((c) => (
                    <option key={c.user_id} value={c.user_id}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <input className="input" name="partner_name" defaultValue={contract?.partner_name ?? ""} placeholder="connect with someone on People first" />
              )}
            </div>
          </div>
          <SubmitButton>Save contract</SubmitButton>
        </form>
      </section>

      {/* archive */}
      <form action={archiveHabitAction} className="self-start">
        <input type="hidden" name="id" value={habit.id} />
        <input type="hidden" name="archived" value={habit.archived ? "0" : "1"} />
        <button className="text-xs text-muted hover:text-bad">
          {habit.archived ? "Unarchive habit" : "Archive habit"}
        </button>
      </form>
    </DetailCoach>
  );
}
