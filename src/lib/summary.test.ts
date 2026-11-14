import { describe, expect, it } from 'vitest';
import { friendBalances, overall, pairBalance, scopeTransfers } from './summary';
import type { AppData, Expense, Group } from './types';

const g: Group = { id: 'g1', name: 'Trip', type: 'trip', currency: 'INR', memberIds: ['me', 'r', 'p', 's'], simplify: true, createdAt: 0 };
const mk = (payer: string, owed: Record<string, number>, over: Partial<Expense> = {}): Expense => {
  const amount = Object.values(owed).reduce((a, b) => a + b, 0);
  return {
    id: Math.random().toString(), groupId: 'g1', kind: 'expense', description: 'x', amount, currency: 'INR', date: '2026-01-01', category: 'general',
    payers: [{ personId: payer, amount }], owed: Object.entries(owed).map(([personId, a]) => ({ personId, amount: a })), splitType: 'exact', createdAt: 0, updatedAt: 0, ...over,
  };
};
const data = (simplify: boolean, expenses: Expense[]): Pick<AppData, 'groups' | 'expenses'> => ({ groups: [{ ...g, simplify }], expenses });

// dinner: me paid 3000 split 4; cab: r paid 1000 (10/40/30/20); hotel: p paid 5000 (1000/1000/2000/1000)
const exps = [
  mk('me', { me: 750, r: 750, p: 750, s: 750 }),
  mk('r', { me: 100, r: 400, p: 300, s: 200 }),
  mk('p', { me: 1000, r: 1000, p: 2000, s: 1000 }),
];

describe('friend balances follow the group simplify setting', () => {
  it('simplified: group and person screens agree', () => {
    const d = data(true, exps);
    const t = scopeTransfers(d, 'g1');
    expect(pairBalance(t, 'me', 'r')).toBe(1150);
    const fb = friendBalances(d, 'me');
    expect(fb.get('r')?.get('INR')).toBe(1150);
    expect(fb.get('p')).toBeUndefined();
    expect(overall(d, 'me')).toEqual([{ currency: 'INR', owed: 1150, owe: 0 }]);
  });
  it('not simplified: pairwise debts', () => {
    const fb = friendBalances(data(false, exps), 'me');
    expect(fb.get('r')?.get('INR')).toBe(650);
    expect(fb.get('s')?.get('INR')).toBe(750);
    expect(fb.get('p')?.get('INR')).toBe(-250);
  });
  it('non-group expenses are separate and per currency', () => {
    const ng = mk('me', { me: 500, r: 500 }, { groupId: null });
    const fb = friendBalances({ groups: [], expenses: [ng] }, 'me');
    expect(fb.get('r')?.get('INR')).toBe(500);
  });
});
