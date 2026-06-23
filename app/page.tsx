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
  const habits = await listHabits(user.id);
  const identities = await listIdentities(user.id);
  // Only greet true cold-starts with the wizard. A returning user who archived
  // everything sees the Today empty state instead of a redirect loop.
  if (habits.length === 0 && identities.length === 0) redirect("/onboarding");
  const identityName = new Map(identities.map((i) => [i.id, i.name]));

  const rows = await Promise.all(
    habits.map(async (h) => {
      const stats = await statsFor(h, user.id, today);
      return {
        habit: h,
        stats,
        done: await isDone(h.id, user.id, today),
        scheduledToday: isScheduledDay(today, parseSchedule(h.schedule)),
      };
    }),
  );

  // due (scheduled, not done) first → then done today → then off-schedule
  const rank = (r: (typeof rows)[number]) =>
    r.scheduledToday && !r.done ? 0 : r.done ? 1 : 2;
  rows.sort((a, b) => rank(a) - rank(b));

  const dueCount = rows.filter((r) => r.scheduledToday && !r.done).length;

  return (
    <div className="flex flex-col gap-4">
      <GameStrip userId={user.id} />
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Today</h1>
          <p className="mt-0.5 text-sm text-muted">{today}</p>
        </div>
        {habits.length > 0 &&
          (dueCount === 0 ? (
            <span className="rounded-full bg-good/10 px-2.5 py-1 text-xs font-medium text-good">
              All done 🎉
            </span>
          ) : (
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
              {dueCount} due
            </span>
          ))}
      </header>

      {habits.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-10 text-center text-muted">
          <p className="text-base text-foreground">No habits yet.</p>
          <Link href="/habits/new" className="btn btn-primary inline-flex">
            Create your first habit
          </Link>
          <p className="max-w-sm text-xs leading-relaxed">
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
