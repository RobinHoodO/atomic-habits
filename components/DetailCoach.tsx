"use client";

import { useRef, useState } from "react";
import {
  ConversationProvider,
  useConversation,
  useConversationClientTool,
} from "@elevenlabs/react";

// Fills a form field by name; handles <select> by matching value or option text.
function setFormField(form: HTMLFormElement, name: string, value: string) {
  const el = form.elements.namedItem(name) as
    | HTMLInputElement
    | HTMLSelectElement
    | null;
  if (!el) return;
  if (el instanceof HTMLSelectElement) {
    const v = String(value).toLowerCase();
    const opt = Array.from(el.options).find(
      (o) => o.value === value || o.text.toLowerCase().includes(v),
    );
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(
      el,
      opt ? opt.value : value,
    );
  } else {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
      el,
      value,
    );
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

// Coach for the habit detail page — proposes environment items, temptation
// bundles, and the accountability contract by FILLING the tagged forms (the
// user reviews and saves).
export default function DetailCoach({
  children,
  opening,
  context,
}: {
  children: React.ReactNode;
  opening: string;
  context: string;
}) {
  return (
    <ConversationProvider>
      <Shell opening={opening} context={context}>
        {children}
      </Shell>
    </ConversationProvider>
  );
}

function Shell({
  children,
  opening,
  context,
}: {
  children: React.ReactNode;
  opening: string;
  context: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState("");
  const form = (kind: string) =>
    ref.current?.querySelector<HTMLFormElement>(`form[data-coach="${kind}"]`) ?? null;

  useConversationClientTool("add_environment", (p: any) => {
    const f = form("environment");
    if (!f || !p?.text) return "no environment form here";
    setFormField(f, "text", String(p.text));
    if (p.kind) setFormField(f, "kind", String(p.kind));
    return "proposed an environment item — review and click Add";
  });
  useConversationClientTool("add_bundle", (p: any) => {
    const f = form("bundle");
    if (!f || !p?.want) return "no bundle form here";
    setFormField(f, "want_text", String(p.want));
    return "proposed a bundle — review and click Add";
  });
  useConversationClientTool("set_contract", (p: any) => {
    const f = form("contract");
    if (!f || !p?.commitment) return "no contract form here";
    setFormField(f, "commitment", String(p.commitment));
    if (p.stake) setFormField(f, "stake", String(p.stake));
    if (p.consequence) setFormField(f, "consequence", String(p.consequence));
    if (p.partner) {
      if (f.elements.namedItem("partner_user_id")) setFormField(f, "partner_user_id", String(p.partner));
      else if (f.elements.namedItem("partner_name")) setFormField(f, "partner_name", String(p.partner));
    }
    return "filled the contract — review and save";
  });
  useConversationClientTool("set_field", () => "edit core fields on the Edit page");
  useConversationClientTool("set_identity", () => "not on this screen");

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
        dynamicVariables: { coach_opening: opening, habit_context: context },
      });
    } catch {
      setErr("Couldn't start the coach — allow mic access and try again.");
    }
  }

  return (
    <div ref={ref} className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--accent)]/30 bg-[var(--accent-soft)] px-4 py-3">
        <div className="text-sm">
          <span className="font-semibold">🎙 Coach: strengthen this habit</span>
          <div className="text-xs text-muted">
            {on
              ? conversation.isSpeaking
                ? "Coach is speaking…"
                : "Listening — ask for an environment cue, a bundle, or a contract"
              : "It can propose environment cues, a temptation bundle, and an accountability contract"}
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
