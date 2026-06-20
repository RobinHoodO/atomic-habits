import Link from "next/link";
import { userXp, listAchievements } from "@/lib/habits";
import { levelForXp, BADGES } from "@/lib/gamify";

// Compact level + XP bar + latest badge, links to /progress.
export default function GameStrip({ userId }: { userId: number }) {
  const xp = userXp(userId);
  const lvl = levelForXp(xp);
  const earned = listAchievements(userId);
  const latest = earned[0] ? BADGES.find((b) => b.key === earned[0].key) : undefined;

  return (
    <Link href="/progress" className="card flex items-center gap-4 hover:border-accent">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-lg font-bold text-white">
        {lvl.level}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold">Level {lvl.level}</span>
          <span className="text-xs text-muted">{xp} XP · {lvl.toNext} to next</span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${lvl.pct}%` }} />
        </div>
      </div>
      {latest && <div className="text-2xl" title={`${latest.title} — ${latest.desc}`}>{latest.emoji}</div>}
    </Link>
  );
}
