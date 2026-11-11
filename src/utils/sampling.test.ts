import { describe, it, expect } from 'vitest';
import {
  SeededRandom,
  applyTemperature,
  softmax,
  applyTopK,
  applyTopP,
  sampleToken,
  greedyToken,
  decodeNextToken
} from './sampling';

describe('SeededRandom', () => {
  it('produces deterministic sequences', () => {
    const rng1 = new SeededRandom(42);
    const rng2 = new SeededRandom(42);

    const seq1 = [rng1.next(), rng1.next(), rng1.next()];
    const seq2 = [rng2.next(), rng2.next(), rng2.next()];

    expect(seq1).toEqual(seq2);
  });

  it('produces different sequences with different seeds', () => {
    const rng1 = new SeededRandom(42);
    const rng2 = new SeededRandom(123);

    const val1 = rng1.next();
    const val2 = rng2.next();

    expect(val1).not.toEqual(val2);
  });

  it('produces values in [0, 1) range', () => {
    const rng = new SeededRandom(42);
    for (let i = 0; i < 100; i++) {
      const val = rng.next();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });
});

describe('applyTemperature', () => {
  it('scales logits by temperature', () => {
    const logits = [1, 2, 3];
    const result = applyTemperature(logits, 2.0);
    expect(result).toEqual([0.5, 1.0, 1.5]);
  });

  it('returns original logits when temperature is 1', () => {
    const logits = [1, 2, 3];
    const result = applyTemperature(logits, 1.0);
    expect(result).toEqual(logits);
  });

  it('sharpens distribution with low temperature', () => {
    const logits = [1, 2, 3];
    const result = applyTemperature(logits, 0.5);
    expect(result).toEqual([2, 4, 6]);
  });
});

describe('softmax', () => {
  it('produces probabilities that sum to 1', () => {
    const logits = [1, 2, 3, 4, 5];
    const probs = softmax(logits);
    const sum = probs.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it('produces all positive probabilities', () => {
    const logits = [-10, -5, 0, 5, 10];
    const probs = softmax(logits);
    probs.forEach((p) => {
      expect(p).toBeGreaterThan(0);
    });
  });

  it('assigns highest probability to highest logit', () => {
    const logits = [1, 5, 2, 3];
    const probs = softmax(logits);
    const maxIdx = probs.indexOf(Math.max(...probs));
    expect(maxIdx).toBe(1);
  });

  it('handles uniform logits', () => {
    const logits = [2, 2, 2, 2];
    const probs = softmax(logits);
    probs.forEach((p) => {
      expect(p).toBeCloseTo(0.25, 10);
    });
  });
});

describe('applyTopK', () => {
  it('keeps only top k probabilities', () => {
    const probs = [0.1, 0.3, 0.05, 0.25, 0.3];
    const { probabilities } = applyTopK(probs, 2);

    const nonZero = probabilities.filter((p) => p > 0);
    expect(nonZero.length).toBe(2);
  });

  it('renormalizes to sum to 1', () => {
    const probs = [0.1, 0.3, 0.05, 0.25, 0.3];
    const { probabilities } = applyTopK(probs, 3);
    const sum = probabilities.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it('returns original probabilities when k is too large', () => {
    const probs = [0.2, 0.3, 0.5];
    const { probabilities, mask } = applyTopK(probs, 10);
    expect(probabilities).toEqual(probs);
    expect(mask.every((m) => !m)).toBe(true);
  });

  it('returns original probabilities when k is 0', () => {
    const probs = [0.2, 0.3, 0.5];
    const { probabilities, mask } = applyTopK(probs, 0);
    expect(probabilities).toEqual(probs);
    expect(mask.every((m) => !m)).toBe(true);
  });
});

describe('applyTopP', () => {
  it('keeps tokens until cumulative probability >= p', () => {
    const probs = [0.5, 0.3, 0.1, 0.05, 0.05];
    const { probabilities } = applyTopP(probs, 0.8);

    const nonZero = probabilities.filter((p) => p > 1e-10);
    expect(nonZero.length).toBeGreaterThanOrEqual(2);
    expect(nonZero.length).toBeLessThanOrEqual(3);
  });

  it('renormalizes to sum to 1', () => {
    const probs = [0.5, 0.3, 0.1, 0.05, 0.05];
    const { probabilities } = applyTopP(probs, 0.9);
    const sum = probabilities.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it('returns original probabilities when p is 1', () => {
    const probs = [0.2, 0.3, 0.5];
    const { probabilities, mask } = applyTopP(probs, 1.0);
    expect(probabilities).toEqual(probs);
    expect(mask.every((m) => !m)).toBe(true);
  });

  it('keeps at least the most probable token', () => {
    const probs = [0.9, 0.05, 0.03, 0.02];
    const { probabilities } = applyTopP(probs, 0.5);
    expect(probabilities[0]).toBeGreaterThan(0);
  });
});

describe('sampleToken', () => {
  it('samples deterministically with seeded random', () => {
    const probs = [0.2, 0.3, 0.5];
    const rng1 = new SeededRandom(42);
    const rng2 = new SeededRandom(42);

    const idx1 = sampleToken(probs, rng1);
    const idx2 = sampleToken(probs, rng2);

    expect(idx1).toBe(idx2);
  });

  it('samples valid indices', () => {
    const probs = [0.2, 0.3, 0.5];
    const rng = new SeededRandom(42);

    for (let i = 0; i < 100; i++) {
      const idx = sampleToken(probs, rng);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(probs.length);
    }
  });

  it('never samples zero-probability tokens', () => {
    const probs = [0.5, 0, 0.5, 0];
    const rng = new SeededRandom(42);

    for (let i = 0; i < 100; i++) {
      const idx = sampleToken(probs, rng);
      expect(probs[idx]).toBeGreaterThan(0);
    }
  });
});

describe('greedyToken', () => {
  it('returns index of highest probability', () => {
    const probs = [0.1, 0.5, 0.2, 0.2];
    expect(greedyToken(probs)).toBe(1);
  });

  it('returns first index on tie', () => {
    const probs = [0.5, 0.5, 0.0];
    expect(greedyToken(probs)).toBe(0);
  });

  it('handles single element', () => {
    const probs = [1.0];
    expect(greedyToken(probs)).toBe(0);
  });
});

describe('decodeNextToken', () => {
  const logits = [1.0, 2.0, 3.0, 0.5, 1.5];
  const tokenIds = [0, 1, 2, 3, 4];
  const tokens = ['the', 'a', 'is', 'of', 'to'];

  it('applies temperature correctly', () => {
    const highTemp = decodeNextToken(logits, tokenIds, tokens, 2.0, 0, 1.0);
    const lowTemp = decodeNextToken(logits, tokenIds, tokens, 0.5, 0, 1.0);

    const highTempMax = Math.max(...highTemp.probabilities.map((p) => p.probability));
    const lowTempMax = Math.max(...lowTemp.probabilities.map((p) => p.probability));

    expect(lowTempMax).toBeGreaterThan(highTempMax);
  });

  it('respects temperature=0 as greedy', () => {
    const result = decodeNextToken(logits, tokenIds, tokens, 0, 0, 1.0);
    const maxLogitIdx = logits.indexOf(Math.max(...logits));
    expect(result.selectedToken).toBe(tokens[maxLogitIdx]);
  });

  it('filters with top-k', () => {
    const result = decodeNextToken(logits, tokenIds, tokens, 1.0, 2, 1.0);
    const filtered = result.probabilities.filter((p) => p.filtered);
    expect(filtered.length).toBe(3);
  });

  it('filters with top-p', () => {
    const result = decodeNextToken(logits, tokenIds, tokens, 1.0, 0, 0.5);
    const filtered = result.probabilities.filter((p) => p.filtered);
    expect(filtered.length).toBeGreaterThan(0);
  });

  it('produces deterministic results with seed', () => {
    const rng1 = new SeededRandom(42);
    const rng2 = new SeededRandom(42);

    const result1 = decodeNextToken(logits, tokenIds, tokens, 1.0, 0, 1.0, rng1);
    const result2 = decodeNextToken(logits, tokenIds, tokens, 1.0, 0, 1.0, rng2);

    expect(result1.selectedToken).toBe(result2.selectedToken);
  });

  it('sorts probabilities in descending order', () => {
    const result = decodeNextToken(logits, tokenIds, tokens, 1.0, 0, 1.0);
    for (let i = 1; i < result.probabilities.length; i++) {
      expect(result.probabilities[i - 1].probability).toBeGreaterThanOrEqual(
        result.probabilities[i].probability
      );
    }
  });
});
