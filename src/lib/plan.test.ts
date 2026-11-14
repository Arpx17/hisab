import { describe, expect, it } from 'vitest';
import { minTransfers, netBalances, settlementPlan } from './balances';
import type { Expense } from './types';

let t = 0;
const exp = (payers: Record<string, number>, owed: Record<string, number>): Expense => ({
  id: String(++t), groupId: 'g', kind: 'expense', description: 'x', currency: 'INR', date: '2026-11-14', category: 'general',
  amount: Object.values(payers).reduce((a, b) => a + b, 0),
  payers: Object.entries(payers).map(([personId, amount]) => ({ personId, amount })),
  owed: Object.entries(owed).map(([personId, amount]) => ({ personId, amount })),
  splitType: 'shares', createdAt: t, updatedAt: t,
});
const pay = (from: string, to: string, amount: number): Expense => ({
  ...exp({ [from]: amount }, { [to]: amount }), kind: 'payment',
});
const check = (plan: { from: string; to: string; amount: number }[], expenses: Expense[]) => {
  const net = netBalances(expenses);
  const got = new Map<string, number>();
  for (const x of plan) {
    got.set(x.to, (got.get(x.to) ?? 0) + x.amount);
    got.set(x.from, (got.get(x.from) ?? 0) - x.amount);
  }
  for (const [k, v] of net) expect(got.get(k) ?? 0).toBe(v);
  for (const [k, v] of got) expect(net.get(k) ?? 0).toBe(v);
};

// the Vizag trip from the screenshots (rupees)
const vizag = [
  exp({ di: 500, ratan: 671 }, { di: 154, ratan: 160, arpan: 159, atanu: 177, soumik: 175, tarun: 188, boudi: 158 }),
  exp({ tarun: 440 }, { di: 80, ratan: 60, arpan: 60, atanu: 60, soumik: 60, tarun: 60, boudi: 60 }),
];

describe('minTransfers', () => {
  it('beats greedy when balances cancel in sub-groups', () => {
    const net = new Map([['a', -4], ['b', -3], ['c', -3], ['x', 6], ['y', 4]]);
    const plan = minTransfers(net);
    expect(plan).toHaveLength(3);
  });
  it('vizag needs 6 payments and they settle everyone', () => {
    const plan = settlementPlan(vizag);
    expect(plan).toHaveLength(6);
    check(plan, vizag);
  });
});

describe('stable plan', () => {
  it('paying a suggested amount leaves the rest of the plan unchanged', () => {
    const before = settlementPlan(vizag);
    let all = [...vizag];
    for (const step of before) {
      const prev = settlementPlan(all);
      all = [...all, pay(step.from, step.to, step.amount)];
      const after = settlementPlan(all);
      const key = (x: { from: string; to: string; amount: number }) => `${x.from}>${x.to}:${x.amount}`;
      expect(after.map(key).sort()).toEqual(prev.filter((x) => key(x) !== key(step)).map(key).sort());
      check(after, all);
    }
    expect(settlementPlan(all)).toEqual([]);
  });
  it('partial payment only reduces that line', () => {
    const plan = settlementPlan([...vizag, pay(before0().from, before0().to, 100)]);
    const b = settlementPlan(vizag);
    expect(plan.find((x) => x.from === b[0].from && x.to === b[0].to)?.amount).toBe(b[0].amount - 100);
    expect(plan).toHaveLength(6);
  });
  it('off-plan payment still settles correctly', () => {
    const all = [...vizag, pay('arpan', 'tarun', 50)];
    check(settlementPlan(all), all);
  });
});
function before0() {
  return settlementPlan(vizag)[0];
}
