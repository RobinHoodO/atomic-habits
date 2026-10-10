// Fun mode: pure data + picking logic (no DOM), so it can be tested.

export type FunTheme = {
  id: string;
  name: string;
  emoji: string;
  accent: string; // white text must stay readable on this (>= 4.5:1)
  hover: string;
  soft: string;
  bg: string; // soft gradient behind the I dag header
};

export const THEMES: FunTheme[] = [
  { id: "enhjorning", name: "Enhjørningsdag", emoji: "🦄", accent: "#c026d3", hover: "#a21caf", soft: "#fae8ff", bg: "linear-gradient(180deg,#fbcfe8 0%,#e9d5ff 55%,transparent 100%)" },
  { id: "regnbue", name: "Regnbuedag", emoji: "🌈", accent: "#7c3aed", hover: "#6d28d9", soft: "#ede9fe", bg: "linear-gradient(90deg,#fecaca,#fde68a,#bbf7d0,#bae6fd,#ddd6fe)" },
  { id: "diamant", name: "Diamantdag", emoji: "💎", accent: "#0e7490", hover: "#155e75", soft: "#cffafe", bg: "linear-gradient(180deg,#a5f3fc 0%,#e0f2fe 60%,transparent 100%)" },
  { id: "solnedgang", name: "Solnedgangsdag", emoji: "🌅", accent: "#c2410c", hover: "#9a3412", soft: "#ffedd5", bg: "linear-gradient(180deg,#fed7aa 0%,#fecdd3 60%,transparent 100%)" },
  { id: "hav", name: "Havdag", emoji: "🌊", accent: "#1d4ed8", hover: "#1e40af", soft: "#dbeafe", bg: "linear-gradient(180deg,#bfdbfe 0%,#a5f3fc 60%,transparent 100%)" },
  { id: "skog", name: "Skogsdag", emoji: "🌲", accent: "#15803d", hover: "#166534", soft: "#dcfce7", bg: "linear-gradient(180deg,#bbf7d0 0%,#d9f99d 60%,transparent 100%)" },
  { id: "disco", name: "Discodag", emoji: "🪩", accent: "#be185d", hover: "#9d174d", soft: "#fce7f3", bg: "linear-gradient(90deg,#fbcfe8,#c7d2fe,#a5f3fc,#fde68a)" },
  { id: "godteri", name: "Godteridag", emoji: "🍭", accent: "#db2777", hover: "#be185d", soft: "#fce7f3", bg: "linear-gradient(180deg,#fecdd3 0%,#fef9c3 60%,transparent 100%)" },
];

export const PHRASES: string[] = [
  "Du er en stjerne ⭐",
  "Små steg, store ting 💎",
  "I dag skjer det magi ✨",
  "Én ting om gangen 🌈",
  "Nå går det unna! 🚀",
  "Du fikser dette 💪",
  "Glitter på alt du gjør ✨",
  "Fremdrift er fest 🎉",
  "Hver hake er en liten seier 🏆",
  "Dagens helt er deg 🦸",
  "Bare bli med, det blir gøy 🎈",
  "Smil, du er i gang 😄",
  "Rolig tempo, stor effekt 🐢",
  "Hurra for deg! 🥳",
  "Du lyser opp dagen 🌟",
  "Enhjørninger tror på deg 🦄",
  "Dette blir en fin dag 🌞",
  "Rutiner er superkrefter 🦾",
  "Heia, heia, heia! 📣",
  "Konfetti venter på deg 🎊",
];

export const EFFECTS = ["confetti", "glitter", "rainbow", "unicorns", "fountain"] as const;
export type Effect = (typeof EFFECTS)[number];

export type Rng = () => number;

export function pick<T>(items: readonly T[], rng: Rng = Math.random): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

// Never the same twice in a row when there is a choice.
export function pickDifferent<T>(items: readonly T[], last: T | null, rng: Rng = Math.random): T {
  if (items.length < 2) return items[0];
  const rest = items.filter((x) => x !== last);
  return pick(rest, rng);
}

// Sum of all items still on the I dag list is zero after this tap.
export function listCleared(todayKeys: readonly string[], hidden: ReadonlySet<string>, justDone: string): boolean {
  if (todayKeys.length === 0 || !todayKeys.includes(justDone)) return false;
  return todayKeys.every((k) => k === justDone || hidden.has(k));
}
