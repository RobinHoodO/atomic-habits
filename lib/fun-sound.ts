// Cheerful Web Audio chimes. Client-only; the AudioContext is created lazily on
// the first tap (iOS needs a user gesture). No audio files.

const KEY = "fun-sound";
let ctx: AudioContext | null = null;

export function soundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* storage blocked: toggle just won't persist */
  }
}

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// Major pentatonic-ish notes (Hz) so anything random still sounds happy.
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98];

function note(c: AudioContext, freq: number, start: number, dur: number, vol: number, type: OscillatorType = "triangle") {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(c.destination);
  o.start(start);
  o.stop(start + dur + 0.05);
}

const rnd = (n: number) => Math.floor(Math.random() * n);

const SOUNDS: Array<(c: AudioContext, t: number) => void> = [
  // rising arpeggio
  (c, t) => {
    const base = rnd(3);
    [0, 2, 4, 5].forEach((s, i) => note(c, SCALE[base + s > 8 ? 8 : base + s], t + i * 0.07, 0.22, 0.15));
  },
  // sparkle: quick random high notes
  (c, t) => {
    for (let i = 0; i < 6; i++) note(c, SCALE[4 + rnd(5)], t + i * 0.05, 0.12, 0.1, "sine");
  },
  // two-note "ding-ding"
  (c, t) => {
    note(c, SCALE[3], t, 0.18, 0.15);
    note(c, SCALE[6], t + 0.12, 0.35, 0.15, "sine");
  },
  // falling twinkle
  (c, t) => {
    [8, 6, 5, 3].forEach((s, i) => note(c, SCALE[s], t + i * 0.06, 0.18, 0.12, "sine"));
  },
];

export function playChime(): void {
  if (!soundOn()) return;
  const c = audio();
  if (!c) return;
  SOUNDS[rnd(SOUNDS.length)](c, c.currentTime + 0.01);
}

// Big "ta-da": a bright major chord with a rising lead-in.
export function playTaDa(): void {
  if (!soundOn()) return;
  const c = audio();
  if (!c) return;
  const t = c.currentTime + 0.01;
  [0, 2, 4].forEach((s, i) => note(c, SCALE[s], t + i * 0.09, 0.15, 0.12));
  [SCALE[2], SCALE[4], SCALE[5], SCALE[7]].forEach((f) => note(c, f, t + 0.32, 0.9, 0.1, "triangle"));
}

// Call from a tap handler to unlock audio on iOS without making noise.
export function primeAudio(): void {
  if (soundOn()) audio();
}
