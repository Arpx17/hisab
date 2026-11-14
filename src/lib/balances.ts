import type { Expense, ID } from './types';

export interface Transfer {
  from: ID; // owes
  to: ID; // is owed
  amount: number;
}

/** net[p] = paid - owed for a single expense. >0 means p is owed money. */
export function expenseNet(e: Pick<Expense, 'payers' | 'owed'>): Map<ID, number> {
  const net = new Map<ID, number>();
  for (const p of e.payers) net.set(p.personId, (net.get(p.personId) ?? 0) + p.amount);
  for (const o of e.owed) net.set(o.personId, (net.get(o.personId) ?? 0) - o.amount);
  return net;
}

/** Match debtors with creditors, largest first. Exact, at most n-1 transfers. */
export function settleNets(net: Map<ID, number>): Transfer[] {
  const debtors = [...net.entries()].filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const creditors = [...net.entries()].filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  const byAmount = (a: { id: ID; v: number }, b: { id: ID; v: number }) => b.v - a.v || a.id.localeCompare(b.id);
  debtors.sort(byAmount);
  creditors.sort(byAmount);
  const out: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].v, creditors[j].v);
    if (amt > 0) out.push({ from: debtors[i].id, to: creditors[j].id, amount: amt });
    debtors[i].v -= amt;
    creditors[j].v -= amt;
    if (debtors[i].v === 0) i++;
    if (creditors[j].v === 0) j++;
  }
  return out;
}

/** Net balance per person across expenses (positive = is owed). */
export function netBalances(expenses: Expense[]): Map<ID, number> {
  const total = new Map<ID, number>();
  for (const e of expenses) {
    for (const [id, v] of expenseNet(e)) total.set(id, (total.get(id) ?? 0) + v);
  }
  for (const [id, v] of total) if (v === 0) total.delete(id);
  return total;
}

/** Who owes whom, with each expense's debts kept pairwise, then netted per pair. */
export function pairwiseTransfers(expenses: Expense[]): Transfer[] {
  const pair = new Map<string, number>(); // key "a|b" with a<b; value >0 means a owes b
  const add = (from: ID, to: ID, amt: number) => {
    if (from === to || amt === 0) return;
    if (from < to) pair.set(`${from}|${to}`, (pair.get(`${from}|${to}`) ?? 0) + amt);
    else pair.set(`${to}|${from}`, (pair.get(`${to}|${from}`) ?? 0) - amt);
  };
  for (const e of expenses) {
    for (const t of settleNets(expenseNet(e))) add(t.from, t.to, t.amount);
  }
  const out: Transfer[] = [];
  for (const [key, v] of pair) {
    if (v === 0) continue;
    const [a, b] = key.split('|');
    out.push(v > 0 ? { from: a, to: b, amount: v } : { from: b, to: a, amount: -v });
  }
  return out.sort((x, y) => y.amount - x.amount);
}

/** Debts to display for a group, either simplified or pairwise. */
export function groupTransfers(expenses: Expense[], simplify: boolean): Transfer[] {
  return simplify ? settleNets(netBalances(expenses)) : pairwiseTransfers(expenses);
}

/**
 * Balance between `me` and every other person across expenses.
 * Positive = they owe me, negative = I owe them.
 */
export function balancesWithMe(expenses: Expense[], meId: ID): Map<ID, number> {
  const out = new Map<ID, number>();
  for (const t of pairwiseTransfers(expenses)) {
    if (t.to === meId) out.set(t.from, (out.get(t.from) ?? 0) + t.amount);
    else if (t.from === meId) out.set(t.to, (out.get(t.to) ?? 0) - t.amount);
  }
  return out;
}

/** My share of an expense for list rows: positive = I lent, negative = I borrowed. */
export function myPosition(e: Expense, meId: ID): number {
  return expenseNet(e).get(meId) ?? 0;
}
