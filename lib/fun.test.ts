// Run with: npx tsx lib/fun.test.ts
import assert from "node:assert";
import { THEMES, PHRASES, EFFECTS, pick, pickDifferent, listCleared } from "./fun";

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

assert.ok(THEMES.length >= 8);
assert.ok(PHRASES.length >= 20);
assert.ok(EFFECTS.length >= 5);
for (const t of THEMES) {
  assert.ok(1.05 / (lum(t.accent) + 0.05) >= 4.5, `white on ${t.id} accent needs 4.5:1`);
  assert.ok(1.05 / (lum(t.hover) + 0.05) >= 4.5, `white on ${t.id} hover needs 4.5:1`);
}
assert.strictEqual(pick(["a", "b", "c"], () => 0), "a");
assert.strictEqual(pick(["a", "b", "c"], () => 0.9999), "c");
for (let i = 0; i < 50; i++) assert.notStrictEqual(pickDifferent(EFFECTS, "confetti"), "confetti");
assert.ok(listCleared(["a", "b"], new Set(["a"]), "b"));
assert.ok(!listCleared(["a", "b"], new Set(), "b"));
assert.ok(!listCleared([], new Set(), "b"));
console.log("fun.test ok");
