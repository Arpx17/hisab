import type { AppData, Expense, Group, ID, Person } from './types';
import { groupTransfers, netBalances, pairwiseTransfers, type Transfer } from './balances';
import { formatMoney } from './money';

/** Debts for one scope: a group (honouring its simplify setting) or all non-group expenses in a currency. */
export function scopeTransfers(d: Pick<AppData, 'groups' | 'expenses'>, groupId: ID | null, currency?: string): Transfer[] {
  if (groupId) {
    const g = d.groups.find((x) => x.id === groupId);
    return g ? groupTransfers(d.expenses.filter((e) => e.groupId === groupId), g.simplify) : [];
  }
  return pairwiseTransfers(d.expenses.filter((e) => e.groupId === null && (!currency || e.currency === currency)));
}

/** Every scope that currently has debts: each group, plus non-group expenses per currency. */
export function allScopes(d: Pick<AppData, 'groups' | 'expenses'>): { groupId: ID | null; currency: string; transfers: Transfer[] }[] {
  const out = d.groups.map((g) => ({ groupId: g.id as ID | null, currency: g.currency, transfers: scopeTransfers(d, g.id) }));
  const cur = new Set(d.expenses.filter((e) => e.groupId === null).map((e) => e.currency));
  for (const c of cur) out.push({ groupId: null, currency: c, transfers: scopeTransfers(d, null, c) });
  return out;
}

/** Positive = `other` owes `me`; negative = `me` owes `other`. */
export function pairBalance(transfers: Transfer[], me: ID, other: ID): number {
  let v = 0;
  for (const t of transfers) {
    if (t.to === me && t.from === other) v += t.amount;
    else if (t.from === me && t.to === other) v -= t.amount;
  }
  return v;
}

/** per person -> per currency -> balance with me (positive = they owe me) */
export function friendBalances(d: Pick<AppData, 'groups' | 'expenses'>, meId: ID): Map<ID, Map<string, number>> {
  const out = new Map<ID, Map<string, number>>();
  for (const sc of allScopes(d)) {
    for (const t of sc.transfers) {
      let other: ID | null = null;
      let v = 0;
      if (t.to === meId) { other = t.from; v = t.amount; }
      else if (t.from === meId) { other = t.to; v = -t.amount; }
      if (!other) continue;
      const m = out.get(other) ?? new Map<string, number>();
      m.set(sc.currency, (m.get(sc.currency) ?? 0) + v);
      out.set(other, m);
    }
  }
  for (const [pid, m] of out) {
    for (const [c, v] of m) if (v === 0) m.delete(c);
    if (m.size === 0) out.delete(pid);
  }
  return out;
}

export interface Overall {
  currency: string;
  owed: number; // people owe me
  owe: number; // I owe people
}

export function overall(d: Pick<AppData, 'groups' | 'expenses'>, meId: ID): Overall[] {
  const totals = new Map<string, Overall>();
  for (const [, cm] of friendBalances(d, meId)) {
    for (const [cur, v] of cm) {
      const t = totals.get(cur) ?? { currency: cur, owed: 0, owe: 0 };
      if (v > 0) t.owed += v;
      else t.owe += -v;
      totals.set(cur, t);
    }
  }
  return [...totals.values()];
}

export function myGroupNet(expenses: Expense[], meId: ID): number {
  return netBalances(expenses).get(meId) ?? 0;
}

/** Plain-text group summary that can be pasted into WhatsApp. */
export function groupSummaryText(group: Group, expenses: Expense[], people: Person[], meId: ID | null): string {
  const nm = (id: ID) => (id === meId ? 'You' : people.find((p) => p.id === id)?.name ?? 'Someone');
  const transfers = groupTransfers(expenses, group.simplify);
  const total = expenses.filter((e) => e.kind === 'expense').reduce((s, e) => s + e.amount, 0);
  const lines = [`*${group.name}*`, `Total spent: ${formatMoney(total, group.currency)}`, ''];
  if (transfers.length === 0) lines.push('✅ Everyone is settled up!');
  else {
    lines.push('Who owes whom:');
    for (const t of transfers) lines.push(`• ${nm(t.from)} ${t.from === meId ? 'owe' : 'owes'} ${nm(t.to)} ${formatMoney(t.amount, group.currency)}`);
  }
  lines.push('', 'Sent from Hisab');
  return lines.join('\n');
}
