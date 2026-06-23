import Link from "next/link";
import { listHabits, listIdentities, statsFor, isDone } from "@/lib/habits";
import { todayStr } from "@/lib/score";
import { requireUser } from "@/lib/session";
import HabitCard from "@/components/HabitCard";

export const dynamic = "force-dynamic";

export default async function HabitsPage() {
  const user = await requireUser();
  const today = todayStr();
  const habits = await listHabits(user.id);
  const identityName = new Map((await listIdentities(user.id)).map((i) => [i.id, i.name]));
  const rows = await Promise.all(
    habits.map(async (h) => ({
      habit: h,
      stats: await statsFor(h, user.id, today),
      done: await isDone(h.id, user.id, today),
    })),
  );

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Habits — Scorecard</h1>
          <p className="text-sm text-muted">+ good · − bad · = neutral</p>
        </div>
        <Link href="/habits/new" className="btn btn-primary">+ New habit</Link>
      </header>

      {habits.length === 0 ? (
        <div className="card text-muted">No habits yet.</div>
      ) : (
        rows.map((r) => (
          <HabitCard
            key={r.habit.id}
            habit={r.habit}
            stats={r.stats}
            done={r.done}
            date={today}
            identityName={r.habit.identity_id ? identityName.get(r.habit.identity_id) : null}
          />
        ))
      )}
    </div>
  );
}
