import type { AppData } from './types';
import { decimals } from './money';

const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export function expensesCSV(d: AppData): string {
  const name = (id: string) => d.people.find((p) => p.id === id)?.name ?? '?';
  const rows = [['Date', 'Group', 'Type', 'Description', 'Category', 'Currency', 'Amount', 'Paid by', 'Split between (owes)']];
  for (const e of [...d.expenses].sort((a, b) => a.date.localeCompare(b.date))) {
    const dec = decimals(e.currency);
    const fmt = (n: number) => (n / 10 ** dec).toFixed(dec);
    rows.push([
      e.date,
      e.groupId ? d.groups.find((g) => g.id === e.groupId)?.name ?? '' : 'Non-group',
      e.kind,
      e.description,
      e.category,
      e.currency,
      fmt(e.amount),
      e.payers.map((p) => `${name(p.personId)} ${fmt(p.amount)}`).join('; '),
      e.owed.map((p) => `${name(p.personId)} ${fmt(p.amount)}`).join('; '),
    ]);
  }
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}
