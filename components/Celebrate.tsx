"use client";

import { useEffect, useState } from "react";
import { EFFECTS, PHRASES, THEMES, pick, pickDifferent, type Effect, type FunTheme } from "@/lib/fun";
import { playChime, playTaDa, primeAudio, setSoundOn, soundOn } from "@/lib/fun-sound";

// Fun mode. Everything here is client-only and imperative: particles are plain
// DOM nodes animated with the Web Animations API (transform/opacity only),
// appended to a pointer-events:none layer that removes itself after ~2 s.

export type Origin = { x: number; y: number };

const COLORS = ["#f472b6", "#a78bfa", "#38bdf8", "#facc15", "#34d399", "#fb923c", "#f87171"];
const MAX_PARTICLES = 60;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

let lastEffect: Effect | null = null;

export function originOf(el: Element | null): Origin {
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function reducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function layer(ms: number): HTMLDivElement {
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.style.cssText = "position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:9999";
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), ms);
  return el;
}

function particle(parent: HTMLElement, text: string | null, color: string | null, size: number): HTMLDivElement {
  const p = document.createElement("div");
  p.style.cssText = `position:absolute;left:0;top:0;will-change:transform,opacity;line-height:1;font-size:${size}px`;
  if (text) p.textContent = text;
  else {
    p.style.width = `${size * 0.6}px`;
    p.style.height = `${size}px`;
    p.style.background = color ?? "#f472b6";
    p.style.borderRadius = Math.random() < 0.3 ? "50%" : "2px";
  }
  parent.appendChild(p);
  return p;
}

function burst(parent: HTMLElement, o: Origin, items: Array<string | null>, count: number, ms: number, fountain: boolean) {
  for (let i = 0; i < count; i++) {
    const text = items.length ? pick(items) : null;
    const p = particle(parent, text, pick(COLORS), text ? rand(16, 28) : rand(8, 13));
    const angle = fountain ? rand(-Math.PI * 0.8, -Math.PI * 0.2) : rand(0, Math.PI * 2);
    const speed = rand(80, fountain ? 260 : 220);
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed;
    const fall = rand(120, 260);
    const rot = rand(-540, 540);
    p.animate(
      [
        { transform: `translate(${o.x}px,${o.y}px) rotate(0deg) scale(0.6)`, opacity: 1 },
        { transform: `translate(${o.x + dx}px,${o.y + dy}px) rotate(${rot / 2}deg) scale(1)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${o.x + dx * 1.2}px,${o.y + dy + fall}px) rotate(${rot}deg) scale(0.8)`, opacity: 0 },
      ],
      { duration: ms * rand(0.7, 1), easing: "cubic-bezier(.2,.7,.4,1)", fill: "forwards" },
    );
  }
}

function glitter(parent: HTMLElement, count: number, ms: number) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (let i = 0; i < count; i++) {
    const p = particle(parent, pick(["💎", "✨", "💎", "✨", "🔹"]), null, rand(14, 28));
    const x = rand(0, w);
    const sway = rand(-40, 40);
    p.animate(
      [
        { transform: `translate(${x}px,${-30}px) rotate(0deg) scale(0.7)`, opacity: 0 },
        { transform: `translate(${x + sway}px,${h * 0.3}px) rotate(120deg) scale(1.1)`, opacity: 1, offset: 0.2 },
        { transform: `translate(${x - sway}px,${h + 30}px) rotate(300deg) scale(0.9)`, opacity: 0.9 },
      ],
      { duration: ms * rand(0.6, 1), delay: rand(0, ms * 0.35), easing: "ease-in", fill: "both" },
    );
  }
}

function rainbow(parent: HTMLElement, ms: number) {
  const band = document.createElement("div");
  band.style.cssText =
    "position:absolute;left:0;top:25%;width:140%;height:34%;will-change:transform,opacity;opacity:0;" +
    "background:linear-gradient(180deg,#f87171 0 14%,#fb923c 14% 28%,#facc15 28% 42%,#4ade80 42% 57%,#38bdf8 57% 71%,#818cf8 71% 85%,#c084fc 85% 100%);" +
    "mix-blend-mode:normal;border-radius:999px";
  parent.appendChild(band);
  band.animate(
    [
      { transform: "translateX(-100%) skewX(-12deg)", opacity: 0 },
      { opacity: 0.55, offset: 0.25 },
      { opacity: 0.55, offset: 0.7 },
      { transform: "translateX(60%) skewX(-12deg)", opacity: 0 },
    ],
    { duration: ms, easing: "ease-in-out", fill: "forwards" },
  );
}

function unicorns(parent: HTMLElement, count: number, ms: number) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (let i = 0; i < count; i++) {
    const p = particle(parent, "🦄", null, rand(34, 58));
    const y = rand(h * 0.15, h * 0.8);
    const bob = rand(16, 34);
    p.animate(
      [
        { transform: `translate(-80px,${y}px) scaleX(-1)`, opacity: 1 },
        { transform: `translate(${w * 0.25}px,${y - bob}px) scaleX(-1)`, offset: 0.25 },
        { transform: `translate(${w * 0.5}px,${y}px) scaleX(-1)`, offset: 0.5 },
        { transform: `translate(${w * 0.75}px,${y - bob}px) scaleX(-1)`, offset: 0.75 },
        { transform: `translate(${w + 80}px,${y}px) scaleX(-1)`, opacity: 1 },
      ],
      { duration: ms * rand(0.75, 1), delay: i * rand(120, 240), easing: "linear", fill: "both" },
    );
  }
}

function toast(text: string, ms: number) {
  const el = layer(ms);
  const t = document.createElement("div");
  t.setAttribute("role", "status");
  t.textContent = text;
  t.style.cssText =
    "position:absolute;left:50%;bottom:calc(88px + env(safe-area-inset-bottom));transform:translateX(-50%);" +
    "padding:10px 18px;border-radius:999px;background:var(--surface,#fff);color:var(--foreground,#16181d);" +
    "box-shadow:0 8px 24px -6px rgba(0,0,0,.25);font-weight:600;font-size:15px;white-space:nowrap";
  el.appendChild(t);
  t.animate([{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], {
    duration: ms,
    fill: "forwards",
  });
}

// Fire one celebration. `big` = the whole I dag list is done.
export function celebrate(origin?: Origin, big = false): void {
  if (typeof window === "undefined") return;
  try {
    if (big) playTaDa();
    else playChime();
    if (reducedMotion()) {
      toast(big ? "Alt er gjort! 🌈" : "✓ Bra jobba!", 1800);
      return;
    }
    const o = origin ?? originOf(null);
    if (big) {
      const ms = 2800;
      const el = layer(ms + 600);
      rainbow(el, ms);
      unicorns(el, 5, ms);
      burst(el, o, [], 30, 2000, false);
      burst(el, { x: window.innerWidth / 2, y: window.innerHeight * 0.6 }, ["🌈", "⭐", "🎉", "💖"], 20, 2200, true);
      toast("Alt er gjort! 🦄🌈", ms);
      return;
    }
    const effect = pickDifferent(EFFECTS, lastEffect);
    lastEffect = effect;
    const ms = 1900;
    const el = layer(ms + 400);
    switch (effect) {
      case "confetti":
        burst(el, o, [], MAX_PARTICLES, ms, false);
        break;
      case "glitter":
        glitter(el, 40, ms);
        break;
      case "rainbow":
        rainbow(el, ms);
        burst(el, o, ["✨", "⭐"], 12, ms, false);
        break;
      case "unicorns":
        unicorns(el, 3, ms);
        break;
      case "fountain":
        burst(el, o, ["🌈", "⭐", "🎉", "💖"], 28, ms, true);
        break;
    }
  } catch {
    /* effects are decoration; never break a Gjort */
  }
}

export { primeAudio };

// Applies a random theme to <html> for this visit, shows greeting + phrase and
// the sound toggle. Picked in useEffect so SSR/hydration markup is static.
export function FunHeader() {
  const [theme, setTheme] = useState<FunTheme | null>(null);
  const [phrase, setPhrase] = useState("");
  const [sound, setSound] = useState(true);

  useEffect(() => {
    const th = pick(THEMES);
    setTheme(th);
    setPhrase(pick(PHRASES));
    setSound(soundOn());
    const root = document.documentElement;
    const vars: Record<string, string> = {
      "--accent": th.accent,
      "--accent-hover": th.hover,
      "--accent-soft": th.soft,
      "--fun-bg": th.bg,
    };
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    return () => {
      for (const k of Object.keys(vars)) root.style.removeProperty(k);
    };
  }, []);

  return (
    <>
      {/* soft gradient behind the header; fixed so it causes no layout shift */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: "0 0 auto 0",
          height: "13rem",
          background: "var(--fun-bg, none)",
          opacity: 0.55,
          pointerEvents: "none",
          zIndex: -1,
        }}
      />
      <div className="flex min-h-5 items-center justify-between gap-2 text-sm">
        <p className="min-w-0 truncate font-medium text-muted">
          {theme ? `Dagens tema: ${theme.name} ${theme.emoji} · ${phrase}` : ""}
        </p>
        <button
          type="button"
          className="shrink-0 rounded-full px-2 text-base"
          aria-label={sound ? "Slå av lyd" : "Slå på lyd"}
          aria-pressed={sound}
          onClick={() => {
            const next = !sound;
            setSound(next);
            setSoundOn(next);
            if (next) {
              primeAudio();
              playChime();
            }
          }}
        >
          {sound ? "🔊" : "🔇"}
        </button>
      </div>
    </>
  );
}
