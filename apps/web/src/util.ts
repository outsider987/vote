// Pure helpers: no DOM, so the model can be unit-tested under Node.

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const fmt = (n: number) => Math.round(n).toLocaleString("zh-TW");

export function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type Rng = ReturnType<typeof mulberry32>;

/** Smallest 1-2-5 step ≥ x (at least 1). */
export function niceUnit(x: number) {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(1, x))));
  for (const m of [1, 2, 5, 10]) if (m * p >= x) return m * p;
  return 10 * p;
}

// CEC writes some registered name glyphs as @HEX@ (a CJK compatibility ideograph code point).
// NFC maps it to the standard character so every font can render it.
export const decodeName = (name: string) =>
  name.replace(/@([0-9A-Fa-f]+)@/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)).normalize("NFC"));

/** Candidate indices by votes, highest first; ties keep ballot order. */
export const rankOrder = (votes: readonly number[]) => votes.map((_, j) => j).sort((x, y) => votes[y] - votes[x]);
