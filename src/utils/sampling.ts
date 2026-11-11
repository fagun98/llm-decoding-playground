/**
 * LLM sampling utilities: temperature scaling, top-k, top-p (nucleus), and seeded random sampling
 */

export interface TokenProbability {
  token: string;
  tokenId: number;
  probability: number;
  logit: number;
  filtered: boolean;
}

/**
 * Seeded pseudo-random number generator using mulberry32
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

/**
 * Apply temperature scaling to logits
 */
export function applyTemperature(logits: number[], temperature: number): number[] {
  if (temperature === 1.0) return logits;
  return logits.map((logit) => logit / temperature);
}

/**
 * Apply softmax to convert logits to probabilities
 */
export function softmax(logits: number[]): number[] {
  const maxLogit = Math.max(...logits);
  const exps = logits.map((logit) => Math.exp(logit - maxLogit));
  const sumExps = exps.reduce((a, b) => a + b, 0);
  return exps.map((exp) => exp / sumExps);
}

/**
 * Apply top-k filtering: keep only the k tokens with highest probabilities
 */
export function applyTopK(
  probabilities: number[],
  k: number
): { probabilities: number[]; mask: boolean[] } {
  if (k <= 0 || k >= probabilities.length) {
    return {
      probabilities,
      mask: new Array(probabilities.length).fill(false)
    };
  }

  const indexed = probabilities.map((p, i) => ({ p, i }));
  indexed.sort((a, b) => b.p - a.p);

  const mask = new Array(probabilities.length).fill(true);
  const filtered = new Array(probabilities.length).fill(0);

  for (let i = 0; i < k; i++) {
    const idx = indexed[i].i;
    mask[idx] = false;
    filtered[idx] = probabilities[idx];
  }

  const sum = filtered.reduce((a, b) => a + b, 0);
  const renormalized = filtered.map((p) => (sum > 0 ? p / sum : 0));

  return { probabilities: renormalized, mask };
}

/**
 * Apply top-p (nucleus) filtering: keep tokens with cumulative probability >= p
 */
export function applyTopP(
  probabilities: number[],
  p: number
): { probabilities: number[]; mask: boolean[] } {
  if (p >= 1.0) {
    return {
      probabilities,
      mask: new Array(probabilities.length).fill(false)
    };
  }

  const indexed = probabilities.map((prob, i) => ({ prob, i }));
  indexed.sort((a, b) => b.prob - a.prob);

  let cumSum = 0;
  const mask = new Array(probabilities.length).fill(true);
  const filtered = new Array(probabilities.length).fill(0);

  for (const { prob, i } of indexed) {
    cumSum += prob;
    mask[i] = false;
    filtered[i] = probabilities[i];
    if (cumSum >= p) break;
  }

  const sum = filtered.reduce((a, b) => a + b, 0);
  const renormalized = filtered.map((p) => (sum > 0 ? p / sum : 0));

  return { probabilities: renormalized, mask };
}

/**
 * Sample a token index from a probability distribution
 */
export function sampleToken(
  probabilities: number[],
  random: SeededRandom | null = null
): number {
  const r = random ? random.next() : Math.random();
  let cumSum = 0;

  for (let i = 0; i < probabilities.length; i++) {
    cumSum += probabilities[i];
    if (r < cumSum) return i;
  }

  return probabilities.length - 1;
}

/**
 * Get the token with the highest probability (greedy decoding)
 */
export function greedyToken(probabilities: number[]): number {
  let maxIdx = 0;
  let maxProb = probabilities[0];

  for (let i = 1; i < probabilities.length; i++) {
    if (probabilities[i] > maxProb) {
      maxProb = probabilities[i];
      maxIdx = i;
    }
  }

  return maxIdx;
}

/**
 * Full decoding pipeline: temperature -> softmax -> top-k -> top-p -> sample
 */
export function decodeNextToken(
  logits: number[],
  tokenIds: number[],
  tokens: string[],
  temperature: number,
  topK: number,
  topP: number,
  random: SeededRandom | null = null
): { selectedToken: string; selectedTokenId: number; probabilities: TokenProbability[] } {
  const scaledLogits = applyTemperature(logits, temperature);
  let probabilities = softmax(scaledLogits);

  let topKMask = new Array(probabilities.length).fill(false);
  if (topK > 0 && topK < probabilities.length) {
    const topKResult = applyTopK(probabilities, topK);
    probabilities = topKResult.probabilities;
    topKMask = topKResult.mask;
  }

  let topPMask = new Array(probabilities.length).fill(false);
  if (topP < 1.0) {
    const topPResult = applyTopP(probabilities, topP);
    probabilities = topPResult.probabilities;
    topPMask = topPResult.mask;
  }

  const combinedMask = topKMask.map((k, i) => k || topPMask[i]);

  let selectedIdx: number;
  if (temperature === 0) {
    selectedIdx = logits.indexOf(Math.max(...logits));
  } else {
    selectedIdx = sampleToken(probabilities, random);
  }

  const tokenProbabilities: TokenProbability[] = logits.map((logit, i) => ({
    token: tokens[i],
    tokenId: tokenIds[i],
    probability: probabilities[i],
    logit,
    filtered: combinedMask[i]
  }));

  tokenProbabilities.sort((a, b) => b.probability - a.probability);

  return {
    selectedToken: tokens[selectedIdx],
    selectedTokenId: tokenIds[selectedIdx],
    probabilities: tokenProbabilities
  };
}
