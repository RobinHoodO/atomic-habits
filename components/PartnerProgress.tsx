import { statsFor, type Habit, type Member } from "@/lib/habits";
import { pct } from "./ScoreBadge";

// Side-by-side progress for every member of a paired habit.
export default async function PartnerProgress({
  habit,
  members,
  today,
}: {
  habit: Habit;
  members: Member[];
  today: string;
}) {
  const rows = await Promise.all(
    members.map(async (m) => ({ m, s: await statsFor(habit, m.user_id, today) })),
  );
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(members.length, 3)}, minmax(0,1fr))` }}>
      {rows.map(({ m, s }) => {
        return (
          <div key={m.user_id} className="rounded-lg border border-border bg-surface-2 p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{m.name}</span>
              {m.role === "owner" && <span className="text-[0.65rem] uppercase text-muted">owner</span>}
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-good">{s.streak}</span>
              <span className="text-xs text-muted">day streak</span>
            </div>
            <div className="mt-1 text-xs text-muted">{pct(s.consistency)} consistent</div>
          </div>
        );
      })}
    </div>
  );
}
