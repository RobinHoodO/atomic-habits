"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ConversationProvider,
  useConversation,
  useConversationClientTool,
} from "@elevenlabs/react";
import { onboardingAction } from "@/app/actions";
import { Compounding } from "./LearnVisuals";

interface State {
  identity_name: string;
  identity_statement: string;
  name: string;
  type: string;
  cue: string;
  intention_time: string;
  intention_location: string;
  gateway_text: string;
}

const EMPTY: State = {
  identity_name: "",
  identity_statement: "",
  name: "",
  type: "good",
  cue: "",
  intention_time: "",
  intention_location: "",
  gateway_text: "",
};

const FIELD_STEP: Record<string, number> = {
  name: 2, type: 2, cue: 2,
  intention_time: 3, intention_location: 3,
  gateway_text: 4,
};

// The coach (useConversation / client tools) must live *inside* the provider.
export default function OnboardingWizard({ userName }: { userName: string }) {
  return (
    <ConversationProvider>
      <Wizard userName={userName} />
    </ConversationProvider>
  );
}

function Wizard({ userName }: { userName: string }) {
  const [step, setStep] = useState(0);
  const [s, setS] = useState<State>(EMPTY);
  const [pending, start] = useTransition();
  const [coachErr, setCoachErr] = useState("");
  const set = (k: keyof State, v: string) => setS((p) => ({ ...p, [k]: v }));

  // ---- the agent calls these to fill the form live ----
  useConversationClientTool("set_identity", (p: any) => {
    setS((cur) => ({
      ...cur,
      identity_name: p?.name ?? cur.identity_name,
      identity_statement: p?.statement ?? cur.identity_statement,
    }));
    setStep(1);
    return "filled identity";
  });
  useConversationClientTool("set_field", (p: any) => {
    const f = p?.field as keyof State | undefined;
    if (!f || !(f in FIELD_STEP) || p?.value == null) return "unknown field";
    setS((cur) => ({ ...cur, [f]: String(p.value) }));
    setStep(FIELD_STEP[f]);
    return `filled ${f}`;
  });

  const conversation = useConversation();
  const coachOn =
    conversation.status === "connected" || conversation.status === "connecting";

  async function startCoach() {
    setCoachErr("");
    try {
      const res = await fetch("/api/coach/token");
      if (!res.ok) throw new Error("token");
      const { token } = await res.json();
      await conversation.startSession({
        conversationToken: token,
        connectionType: "webrtc",
      });
    } catch {
      setCoachErr("Couldn't start the coach — allow mic access and try again.");
    }
  }

  const TOTAL = 5;
  const next = () => setStep((x) => Math.min(x + 1, TOTAL - 1));
  const back = () => setStep((x) => Math.max(x - 1, 0));

  function finish() {
    const fd = new FormData();
    Object.entries(s).forEach(([k, v]) => fd.set(k, v));
    start(() => onboardingAction(fd));
  }

  const canLeaveHabitStep = s.name.trim().length > 0;

  return (
    <div className="mx-auto max-w-lg">
      {/* voice coach */}
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[color:var(--accent)]/30 bg-[var(--accent-soft)] px-4 py-3">
        <div className="text-sm">
          <span className="font-semibold">🎙 Talk to your habit coach</span>
          <div className="text-xs text-muted">
            {coachOn
              ? conversation.isSpeaking
                ? "Coach is speaking…"
                : "Listening — just answer out loud"
              : "It'll interview you and fill this in as you talk"}
          </div>
        </div>
        {coachOn ? (
          <button onClick={() => conversation.endSession()} className="btn">Stop</button>
        ) : (
          <button onClick={startCoach} className="btn btn-primary whitespace-nowrap">Coach me</button>
        )}
      </div>
      {coachErr && <p className="mb-3 text-xs text-bad">{coachErr}</p>}

      {/* progress */}
      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((step + 1) / TOTAL) * 100}%` }} />
      </div>

      <div className="card flex flex-col gap-5">
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <h1 className="text-2xl font-bold">Welcome{userName ? `, ${userName}` : ""} 👋</h1>
            <p className="text-sm text-muted">
              You don't rise to your goals — you fall to your <strong>systems</strong>. This app helps you
              build the small, repeatable actions that compound. Every check-in is a vote for who you're becoming.
            </p>
            <div className="rounded-lg border border-border bg-surface-2 p-3"><Compounding /></div>
            <p className="text-sm text-muted">Let's set up your first habit the right way — it takes a minute.</p>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-accent">Identity first</div>
              <h2 className="text-xl font-bold">Who are you becoming?</h2>
            </div>
            <p className="text-sm text-muted">Decide the <em>type of person</em> first; the habit becomes proof. Optional, but it's the engine.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Identity</label>
                <input className="input" value={s.identity_name} onChange={(e) => set("identity_name", e.target.value)} placeholder="Runner" />
              </div>
              <div>
                <label className="label">Statement</label>
                <input className="input" value={s.identity_statement} onChange={(e) => set("identity_statement", e.target.value)} placeholder="I am a runner" />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-accent">Your first habit</div>
              <h2 className="text-xl font-bold">What's the one habit?</h2>
            </div>
            <div>
              <label className="label req">Habit</label>
              <input className="input" value={s.name} onChange={(e) => set("name", e.target.value)} placeholder="Go for a run" autoFocus />
              {!canLeaveHabitStep && <p className="mt-1 text-xs text-bad">Name your habit to continue.</p>}
            </div>
            <div>
              <label className="label">Type</label>
              <select className="select" value={s.type} onChange={(e) => set("type", e.target.value)}>
                <option value="good">+ Good — build it</option>
                <option value="bad">− Bad — break it</option>
                <option value="neutral">= Neutral</option>
              </select>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-accent">1st Law — make it obvious</div>
              <h2 className="text-xl font-bold">When &amp; where?</h2>
            </div>
            <p className="text-sm text-muted">People who decide <em>when</em> and <em>where</em> follow through far more. Pre-decide the moment.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Time</label>
                <input type="time" className="input" value={s.intention_time} onChange={(e) => set("intention_time", e.target.value)} />
              </div>
              <div>
                <label className="label">Location</label>
                <input className="input" value={s.intention_location} onChange={(e) => set("intention_location", e.target.value)} placeholder="the park" />
              </div>
            </div>
            <p className="text-sm italic text-muted">
              {s.intention_time || s.intention_location
                ? `“I will ${s.name || "…"}${s.intention_time ? ` at ${s.intention_time}` : ""}${s.intention_location ? ` in ${s.intention_location}` : ""}.”`
                : "I will [habit] at [time] in [location]."}
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-accent">3rd Law — make it easy</div>
              <h2 className="text-xl font-bold">Shrink it to two minutes</h2>
            </div>
            <p className="text-sm text-muted">Master showing up before optimising. What's the version so easy you can't say no?</p>
            <div>
              <label className="label">2-minute version</label>
              <input className="input" value={s.gateway_text} onChange={(e) => set("gateway_text", e.target.value)} placeholder="Put on my running shoes" />
            </div>
            <p className="text-sm text-muted">That's it — you're set up. You can refine all of this anytime on the habit's page.</p>
          </div>
        )}

        {/* controls */}
        <div className="flex items-center justify-between pt-2">
          <div>
            {step > 0 ? (
              <button onClick={back} className="btn">Back</button>
            ) : (
              <Link href="/habits/new" className="text-xs text-muted hover:text-foreground">Skip, I'll set up manually</Link>
            )}
          </div>
          {step < TOTAL - 1 ? (
            <button onClick={next} disabled={step === 2 && !canLeaveHabitStep} className="btn btn-primary disabled:opacity-45">
              Continue
            </button>
          ) : (
            <button onClick={finish} disabled={pending || !canLeaveHabitStep} className="btn btn-primary disabled:opacity-45">
              {pending ? "Setting up…" : "Start tracking"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
