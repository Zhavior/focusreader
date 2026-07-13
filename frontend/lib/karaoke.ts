/**
 * Read-along ("karaoke") word timing.
 *
 * v1 uses proportional alignment: each word is assigned a slice of the
 * audio's total duration weighted by its character length (+1 for the pause a
 * word boundary implies). For continuous TTS speech this tracks well; it
 * drifts slightly around long silences and checkpoint announcements.
 *
 * The token shape is deliberately provider-agnostic: when ElevenLabs
 * word-level timestamps are added later, they replace `startFrac`/`endFrac`
 * with measured values and every consumer keeps working unchanged.
 */

export interface WordToken {
  /** The word as it should be rendered (original punctuation preserved). */
  word: string;
  /** Start of this word as a fraction [0, 1) of total audio duration. */
  startFrac: number;
  /** End of this word as a fraction (0, 1] of total audio duration. */
  endFrac: number;
  /** True if the source had a paragraph break before this word. */
  paragraphStart: boolean;
}

export function buildWordTimings(text: string): WordToken[] {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const raw: { word: string; weight: number; paragraphStart: boolean }[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    words.forEach((word, i) => {
      raw.push({ word, weight: word.length + 1, paragraphStart: i === 0 });
    });
  }

  const totalWeight = raw.reduce((sum, t) => sum + t.weight, 0);
  if (totalWeight === 0) return [];

  const tokens: WordToken[] = [];
  let cumulative = 0;
  for (const t of raw) {
    const startFrac = cumulative / totalWeight;
    cumulative += t.weight;
    tokens.push({
      word: t.word,
      startFrac,
      endFrac: cumulative / totalWeight,
      paragraphStart: t.paragraphStart,
    });
  }
  return tokens;
}

/**
 * Index of the word active at `frac` (fraction of playback elapsed).
 * Binary search — called every animation frame, so O(log n) matters for
 * 30k-word documents.
 */
export function wordIndexAt(tokens: WordToken[], frac: number): number {
  if (tokens.length === 0) return -1;
  if (frac <= 0) return 0;
  if (frac >= 1) return tokens.length - 1;

  let lo = 0;
  let hi = tokens.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (tokens[mid].endFrac <= frac) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
