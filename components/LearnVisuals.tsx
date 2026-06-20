"use client";

import { useState } from "react";

/* ---------------- 1% compounding curve ---------------- */
export function Compounding() {
  const [pct, setPct] = useState(1);
  const r = pct / 100;
  const days = 365;
  const W = 540, H = 230, pad = 34;
  const better = (t: number) => Math.pow(1 + r, t);
  const worse = (t: number) => Math.pow(1 - r, t);
  const maxY = better(days);
  const xs = (t: number) => pad + (t / days) * (W - 2 * pad);
  const ys = (v: number) => H - pad - (v / maxY) * (H - 2 * pad);
  const path = (f: (t: number) => number) => {
    let d = "";
    for (let t = 0; t <= days; t += 5) d += `${t === 0 ? "M" : "L"}${xs(t).toFixed(1)} ${ys(f(t)).toFixed(1)}`;
    return d;
  };
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-3 text-sm">
        <span className="text-muted">Daily change</span>
        <input type="range" min={1} max={3} step={1} value={pct} onChange={(e) => setPct(+e.target.value)} className="flex-1" />
        <span className="font-mono font-semibold">{pct}%</span>
      </label>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-border bg-surface-2">
        <line x1={pad} y1={ys(1)} x2={W - pad} y2={ys(1)} stroke="var(--border)" strokeDasharray="4 4" />
        <path d={path(worse)} fill="none" stroke="var(--bad)" strokeWidth="2.5" />
        <path d={path(better)} fill="none" stroke="var(--good)" strokeWidth="2.5" />
        <circle cx={xs(days)} cy={ys(better(days))} r="4" fill="var(--good)" />
        <circle cx={xs(days)} cy={ys(worse(days))} r="4" fill="var(--bad)" />
      </svg>
      <div className="flex justify-between text-sm">
        <span className="text-good">1% better daily → <strong>{better(days).toFixed(1)}×</strong> in a year</span>
        <span className="text-bad">1% worse → <strong>{worse(days).toFixed(2)}×</strong></span>
      </div>
    </div>
  );
}

/* ---------------- clickable habit loop ---------------- */
const LOOP = [
  { label: "Cue", law: "Make it obvious", desc: "The trigger that starts the behavior — a time, place, or preceding action your brain notices." },
  { label: "Craving", law: "Make it attractive", desc: "The motivation. You don't crave the habit itself, but the change of state it delivers." },
  { label: "Response", law: "Make it easy", desc: "The habit you actually perform — scaled down enough that you'll reliably do it." },
  { label: "Reward", law: "Make it satisfying", desc: "The payoff that satisfies the craving and teaches your brain to repeat the loop." },
];
export function HabitLoop() {
  const [i, setI] = useState(0);
  const cx = 150, cy = 110, R = 78;
  const pos = (k: number) => {
    const a = -Math.PI / 2 + (k * Math.PI) / 2;
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  };
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <svg viewBox="0 0 300 220" className="w-full">
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--border)" strokeWidth="2" />
        {LOOP.map((n, k) => {
          const p = pos(k);
          const active = k === i;
          return (
            <g key={n.label} onClick={() => setI(k)} className="cursor-pointer">
              <circle cx={p.x} cy={p.y} r="26" fill={active ? "var(--accent)" : "var(--surface)"} stroke="var(--accent)" strokeWidth="2" />
              <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill={active ? "#fff" : "var(--foreground)"}>{n.label}</text>
            </g>
          );
        })}
      </svg>
      <div className="flex flex-col justify-center gap-2">
        <div className="text-xs uppercase tracking-wide text-accent">{LOOP[i].law}</div>
        <div className="text-lg font-semibold">{LOOP[i].label}</div>
        <p className="text-sm text-muted">{LOOP[i].desc}</p>
        <p className="text-xs text-muted">Tap each stage of the loop.</p>
      </div>
    </div>
  );
}

/* ---------------- Four Laws build/break toggle ---------------- */
const LAWS = [
  { stage: "Cue", build: "Make it obvious", break: "Make it invisible" },
  { stage: "Craving", build: "Make it attractive", break: "Make it unattractive" },
  { stage: "Response", build: "Make it easy", break: "Make it difficult" },
  { stage: "Reward", build: "Make it satisfying", break: "Make it unsatisfying" },
];
export function FourLaws() {
  const [mode, setMode] = useState<"build" | "break">("build");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <button onClick={() => setMode("build")} className={`btn ${mode === "build" ? "btn-primary" : ""}`}>Build a good habit</button>
        <button onClick={() => setMode("break")} className={`btn ${mode === "break" ? "btn-primary" : ""}`}>Break a bad one</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {LAWS.map((l) => (
          <div key={l.stage} className="rounded-lg border border-border bg-surface-2 p-3">
            <div className="text-xs uppercase tracking-wide text-muted">{l.stage}</div>
            <div className={`mt-1 font-medium ${mode === "build" ? "text-good" : "text-bad"}`}>{l[mode]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- plateau of latent potential ---------------- */
export function Plateau() {
  const [show, setShow] = useState(false);
  const W = 540, H = 220, pad = 34;
  const xs = (t: number) => pad + t * (W - 2 * pad);
  const ys = (v: number) => H - pad - v * (H - 2 * pad);
  let expected = "", actual = "";
  for (let t = 0; t <= 1; t += 0.02) {
    expected += `${t === 0 ? "M" : "L"}${xs(t).toFixed(1)} ${ys(t).toFixed(1)}`;
    actual += `${t === 0 ? "M" : "L"}${xs(t).toFixed(1)} ${ys(Math.pow(t, 3.2)).toFixed(1)}`;
  }
  return (
    <div className="flex flex-col gap-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-border bg-surface-2">
        <path d={expected} fill="none" stroke="var(--border)" strokeWidth="2" strokeDasharray="5 5" />
        <path d={actual} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
        {show && (
          <>
            <line x1={xs(0.62)} y1={ys(0.62)} x2={xs(0.62)} y2={ys(Math.pow(0.62, 3.2))} stroke="var(--bad)" strokeWidth="1.5" />
            <text x={xs(0.30)} y={ys(0.18)} fontSize="11" fill="var(--muted)">Valley of Disappointment</text>
          </>
        )}
        <text x={W - pad - 4} y={ys(1) - 6} textAnchor="end" fontSize="10" fill="var(--muted)">what you expect</text>
        <text x={W - pad - 4} y={ys(0.9) + 14} textAnchor="end" fontSize="10" fill="var(--accent)">what happens</text>
      </svg>
      <button onClick={() => setShow((s) => !s)} className="btn self-start">{show ? "Hide" : "Show"} the gap</button>
      <p className="text-sm text-muted">Results lag effort. Habits feel useless until you cross a threshold — most people quit in the valley. Your work is accumulating even when the scoreboard hasn't moved.</p>
    </div>
  );
}

/* ---------------- identity layers ---------------- */
export function IdentityLayers() {
  const [open, setOpen] = useState(2);
  const layers = [
    { name: "Outcomes", note: "What you get — lose weight, publish a book. Most people start here.", color: "var(--neutral)" },
    { name: "Processes", note: "What you do — your systems, routines, the daily habit.", color: "var(--accent)" },
    { name: "Identity", note: "What you believe — “I am a runner.” Lasting change starts here. Every habit is a vote for it.", color: "var(--good)" },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-border bg-surface-2 p-4">
        {layers.map((l, k) => (
          <button
            key={l.name}
            onClick={() => setOpen(k)}
            className="rounded-full border px-4 py-2 text-sm font-medium transition"
            style={{
              width: `${70 + k * 28}%`,
              borderColor: l.color,
              background: open === k ? l.color : "transparent",
              color: open === k ? "#fff" : "var(--foreground)",
            }}
          >
            {l.name}
          </button>
        ))}
      </div>
      <div className="flex flex-col justify-center gap-2">
        <div className="text-lg font-semibold">{layers[open].name}</div>
        <p className="text-sm text-muted">{layers[open].note}</p>
        <p className="text-xs text-muted">The core drives the rest — change from the inside out.</p>
      </div>
    </div>
  );
}
