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

const MAX_EXACT = 20;

/**
 * Fewest possible transfers that settle `net`.
 * Splits people into the largest number of groups whose balances cancel out exactly
 * (a group of k people needs k-1 payments), then settles each group largest-first.
 * Falls back to the greedy method for very large groups.
 */
export function minTransfers(net: Map<ID, number>): Transfer[] {
  const entries = [...net.entries()].filter(([, v]) => v !== 0).sort((a, b) => a[0].localeCompare(b[0]));
  const n = entries.length;
  if (n === 0) return [];
  if (n > MAX_EXACT) return settleNets(new Map(entries));
  const vals = entries.map((e) => e[1]);
  const size = 1 << n;
  const sum = new Float64Array(size);
  const dp = new Int8Array(size);
  for (let m = 1; m < size; m++) {
    const low = m & -m;
    sum[m] = sum[m ^ low] + vals[31 - Math.clz32(low)];
    let best = 0;
    for (let k = 0; k < n; k++) if (m & (1 << k) && dp[m ^ (1 << k)] > best) best = dp[m ^ (1 << k)];
    dp[m] = best + (sum[m] === 0 ? 1 : 0);
  }
  // walk back to recover the zero-sum groups
  const groups: number[][] = [];
  let cur: number[] = [];
  let m = size - 1;
  while (m) {
    const target = dp[m] - (sum[m] === 0 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const bit = 1 << k;
      if (m & bit && dp[m ^ bit] === target) {
        cur.push(k);
        m ^= bit;
        break;
      }
    }
    if (sum[m] === 0) {
      groups.push(cur);
      cur = [];
    }
  }
  const out: Transfer[] = [];
  for (const g of groups) out.push(...settleNets(new Map(g.map((k) => entries[k]))));
  return out;
}

/**
 * Stable settle-up plan: the plan is worked out from the expenses, and payments are
 * ticked off against it, so paying one suggested amount never reshuffles the others.
 * Payments that don't match the plan are settled on top with the fewest extra transfers.
 */
export function settlementPlan(expenses: Expense[]): Transfer[] {
  const ordered = [...expenses].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const edges = new Map<string, number>();
  for (const t of minTransfers(netBalances(ordered.filter((e) => e.kind === 'expense')))) edges.set(`${t.from}|${t.to}`, t.amount);
  for (const p of ordered) {
    if (p.kind !== 'payment' || !p.payers[0] || !p.owed[0]) continue;
    const key = `${p.payers[0].personId}|${p.owed[0].personId}`;
    const have = edges.get(key) ?? 0;
    if (have > 0) edges.set(key, have - Math.min(have, p.amount));
  }
  // whatever the remaining plan doesn't explain gets settled separately
  const residual = netBalances(ordered);
  for (const [key, amt] of edges) {
    const [from, to] = key.split('|');
    residual.set(to, (residual.get(to) ?? 0) - amt);
    residual.set(from, (residual.get(from) ?? 0) + amt);
  }
  const pair = new Map<string, number>();
  const add = (from: ID, to: ID, amt: number) => {
    if (!amt || from === to) return;
    const rev = `${to}|${from}`;
    const back = pair.get(rev) ?? 0;
    if (back > 0) {
      const c = Math.min(back, amt);
      pair.set(rev, back - c);
      amt -= c;
    }
    if (amt > 0) pair.set(`${from}|${to}`, (pair.get(`${from}|${to}`) ?? 0) + amt);
  };
  for (const [key, amt] of edges) {
    const [from, to] = key.split('|');
    add(from, to, amt);
  }
  for (const t of minTransfers(residual)) add(t.from, t.to, t.amount);
  return [...pair.entries()]
    .filter(([, v]) => v > 0)
    .map(([key, amount]) => {
      const [from, to] = key.split('|');
      return { from, to, amount };
    })
    .sort((a, b) => b.amount - a.amount);
}

/** Debts to display for a group, either simplified or pairwise. */
export function groupTransfers(expenses: Expense[], simplify: boolean): Transfer[] {
  return simplify ? settlementPlan(expenses) : pairwiseTransfers(expenses);
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
