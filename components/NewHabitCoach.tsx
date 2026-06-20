"use client";

import { useRef, useState } from "react";
import {
  ConversationProvider,
  useConversation,
  useConversationClientTool,
} from "@elevenlabs/react";

const HABIT_FIELDS = new Set([
  "name", "type", "cue", "craving", "response", "reward",
  "intention_time", "intention_location", "gateway_text", "visibility",
]);

// Wraps the (server-rendered) new-habit form and lets the voice coach fill its
// fields live by name. Inputs are uncontrolled, so we set the value with the
// native setter + dispatch events so the SubmitButton's validity updates too.
export default function NewHabitCoach({ children }: { children: React.ReactNode }) {
  return (
    <ConversationProvider>
      <CoachShell>{children}</CoachShell>
    </ConversationProvider>
  );
}

function CoachShell({ children }: { children: React.ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState("");

  function setField(name: string, value: string) {
    const form = wrapRef.current?.querySelector("form");
    const el = form?.elements.namedItem(name) as
      | HTMLInputElement
      | HTMLSelectElement
      | null;
    if (!el) return;
    const proto =
      el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  useConversationClientTool("set_field", (p: any) => {
    if (!p?.field || !HABIT_FIELDS.has(p.field) || p?.value == null) return "unknown field";
    setField(p.field, String(p.value));
    return `filled ${p.field}`;
  });
  // identity isn't created on this screen — acknowledge and move on
  useConversationClientTool("set_identity", () => "no identity field on this screen");

  const conversation = useConversation();
  const on =
    conversation.status === "connected" || conversation.status === "connecting";

  async function start() {
    setErr("");
    try {
      const res = await fetch("/api/coach/token");
      if (!res.ok) throw new Error();
      const { token } = await res.json();
      await conversation.startSession({
        conversationToken: token,
        connectionType: "webrtc",
        dynamicVariables: {
          coach_opening:
            "Hey! I'm your habits coach — let's design one habit that actually sticks, and I'll fill it in as we talk. First: what's the habit you want to build?",
          habit_context:
            "A brand-new habit — none of the fields are filled yet. Walk the full flow from the top.",
        },
      });
    } catch {
      setErr("Couldn't start the coach — allow mic access and try again.");
    }
  }

  return (
    <div ref={wrapRef} className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--accent)]/30 bg-[var(--accent-soft)] px-4 py-3">
        <div className="text-sm">
          <span className="font-semibold">🎙 Talk to your habit coach</span>
          <div className="text-xs text-muted">
            {on
              ? conversation.isSpeaking
                ? "Coach is speaking…"
                : "Listening — answer out loud"
              : "It'll fill this form in as you talk"}
          </div>
        </div>
        {on ? (
          <button onClick={() => conversation.endSession()} className="btn">Stop</button>
        ) : (
          <button onClick={start} className="btn btn-primary whitespace-nowrap">Coach me</button>
        )}
      </div>
      {err && <p className="text-xs text-bad">{err}</p>}
      {children}
    </div>
  );
}
