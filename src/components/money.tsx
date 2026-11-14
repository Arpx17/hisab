import { formatMoney } from '../lib/money';

/** Coloured balance text: positive = owed to you (green), negative = you owe (orange). */
export function Balance({ amount, currency, className = '' }: { amount: number; currency: string; className?: string }) {
  const cls = amount > 0 ? 'pos' : amount < 0 ? 'neg' : 'muted';
  return <span className={`${cls} ${className}`}>{formatMoney(Math.abs(amount), currency)}</span>;
}
