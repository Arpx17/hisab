import type { ID, Portion, SplitType } from './types';

/**
 * Distribute `total` minor units across weights using the largest remainder
 * method so the parts always add up to exactly `total`.
 */
export function distribute(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0) return [];
  if (sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const floors = raw.map((r) => Math.floor(r));
  let left = total - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0 && k < order.length; k++, left--) floors[order[k].i] += 1;
  return floors;
}

export interface SplitInput {
  type: SplitType;
  total: number; // minor units
  /** people included in the split, in stable order */
  participants: ID[];
  /**
   * exact: amount in minor units
   * percent: percentage (e.g. 33.5)
   * shares: share count (e.g. 2)
   * adjust: +/- amount in minor units
   * equal: ignored
   */
  values?: Record<ID, number>;
}

export interface SplitResult {
  ok: boolean;
  owed: Portion[];
  /** human readable problem, when !ok */
  error?: string;
  /** exact/percent/adjust: how much is left to allocate (minor units or percent) */
  remaining?: number;
}

export function computeSplit(input: SplitInput): SplitResult {
  const { type, total, participants } = input;
  const values = input.values ?? {};
  if (participants.length === 0) return { ok: false, owed: [], error: 'Pick at least one person' };

  const mk = (amounts: number[]): Portion[] => participants.map((personId, i) => ({ personId, amount: amounts[i] }));

  switch (type) {
    case 'equal':
      return { ok: true, owed: mk(distribute(total, participants.map(() => 1))) };

    case 'exact': {
      const amounts = participants.map((p) => Math.round(values[p] ?? 0));
      const used = amounts.reduce((a, b) => a + b, 0);
      const remaining = total - used;
      if (amounts.some((a) => a < 0)) return { ok: false, owed: mk(amounts), error: 'Amounts cannot be negative', remaining };
      return remaining === 0
        ? { ok: true, owed: mk(amounts), remaining }
        : { ok: false, owed: mk(amounts), error: 'Amounts must add up to the total', remaining };
    }

    case 'percent': {
      const pcts = participants.map((p) => values[p] ?? 0);
      const used = pcts.reduce((a, b) => a + b, 0);
      const remaining = Math.round((100 - used) * 100) / 100;
      if (pcts.some((p) => p < 0)) return { ok: false, owed: [], error: 'Percentages cannot be negative', remaining };
      if (Math.abs(remaining) > 0.001) return { ok: false, owed: [], error: 'Percentages must add up to 100%', remaining };
      return { ok: true, owed: mk(distribute(total, pcts)), remaining: 0 };
    }

    case 'shares': {
      const sh = participants.map((p) => values[p] ?? 0);
      if (sh.some((s) => s < 0)) return { ok: false, owed: [], error: 'Shares cannot be negative' };
      if (sh.reduce((a, b) => a + b, 0) <= 0) return { ok: false, owed: [], error: 'Give at least one person a share' };
      return { ok: true, owed: mk(distribute(total, sh)) };
    }

    case 'adjust': {
      const adj = participants.map((p) => Math.round(values[p] ?? 0));
      const base = total - adj.reduce((a, b) => a + b, 0);
      if (base < 0) return { ok: false, owed: [], error: 'Adjustments are larger than the total', remaining: base };
      const equal = distribute(base, participants.map(() => 1));
      const amounts = equal.map((e, i) => e + adj[i]);
      if (amounts.some((a) => a < 0)) return { ok: false, owed: [], error: 'An adjustment makes someone owe less than zero' };
      return { ok: true, owed: mk(amounts), remaining: 0 };
    }
  }
}
