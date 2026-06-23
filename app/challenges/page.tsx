import Link from "next/link";
import { requireUser } from "@/lib/session";
import {
  listChallenges,
  listConnections,
  checkinsBetween,
} from "@/lib/habits";
import { getUserById } from "@/lib/users";
import { todayStr } from "@/lib/score";
import { createChallengeAction, respondChallengeAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function ChallengesPage() {
  const user = await requireUser();
  const today = todayStr();
  const connections = await listConnections(user.id);
  const challenges = await listChallenges(user.id);
  const challengeRows = await Promise.all(
    challenges.map(async (ch) => ({
      ch,
      aName: (await getUserById(ch.a_user_id))?.name ?? "?",
      bName: (await getUserById(ch.b_user_id))?.name ?? "?",
      aScore: await checkinsBetween(ch.a_user_id, ch.starts_on, ch.ends_on),
      bScore: await checkinsBetween(ch.b_user_id, ch.starts_on, ch.ends_on),
    })),
  );

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-bold">Challenges</h1>
        <p className="text-sm text-muted">Head-to-head: most check-ins over the window wins.</p>
      </header>

      {/* create */}
      {connections.length === 0 ? (
        <div className="card text-muted">
          Connect with people on <Link href="/people" className="text-accent">People</Link> to challenge them.
        </div>
      ) : (
        <form action={createChallengeAction} className="card flex flex-wrap items-end gap-2 text-sm">
          <div>
            <label className="label">Challenge</label>
            <select name="to_user_id" className="select w-auto" required defaultValue="">
              <option value="" disabled>pick a connection</option>
              {connections.map((c) => <option key={c.user_id} value={c.user_id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">For</label>
            <select name="days" className="select w-auto" defaultValue="7">
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
            </select>
          </div>
          <button className="btn btn-primary">Send challenge</button>
        </form>
      )}

      {/* list */}
      {challengeRows.map(({ ch, aName, bName, aScore, bScore }) => {
        const finished = ch.status === "active" && today > ch.ends_on;
        const iAmB = ch.b_user_id === user.id;
        const lead = aScore === bScore ? "tie" : aScore > bScore ? aName : bName;

        return (
          <div key={ch.id} className="card flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">{aName} vs {bName}</span>
              <span className="text-xs text-muted">
                {ch.starts_on} → {ch.ends_on}
                {ch.status === "pending" && " · pending"}
                {ch.status === "declined" && " · declined"}
                {finished && " · finished"}
              </span>
            </div>

            {ch.status !== "pending" && ch.status !== "declined" && (
              <div className="flex items-center gap-4">
                <Score name={aName} score={aScore} lead={lead === aName} />
                <span className="text-muted">vs</span>
                <Score name={bName} score={bScore} lead={lead === bName} />
                {finished && (
                  <span className="ml-auto text-sm font-semibold text-good">
                    {lead === "tie" ? "Tie!" : `${lead} wins 🏆`}
                  </span>
                )}
              </div>
            )}

            {ch.status === "pending" && iAmB && (
              <div className="flex gap-2">
                <form action={respondChallengeAction}>
                  <input type="hidden" name="id" value={ch.id} />
                  <input type="hidden" name="accept" value="1" />
                  <button className="btn btn-primary">Accept</button>
                </form>
                <form action={respondChallengeAction}>
                  <input type="hidden" name="id" value={ch.id} />
                  <input type="hidden" name="accept" value="0" />
                  <button className="btn">Decline</button>
                </form>
              </div>
            )}
            {ch.status === "pending" && !iAmB && (
              <p className="text-xs text-muted">Waiting for {bName} to accept…</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Score({ name, score, lead }: { name: string; score: number; lead: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-1.5 text-center ${lead ? "border-good bg-good/10" : "border-border bg-surface-2"}`}>
      <div className="text-lg font-bold">{score}</div>
      <div className="text-[0.7rem] text-muted">{name}</div>
    </div>
  );
}
