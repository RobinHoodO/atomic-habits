import Link from "next/link";
import type { Habit, HabitStats } from "@/lib/habits";
import CheckOff from "./CheckOff";
import ScoreBadge, { pct } from "./ScoreBadge";

const typeStyle: Record<string, string> = {
  good: "text-good border-good",
  bad: "text-bad border-bad",
  neutral: "text-neutral border-neutral",
};

// Native <details> disclosure: expanded while there's something to do, collapsed
// to a ticked one-line row once done. Click the row to expand/collapse any habit.
// ponytail: no client JS — the `open` attr is set per render and the page
// revalidates after a check-off, so done habits auto-minimise.
export default function HabitCard({
  habit,
  stats,
  done,
  date,
  identityName,
}: {
  habit: Habit;
  stats: HabitStats;
  done: boolean;
  date: string;
  identityName?: string | null;
}) {
  const intention =
    habit.intention_time || habit.intention_location
      ? `I will ${habit.name}${habit.intention_time ? ` at ${habit.intention_time}` : ""}${
          habit.intention_location ? ` in ${habit.intention_location}` : ""
        }`
      : null;

  return (
    <details open={!done} className="card group p-0">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-sm ${
            done ? "border-good bg-good/15 text-good" : "border-border text-transparent"
          }`}
        >
          ✓
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate font-semibold ${done ? "text-muted line-through" : ""}`}
          >
            {habit.name}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded border px-1.5 py-0.5 ${typeStyle[habit.type]}`}>
              {habit.type === "good" ? "+" : habit.type === "bad" ? "−" : "="} {habit.type}
            </span>
            {identityName && <span className="text-muted">→ {identityName}</span>}
            {stats.streak > 0 && <span className="text-good">🔥 {stats.streak}</span>}
          </span>
        </span>
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-90"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M7 5l6 5-6 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>

      <div className="flex flex-col gap-3 px-4 pb-4">
        <Link href={`/habits/${habit.id}`} className="text-xs text-accent hover:underline">
          Open habit →
        </Link>
        {intention && <p className="text-sm text-muted italic">{intention}</p>}

        {stats.missedTwice && (
          <div className="rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
            ⚠ Never miss twice — you slipped the last two times. Getting back on{" "}
            <strong>today</strong> is the win.
          </div>
        )}

        <CheckOff
          habitId={habit.id}
          done={done}
          date={date}
          type={habit.type}
          gatewayText={habit.gateway_text}
        />

        <div className="grid grid-cols-4 gap-2">
          <ScoreBadge label="streak" value={stats.streak} tone={stats.streak > 0 ? "good" : "default"} />
          <ScoreBadge label="consistency" value={pct(stats.consistency)} />
          <ScoreBadge label="recovery" value={pct(stats.recovery)} />
          <ScoreBadge label="votes" value={stats.totalVotes} />
        </div>
      </div>
    </details>
  );
}
