import Link from "next/link";
import DayPicker from "@/components/DayPicker";
import NyPill, { NY_RING } from "@/components/NyPill";
import { GjortRow, GjortButton } from "@/components/GjortProvider";
import {
  skipChoreAction,
  postponeChoreAction,
  giveAwayChoreAction,
  setTaskDayAction,
  deleteTaskAction,
} from "@/app/home-actions";

export type RowKind = "habit" | "routine" | "task";
const ICON: Record<RowKind, string> = { habit: "🔁", routine: "🏠", task: "✓" };

// One row for I dag and the Oppgaver tab: a habit, a Home Routine or a Task.
// Gjort is optimistic (GjortProvider): the row hides at once and an Angre bar appears.
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
  isNew,
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
  isNew?: boolean; // added by the other person since I last looked at Varsler
}) {
  return (
    <GjortRow
      kind={kind}
      id={id}
      className={`card relative rounded-xl px-3 py-1.5 shadow-none ${dim ? "opacity-70" : ""} ${isNew ? NY_RING : ""}`}
    >
      <div className={`flex items-center justify-between gap-2 ${kind !== "habit" ? "pr-9" : ""}`}>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-medium tracking-tight">
            <span aria-hidden className="mr-1.5">{ICON[kind]}</span>
            {kind === "habit" ? <Link href={`/habits/${id}`} className="hover:underline">{title}</Link> : title}
            {isNew && (
              <span className="ml-2 align-middle">
                <NyPill />
              </span>
            )}
          </div>
          <div className="truncate text-xs text-muted">
            {when && <span className={late ? "font-medium text-bad" : ""}>{when}</span>}
            {meta.map((m, n) => <span key={m}>{n > 0 || when ? " · " : ""}{m}</span>)}
          </div>
        </div>
        <div className="shrink-0">
          <GjortButton kind={kind} id={id} title={title} date={date} />
        </div>
      </div>
      {kind !== "habit" && (
        <details className="text-xs">
          <summary
            aria-label="Mer"
            title="Mer"
            className="absolute right-1 top-1.5 flex h-10 w-9 cursor-pointer list-none items-center justify-center rounded-lg text-lg leading-none text-muted hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
          >
            ⋯
          </summary>
          <div className="mt-1.5 flex flex-col gap-2 border-t border-border pt-2">
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
    </GjortRow>
  );
}
