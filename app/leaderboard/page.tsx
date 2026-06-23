import Link from "next/link";
import { requireUser } from "@/lib/session";
import { leaderboard } from "@/lib/habits";
import { levelForXp } from "@/lib/gamify";

export const dynamic = "force-dynamic";

const MEDAL = ["🥇", "🥈", "🥉"];

export default async function LeaderboardPage() {
  const user = await requireUser();
  const rows = await leaderboard(user.id);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold">Leaderboard</h1>
        <p className="text-sm text-muted">You and your connections, ranked by XP.</p>
      </header>

      {rows.length <= 1 ? (
        <div className="card text-muted">
          Connect with people on <Link href="/people" className="text-accent">People</Link> to compete.
        </div>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <li
              key={r.user_id}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                r.me ? "border-accent bg-[var(--accent-soft)]" : "border-border bg-surface"
              }`}
            >
              <span className="w-7 text-center text-lg">{MEDAL[i] ?? i + 1}</span>
              <span className="flex-1 font-medium">{r.name}{r.me && <span className="ml-1 text-xs text-muted">(you)</span>}</span>
              <span className="text-xs text-muted">Lv {levelForXp(r.xp).level}</span>
              <span className="w-16 text-right font-semibold">{r.xp} XP</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
