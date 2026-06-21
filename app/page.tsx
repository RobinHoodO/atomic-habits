import Link from "next/link";
import { redirect } from "next/navigation";
import {
  listHabits,
  listIdentities,
  statsFor,
  isDone,
} from "@/lib/habits";
import { parseSchedule, isScheduledDay, todayStr } from "@/lib/score";
import { requireUser } from "@/lib/session";
import HabitCard from "@/components/HabitCard";
import GameStrip from "@/components/GameStrip";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await requireUser();
  const today = todayStr();
  const habits = listHabits(user.id);
  const identities = listIdentities(user.id);
  // Only greet true cold-starts with the wizard. A returning user who archived
  // everything sees the Today empty state instead of a redirect loop.
  if (habits.length === 0 && identities.length === 0) redirect("/onboarding");
  const identityName = new Map(identities.map((i) => [i.id, i.name]));

  const rows = habits.map((h) => {
    const stats = statsFor(h, user.id, today);
    return {
      habit: h,
      stats,
      done: isDone(h.id, user.id, today),
      scheduledToday: isScheduledDay(today, parseSchedule(h.schedule)),
    };
  });

  // due (scheduled, not done) first → then done today → then off-schedule
  const rank = (r: (typeof rows)[number]) =>
    r.scheduledToday && !r.done ? 0 : r.done ? 1 : 2;
  rows.sort((a, b) => rank(a) - rank(b));

  const dueCount = rows.filter((r) => r.scheduledToday && !r.done).length;

  return (
    <div className="flex flex-col gap-4">
      <GameStrip userId={user.id} />
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold">Today</h1>
          <p className="text-sm text-muted">{today}</p>
        </div>
        <p className="text-sm text-muted">
          {habits.length === 0
            ? ""
            : dueCount === 0
              ? "All done for today 🎉"
              : `${dueCount} due`}
        </p>
      </header>

      {habits.length === 0 ? (
        <div className="card text-center text-muted">
          <p>No habits yet.</p>
          <Link href="/habits/new" className="btn btn-primary mt-3 inline-flex">
            Create your first habit
          </Link>
          <p className="mt-3 text-xs">
            Tip: start with an{" "}
            <Link href="/identities" className="text-accent">identity</Link> — “I am a
            runner” — then add the tiny habit that votes for it.
          </p>
        </div>
      ) : (
        rows.map((r) => (
          <HabitCard
            key={r.habit.id}
            habit={r.habit}
            stats={r.stats}
            done={r.done}
            date={today}
            identityName={
              r.habit.identity_id ? identityName.get(r.habit.identity_id) : null
            }
          />
        ))
      )}
    </div>
  );
}
