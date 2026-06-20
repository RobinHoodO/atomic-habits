import {
  addDays,
  isScheduledDay,
  parseSchedule,
  todayStr,
  weekday,
} from "@/lib/score";

// GitHub-style "don't break the chain" grid for the last ~17 weeks.
// Green = completed, dim = scheduled-but-missed, faint = not scheduled.
export default function ChainCalendar({
  completed,
  schedule,
  weeks = 17,
}: {
  completed: Set<string>;
  schedule: string;
  weeks?: number;
}) {
  const sched = parseSchedule(schedule);
  const today = todayStr();
  // start on the Sunday of the earliest week so columns align to weekdays
  const span = weeks * 7;
  let start = addDays(today, -(span - 1));
  start = addDays(start, -weekday(start)); // back up to Sunday

  const columns: string[][] = [];
  let cur = start;
  while (cur <= today) {
    const col: string[] = [];
    for (let d = 0; d < 7; d++) {
      col.push(cur);
      cur = addDays(cur, 1);
    }
    columns.push(col);
  }

  function cellClass(date: string): string {
    if (date > today) return "bg-transparent";
    if (completed.has(date)) return "bg-good";
    if (isScheduledDay(date, sched)) return "bg-[var(--surface-2)]";
    return "bg-[var(--surface)] opacity-40";
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1">
        {columns.map((col, i) => (
          <div key={i} className="flex flex-col gap-1">
            {col.map((date) => (
              <div
                key={date}
                title={`${date}${completed.has(date) ? " ✓" : ""}`}
                className={`h-3 w-3 rounded-sm ${cellClass(date)}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
