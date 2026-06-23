import Link from "next/link";
import { userXp, listAchievements } from "@/lib/habits";
import { levelForXp, BADGES } from "@/lib/gamify";

// Compact level + XP bar + latest badge, links to /progress.
export default async function GameStrip({ userId }: { userId: number }) {
  const xp = await userXp(userId);
  // Don't show the level chrome until there's a reason to — an empty Level 1 bar
  // before the first check-in just demotivates a new user.
  if (xp === 0) return null;
  const lvl = levelForXp(xp);
  const earned = await listAchievements(userId);
  const latest = earned[0] ? BADGES.find((b) => b.key === earned[0].key) : undefined;

  return (
    <Link href="/progress" className="card card-link flex items-center gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-lg font-bold text-white shadow-[0_2px_8px_-2px_rgba(79,70,229,0.5)]">
        {lvl.level}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold tracking-tight">Level {lvl.level}</span>
          <span className="text-xs text-muted tabular-nums">{xp} XP · {lvl.toNext} to next</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent transition-all duration-500 ease-out" style={{ width: `${lvl.pct}%` }} />
        </div>
      </div>
      {latest && <div className="text-2xl" title={`${latest.title} — ${latest.desc}`}>{latest.emoji}</div>}
    </Link>
  );
}
