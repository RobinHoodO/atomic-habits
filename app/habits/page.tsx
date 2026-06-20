import Link from "next/link";
import { listHabits, listIdentities, statsFor, isDone } from "@/lib/habits";
import { todayStr } from "@/lib/score";
import { requireUser } from "@/lib/session";
import HabitCard from "@/components/HabitCard";

export const dynamic = "force-dynamic";

export default async function HabitsPage() {
  const user = await requireUser();
  const today = todayStr();
  const habits = listHabits(user.id);
  const identityName = new Map(listIdentities(user.id).map((i) => [i.id, i.name]));

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
        habits.map((h) => (
          <HabitCard
            key={h.id}
            habit={h}
            stats={statsFor(h, user.id, today)}
            done={isDone(h.id, user.id, today)}
            date={today}
            identityName={h.identity_id ? identityName.get(h.identity_id) : null}
          />
        ))
      )}
    </div>
  );
}
