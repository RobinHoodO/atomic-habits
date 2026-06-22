import type { HomeMember } from "@/lib/home";
import { fairness } from "@/lib/home-cadence";

const SEG = ["bg-accent", "bg-good", "bg-neutral", "bg-bad"];

// Visualises the split of points between members + a balance verdict — the
// "is the distribution still fair?" question from the document, made live.
export default function FairnessBar({
  members,
  points,
  label,
}: {
  members: HomeMember[];
  points: Record<number, number>;
  label?: string;
}) {
  const ids = members.map((m) => m.user_id);
  const { shares, balance, total } = fairness(points, ids);
  const verdict =
    total === 0 ? "Ingen poeng ennå" : balance >= 0.85 ? "Rettferdig ⚖️" : balance >= 0.6 ? "Litt skjevt" : "Skjevt — snakk om det";

  return (
    <div className="card flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">{label ?? "Fordeling"}</span>
        <span className="text-xs text-muted">{verdict}</span>
      </div>
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-surface-2">
        {members.map((m, i) => (
          <div
            key={m.user_id}
            className={`${SEG[i % SEG.length]} h-full transition-all duration-500 ease-out first:rounded-l-full last:rounded-r-full`}
            style={{ width: `${Math.round((shares[m.user_id] ?? 0) * 100)}%` }}
            title={`${m.name}: ${points[m.user_id] ?? 0} p`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {members.map((m, i) => (
          <span key={m.user_id} className="flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${SEG[i % SEG.length]}`} />
            {m.name} · <strong>{points[m.user_id] ?? 0} p</strong>
            <span className="text-muted">({Math.round((shares[m.user_id] ?? 0) * 100)}%)</span>
          </span>
        ))}
      </div>
    </div>
  );
}
