import type { Habit, Identity } from "@/lib/habits";
import { parseSchedule } from "@/lib/score";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// All inputs for creating/editing a habit. The surrounding <form action=...>
// and submit button live in the page.
export default function HabitFormFields({
  habit,
  identities,
}: {
  habit?: Habit;
  identities: Identity[];
}) {
  const sched = parseSchedule(habit?.schedule ?? "daily");
  const isWeekly = sched !== "daily";
  const checkedDays = new Set(isWeekly ? (sched as number[]) : []);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="label req">Habit</label>
        <input
          className="input"
          name="name"
          data-label="a habit name"
          required
          defaultValue={habit?.name ?? ""}
          placeholder="Read, run, meditate, no late-night scrolling…"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Type (scorecard +/−/=)</label>
          <select className="select" name="type" defaultValue={habit?.type ?? "good"}>
            <option value="good">+ Good (build it)</option>
            <option value="bad">− Bad (break it — invert the laws)</option>
            <option value="neutral">= Neutral</option>
          </select>
        </div>
        <div>
          <label className="label">Identity (who this makes you)</label>
          <select className="select" name="identity_id" defaultValue={habit?.identity_id ?? ""}>
            <option value="">— none —</option>
            {identities.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Schedule */}
      <div>
        <label className="label">Schedule</label>
        <select className="select mb-2" name="scheduleMode" defaultValue={isWeekly ? "weekly" : "daily"}>
          <option value="daily">Every day</option>
          <option value="weekly">Specific weekdays</option>
        </select>
        <div className="flex flex-wrap gap-3 text-sm">
          {DAYS.map((d, i) => (
            <label key={d} className="flex items-center gap-1 text-muted">
              <input type="checkbox" name="day" value={i} defaultChecked={checkedDays.has(i)} />
              {d}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">Weekday boxes only apply when “Specific weekdays” is selected.</p>
      </div>

      <div>
        <label className="label">Sharing</label>
        <select className="select" name="visibility" defaultValue={habit?.visibility ?? "private"}>
          <option value="private">Private — only you</option>
          <option value="connections">Visible to connections — they can follow your progress</option>
        </select>
      </div>

      {/* Implementation intention */}
      <fieldset className="rounded-lg border border-border p-3">
        <legend className="px-1 text-xs text-muted">Implementation intention — make it obvious</legend>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Time</label>
            <input className="input" type="time" name="intention_time" defaultValue={habit?.intention_time ?? ""} />
          </div>
          <div>
            <label className="label">Location</label>
            <input className="input" name="intention_location" defaultValue={habit?.intention_location ?? ""} placeholder="the bedroom, the gym…" />
          </div>
        </div>
      </fieldset>

      {/* 2-minute rule */}
      <div>
        <label className="label">2-minute version — make it easy (“just show up”)</label>
        <input className="input" name="gateway_text" defaultValue={habit?.gateway_text ?? ""} placeholder="Read one page · Put on running shoes" />
      </div>

      {/* Four Laws loop */}
      <fieldset className="rounded-lg border border-border p-3">
        <legend className="px-1 text-xs text-muted">
          The habit loop — Cue → Craving → Response → Reward (for bad habits, invert each)
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Cue (obvious / invisible)</label>
            <input className="input" name="cue" defaultValue={habit?.cue ?? ""} placeholder="After my morning coffee…" />
          </div>
          <div>
            <label className="label">Craving (attractive / unattractive)</label>
            <input className="input" name="craving" defaultValue={habit?.craving ?? ""} placeholder="Why you want it" />
          </div>
          <div>
            <label className="label">Response (easy / difficult)</label>
            <input className="input" name="response" defaultValue={habit?.response ?? ""} placeholder="The actual action" />
          </div>
          <div>
            <label className="label">Reward (satisfying / unsatisfying)</label>
            <input className="input" name="reward" defaultValue={habit?.reward ?? ""} placeholder="What you get / track" />
          </div>
        </div>
      </fieldset>
    </div>
  );
}
