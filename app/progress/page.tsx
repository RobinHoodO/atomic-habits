import { requireUser } from "@/lib/session";
import { userXp, listAchievements, availableFreezes } from "@/lib/habits";
import { levelForXp, BADGES } from "@/lib/gamify";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const user = await requireUser();
  const xp = await userXp(user.id);
  const lvl = levelForXp(xp);
  const earned = new Map((await listAchievements(user.id)).map((a) => [a.key, a.earned_at]));
  const freezes = await availableFreezes(user.id);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-bold">Your progress</h1>
        <p className="text-sm text-muted">XP and levels come from showing up — every check-in counts.</p>
      </header>

      {/* level */}
      <div className="card flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent text-2xl font-bold text-white">
          {lvl.level}
        </div>
        <div className="flex-1">
          <div className="flex items-baseline justify-between">
            <span className="font-semibold">Level {lvl.level}</span>
            <span className="text-sm text-muted">{xp} XP</span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent" style={{ width: `${lvl.pct}%` }} />
          </div>
          <div className="mt-1 text-xs text-muted">{lvl.toNext} XP to level {lvl.level + 1}</div>
        </div>
      </div>

      {/* power-ups */}
      <div className="card flex items-center justify-between">
        <div>
          <div className="font-semibold">🧊 Streak freezes</div>
          <div className="text-xs text-muted">Earn one with each achievement; spend one to protect a missed day.</div>
        </div>
        <div className="text-2xl font-bold">{freezes}</div>
      </div>

      {/* badges — earned shown proudly; locked tucked behind a disclosure so a
          new user isn't greeted by a wall of grey padlocks. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted">
          Achievements · {earned.size}/{BADGES.length}
        </h2>

        {earned.size === 0 ? (
          <p className="text-sm text-muted">
            None yet — your first check-in unlocks one. 🎯
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {BADGES.filter((b) => earned.has(b.key)).map((b) => (
              <div key={b.key} className="flex flex-col items-center gap-1 rounded-xl border border-border bg-surface p-3 text-center" title={b.desc}>
                <div className="text-3xl">{b.emoji}</div>
                <div className="text-xs font-medium">{b.title}</div>
                <div className="text-[0.65rem] text-muted">{b.desc}</div>
              </div>
            ))}
          </div>
        )}

        {earned.size < BADGES.length && (
          <details className="group">
            <summary className="cursor-pointer list-none text-xs text-muted hover:text-foreground">
              ▸ {BADGES.length - earned.size} still to unlock
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {BADGES.filter((b) => !earned.has(b.key)).map((b) => (
                <div key={b.key} className="flex flex-col items-center gap-1 rounded-xl border border-border bg-surface-2 p-3 text-center opacity-60" title={b.desc}>
                  <div className="text-3xl">🔒</div>
                  <div className="text-xs font-medium">{b.title}</div>
                  <div className="text-[0.65rem] text-muted">{b.desc}</div>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>
    </div>
  );
}
