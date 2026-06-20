export function pct(v: number | null): string {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

export default function ScoreBadge({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "good" | "bad" | "warn";
}) {
  const color =
    tone === "good"
      ? "text-good"
      : tone === "bad"
        ? "text-bad"
        : tone === "warn"
          ? "text-[var(--bad)]"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-center">
      <div className={`text-lg font-semibold ${color}`}>{value}</div>
      <div className="text-[0.7rem] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}
