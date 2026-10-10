import Link from "next/link";
import DayPicker from "@/components/DayPicker";
import { toggleCompletionAction } from "@/app/actions";
import {
  logChoreAction,
  skipChoreAction,
  postponeChoreAction,
  giveAwayChoreAction,
  completeTaskAction,
  setTaskDayAction,
  deleteTaskAction,
} from "@/app/home-actions";

export type RowKind = "habit" | "routine" | "task";
const ICON: Record<RowKind, string> = { habit: "🔁", routine: "🏠", task: "✓" };

// One row for I dag and the Oppgaver tab: a habit, a Home Routine or a Task.
// "back" is where Gjort lands afterwards (it shows the Angre bar there).
export default function TodayRow({
  kind,
  id,
  title,
  when,
  late,
  meta,
  dim,
  giveTo,
  date,
  back,
}: {
  kind: RowKind;
  id: number;
  title: string;
  when?: string;
  late?: boolean;
  meta: string[];
  dim?: boolean;
  giveTo?: string | null; // partner name when Gi bort is allowed
  date: string; // today, for habit check-ins
  back: string;
}) {
  const doneAction = kind === "habit" ? toggleCompletionAction : kind === "routine" ? logChoreAction : completeTaskAction;
  return (
    <li className={`card flex flex-col gap-2 py-3 ${dim ? "opacity-70" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-medium tracking-tight">
            <span aria-hidden className="mr-1.5">{ICON[kind]}</span>
            {kind === "habit" ? <Link href={`/habits/${id}`} className="hover:underline">{title}</Link> : title}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
            {when && <span className={late ? "font-medium text-bad" : ""}>{when}</span>}
            {meta.map((m) => <span key={m}>{m}</span>)}
          </div>
        </div>
        <form action={doneAction} className="shrink-0">
          {kind === "habit" ? (
            <>
              <input type="hidden" name="habit_id" value={id} />
              <input type="hidden" name="date" value={date} />
            </>
          ) : (
            <>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="back" value={back} />
            </>
          )}
          <button className="btn btn-primary whitespace-nowrap">Gjort</button>
        </form>
      </div>
      {kind !== "habit" && (
        <details className="text-xs">
          <summary className="cursor-pointer list-none text-muted hover:text-foreground">⋯ Mer</summary>
          <div className="mt-2 flex flex-col gap-2">
            {kind === "routine" ? (
              <>
                <form action={postponeChoreAction} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={id} />
                  <span className="text-muted">Utsett:</span>
                  <DayPicker first="tomorrow" />
                  <button className="btn">OK</button>
                </form>
                <div className="flex flex-wrap gap-2">
                  <form action={skipChoreAction}>
                    <input type="hidden" name="id" value={id} />
                    <button className="btn">Hopp over</button>
                  </form>
                  {giveTo && (
                    <form action={giveAwayChoreAction}>
                      <input type="hidden" name="id" value={id} />
                      <button className="btn">Gi bort til {giveTo}</button>
                    </form>
                  )}
                  <Link href={`/home/chores#c${id}`} className="btn">Endre</Link>
                </div>
              </>
            ) : (
              <>
                <form action={setTaskDayAction} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={id} />
                  <DayPicker first="today" withLater />
                  <button className="btn">OK</button>
                </form>
                <form action={deleteTaskAction}>
                  <input type="hidden" name="id" value={id} />
                  <button className="text-muted hover:text-bad">Slett oppgaven</button>
                </form>
              </>
            )}
          </div>
        </details>
      )}
    </li>
  );
}
