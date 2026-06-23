import Link from "next/link";
import {
  listConnections,
  pendingIncoming,
  visibleHabitsOf,
  statsFor,
  listBacking,
} from "@/lib/habits";
import { todayStr } from "@/lib/score";
import { requireUser } from "@/lib/session";
import {
  requestConnectionAction,
  acceptConnectionAction,
} from "@/app/actions";
import { pct } from "@/components/ScoreBadge";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const user = await requireUser();
  const today = todayStr();
  const connections = await listConnections(user.id);
  const incoming = await pendingIncoming(user.id);
  const backing = await Promise.all(
    (await listBacking(user.id)).map(async (b) => ({
      ...b,
      stats: await statsFor(b.habit, b.habit.owner_id, today),
    })),
  );
  // each connection + their visible habits with stats, precomputed (async)
  const connectionBlocks = await Promise.all(
    connections.map(async (c) => {
      const habits = await visibleHabitsOf(c.user_id, user.id);
      const withStats = await Promise.all(
        habits.map(async (h) => ({ h, s: await statsFor(h, c.user_id, today) })),
      );
      return { c, withStats };
    }),
  );

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-bold">People</h1>
        <p className="text-sm text-muted">
          Connect to follow each other's progress and pair up on habits.
        </p>
      </header>

      {/* add by email */}
      <form action={requestConnectionAction} className="card flex flex-wrap items-end gap-2 text-sm">
        <div className="flex-1">
          <label className="label">Connect by email</label>
          <input className="input" type="email" name="email" placeholder="their@email.com" required />
        </div>
        <button className="btn btn-primary">Send request</button>
      </form>

      {/* incoming requests */}
      {incoming.length > 0 && (
        <section className="card">
          <h2 className="mb-2 text-sm font-semibold text-muted">Requests</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {incoming.map((c) => (
              <li key={c.id} className="flex items-center justify-between">
                <span>{c.name} <span className="text-muted">({c.email})</span></span>
                <form action={acceptConnectionAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="btn btn-primary">Accept</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* people counting on you (you're their accountability partner) */}
      {backing.length > 0 && (
        <section className="card">
          <h2 className="mb-2 text-sm font-semibold text-muted">People counting on you</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {backing.map((b) => (
              <li
                key={b.habit.id}
                className={`flex items-center justify-between rounded border px-3 py-2 ${
                  b.stats.missedTwice ? "border-bad/40 bg-bad/10" : "border-border bg-surface-2"
                }`}
              >
                <span>
                  <strong>{b.owner_name}</strong> — {b.habit.name}
                  <span className="text-muted"> · 🔥 {b.stats.streak}</span>
                </span>
                {b.stats.missedTwice ? (
                  <span className="font-medium text-bad">slipped twice — give them a nudge</span>
                ) : (
                  <span className="text-muted">on track</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* connections + their visible progress */}
      {connections.length === 0 ? (
        <div className="card flex flex-col gap-1 text-sm text-muted">
          <span className="font-medium text-foreground">No connections yet.</span>
          <span>Add someone by email above (they need an account too). Once connected you can follow each other’s habits, pair up on a shared one, and run check-in challenges.</span>
        </div>
      ) : (
        connectionBlocks.map(({ c, withStats }) => {
          return (
            <section key={c.user_id} className="card">
              <h2 className="font-semibold">{c.name}</h2>
              {withStats.length === 0 ? (
                <p className="mt-1 text-sm text-muted">No shared habits.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1 text-sm">
                  {withStats.map(({ h, s }) => {
                    return (
                      <li key={h.id} className="flex items-center justify-between rounded border border-border bg-surface-2 px-3 py-1.5">
                        <span>{h.name}</span>
                        <span className="text-muted">
                          🔥 {s.streak} · {pct(s.consistency)}
                          {s.missedTwice && <span className="ml-2 text-bad">needs a nudge</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })
      )}

      <p className="text-xs text-muted">
        Set a habit's sharing to “connections” (on <Link href="/habits" className="text-accent">Habits</Link>) to let people follow it.
      </p>
    </div>
  );
}
