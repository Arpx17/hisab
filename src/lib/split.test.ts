import { describe, expect, it } from 'vitest';
import { computeSplit, distribute } from './split';
import { balancesWithMe, groupTransfers, netBalances, pairwiseTransfers, settleNets } from './balances';
import { parseMoney, formatMoney, toInput } from './money';
import type { Expense } from './types';

const ex = (over: Partial<Expense>): Expense => ({
  id: Math.random().toString(),
  groupId: 'g',
  kind: 'expense',
  description: 'x',
  amount: 0,
  currency: 'INR',
  date: '2026-01-01',
  category: 'general',
  payers: [],
  owed: [],
  splitType: 'equal',
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

describe('distribute', () => {
  it('always sums to total', () => {
    for (const total of [1, 99, 100, 1001, 33333]) {
      for (let n = 1; n <= 7; n++) {
        const parts = distribute(total, Array(n).fill(1));
        expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
        expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
      }
    }
  });
  it('handles weights', () => {
    expect(distribute(1000, [1, 2, 2])).toEqual([200, 400, 400]);
    expect(distribute(100, [1, 1, 1])).toEqual([34, 33, 33]);
  });
});

describe('computeSplit', () => {
  const p = ['a', 'b', 'c'];
  it('equal', () => {
    const r = computeSplit({ type: 'equal', total: 1000, participants: p });
    expect(r.ok).toBe(true);
    expect(r.owed.map((o) => o.amount)).toEqual([334, 333, 333]);
  });
  it('exact validates sum', () => {
    expect(computeSplit({ type: 'exact', total: 1000, participants: p, values: { a: 500, b: 300, c: 200 } }).ok).toBe(true);
    const bad = computeSplit({ type: 'exact', total: 1000, participants: p, values: { a: 500, b: 300 } });
    expect(bad.ok).toBe(false);
    expect(bad.remaining).toBe(200);
  });
  it('percent validates 100', () => {
    const r = computeSplit({ type: 'percent', total: 1000, participants: p, values: { a: 50, b: 30, c: 20 } });
    expect(r.owed.map((o) => o.amount)).toEqual([500, 300, 200]);
    expect(computeSplit({ type: 'percent', total: 1000, participants: p, values: { a: 50, b: 30 } }).ok).toBe(false);
  });
  it('shares', () => {
    const r = computeSplit({ type: 'shares', total: 1000, participants: p, values: { a: 1, b: 2, c: 2 } });
    expect(r.owed.map((o) => o.amount)).toEqual([200, 400, 400]);
  });
  it('adjustment', () => {
    // total 1000, a pays extra 100 => base 900 split 3 = 300 each, a=400
    const r = computeSplit({ type: 'adjust', total: 1000, participants: p, values: { a: 100 } });
    expect(r.owed.map((o) => o.amount)).toEqual([400, 300, 300]);
    expect(r.owed.reduce((s, o) => s + o.amount, 0)).toBe(1000);
  });
});

describe('balances', () => {
  const dinner = ex({
    amount: 3000,
    payers: [{ personId: 'a', amount: 3000 }],
    owed: [
      { personId: 'a', amount: 1000 },
      { personId: 'b', amount: 1000 },
      { personId: 'c', amount: 1000 },
    ],
  });
  it('net balances', () => {
    const n = netBalances([dinner]);
    expect(n.get('a')).toBe(2000);
    expect(n.get('b')).toBe(-1000);
    expect(n.get('c')).toBe(-1000);
  });
  it('payment settles debt', () => {
    const pay = ex({
      kind: 'payment',
      amount: 1000,
      payers: [{ personId: 'b', amount: 1000 }],
      owed: [{ personId: 'a', amount: 1000 }],
    });
    const t = pairwiseTransfers([dinner, pay]);
    expect(t).toEqual([{ from: 'c', to: 'a', amount: 1000 }]);
  });
  it('simplify reduces transfers', () => {
    // a owes b 10, b owes c 10  => a owes c 10 when simplified
    const e1 = ex({ amount: 1000, payers: [{ personId: 'b', amount: 1000 }], owed: [{ personId: 'a', amount: 1000 }] });
    const e2 = ex({ amount: 1000, payers: [{ personId: 'c', amount: 1000 }], owed: [{ personId: 'b', amount: 1000 }] });
    expect(groupTransfers([e1, e2], false)).toHaveLength(2);
    expect(groupTransfers([e1, e2], true)).toEqual([{ from: 'a', to: 'c', amount: 1000 }]);
  });
  it('multiple payers', () => {
    const e = ex({
      amount: 3000,
      payers: [
        { personId: 'a', amount: 2000 },
        { personId: 'b', amount: 1000 },
      ],
      owed: [
        { personId: 'a', amount: 1000 },
        { personId: 'b', amount: 1000 },
        { personId: 'c', amount: 1000 },
      ],
    });
    const n = settleNets(new Map([['a', 1000], ['b', 0], ['c', -1000]]));
    expect(n).toEqual([{ from: 'c', to: 'a', amount: 1000 }]);
    expect(pairwiseTransfers([e])).toEqual([{ from: 'c', to: 'a', amount: 1000 }]);
  });
  it('balances with me', () => {
    const m = balancesWithMe([dinner], 'b');
    expect(m.get('a')).toBe(-1000);
    expect(balancesWithMe([dinner], 'a').get('b')).toBe(1000);
  });
});

describe('money', () => {
  it('parses and formats', () => {
    expect(parseMoney('1,250.55', 'INR')).toBe(125055);
    expect(parseMoney('₹ 99', 'INR')).toBe(9900);
    expect(parseMoney('abc', 'INR')).toBeNaN();
    expect(parseMoney('500', 'JPY')).toBe(500);
    expect(toInput(12050, 'INR')).toBe('120.5');
    expect(formatMoney(125055, 'INR')).toContain('1,250.55');
  });
});
