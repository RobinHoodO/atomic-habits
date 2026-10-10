import { toggleCompletionAction } from "@/app/actions";
import CelebrateButton from "@/components/CelebrateButton";
import type { HabitType } from "@/lib/habits";

// Plain server-action forms — progressive enhancement, no client JS.
export default function CheckOff({
  habitId,
  done,
  date,
  type,
  gatewayText,
}: {
  habitId: number;
  done: boolean;
  date: string;
  type: HabitType;
  gatewayText?: string | null;
}) {
  const doneLabel = type === "bad" ? "✓ Avoided it" : "✓ Did it";
  const todoLabel = type === "bad" ? "Avoided it today" : "Mark done";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={toggleCompletionAction}>
        <input type="hidden" name="habit_id" value={habitId} />
        <input type="hidden" name="date" value={date} />
        {done ? (
          <button type="submit" className="btn">
            {`${doneLabel} — undo`}
          </button>
        ) : (
          <CelebrateButton className="btn btn-primary">{todoLabel}</CelebrateButton>
        )}
      </form>

      {!done && gatewayText && (
        <form action={toggleCompletionAction} title={`2-minute version: ${gatewayText}`}>
          <input type="hidden" name="habit_id" value={habitId} />
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="is_gateway" value="1" />
          <button type="submit" className="btn">
            Just showed up (2-min)
          </button>
        </form>
      )}
    </div>
  );
}
