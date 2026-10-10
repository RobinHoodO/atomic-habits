const PILL =
  "btn cursor-pointer has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-white";

// Day buttons for "add Task", the Task menu and Utsett. Posts field "day"
// (today | tomorrow | weekend | later | date) plus "date" for Velg dato.
export default function DayPicker({ first, withLater }: { first: "today" | "tomorrow"; withLater?: boolean }) {
  const opts: [string, string][] = [
    [first, first === "today" ? "I dag" : "I morgen"],
    ["weekend", "I helgen"],
    ...(withLater ? ([["later", "Senere"]] as [string, string][]) : []),
  ];
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {opts.map(([v, l], i) => (
        <label key={v} className={PILL}>
          <input type="radio" name="day" value={v} defaultChecked={i === 0} className="sr-only" />
          {l}
        </label>
      ))}
      <label className={PILL}>
        <input type="radio" name="day" value="date" className="sr-only" />
        Velg dato
      </label>
      <input type="date" name="date" className="input w-auto py-1 text-xs" aria-label="Dato" />
    </div>
  );
}
