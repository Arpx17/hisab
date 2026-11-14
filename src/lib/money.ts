export const CURRENCIES: { code: string; label: string }[] = [
  { code: 'INR', label: 'Indian Rupee' },
  { code: 'USD', label: 'US Dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British Pound' },
  { code: 'AED', label: 'UAE Dirham' },
  { code: 'SGD', label: 'Singapore Dollar' },
  { code: 'AUD', label: 'Australian Dollar' },
  { code: 'CAD', label: 'Canadian Dollar' },
  { code: 'JPY', label: 'Japanese Yen' },
  { code: 'THB', label: 'Thai Baht' },
  { code: 'BDT', label: 'Bangladeshi Taka' },
  { code: 'NPR', label: 'Nepalese Rupee' },
  { code: 'LKR', label: 'Sri Lankan Rupee' },
];

export function decimals(currency: string): number {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/** Format minor units as a currency string. */
export function formatMoney(minor: number, currency: string, opts: { sign?: boolean; compact?: boolean } = {}): string {
  const d = opts.compact && minor % 10 ** decimals(currency) === 0 ? 0 : decimals(currency);
  const value = Math.abs(minor) / 10 ** d;
  let s: string;
  try {
    s = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en', {
      style: 'currency',
      currency,
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    }).format(value);
  } catch {
    s = `${currency} ${value.toFixed(d)}`;
  }
  if (minor < 0) return `-${s}`;
  if (opts.sign && minor > 0) return `+${s}`;
  return s;
}

/** Parse user text ("1,250.5") into minor units. Returns NaN when invalid. */
export function parseMoney(text: string, currency: string): number {
  const d = decimals(currency);
  const cleaned = text.replace(/[,\s]/g, '').replace(/^[^\d.-]+/, '');
  if (cleaned === '' || cleaned === '.' || cleaned === '-') return NaN;
  if (!/^-?\d*\.?\d*$/.test(cleaned)) return NaN;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 10 ** d);
}

/** Minor units to plain editable string ("12.50"). */
export function toInput(minor: number, currency: string): string {
  if (!minor) return '';
  const d = decimals(currency);
  const v = minor / 10 ** d;
  return d === 0 ? String(v) : v.toFixed(d).replace(/\.?0+$/, '');
}
