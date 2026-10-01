export const CURRENCY_CONFIG: Record<
  string,
  { symbol: string; locale: string; label: string }
> = {
  INR: { symbol: '₹', locale: 'en-IN', label: 'Indian Rupee (₹)' },
  USD: { symbol: '$', locale: 'en-US', label: 'US Dollar ($)' },
  EUR: { symbol: '€', locale: 'de-DE', label: 'Euro (€)' },
  GBP: { symbol: '£', locale: 'en-GB', label: 'British Pound (£)' },
};

export function formatCurrency(amount: number, currency: string = 'INR'): string {
  const cfg = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.INR;
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(cfg.locale, {
      style: 'currency',
      currency: currency in CURRENCY_CONFIG ? currency : 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeAmount);
  } catch {
    return `${cfg.symbol}${safeAmount.toFixed(2)}`;
  }
}

export function formatCompactCurrency(amount: number, currency: string = 'INR'): string {
  const cfg = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.INR;
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (currency === 'INR') {
    if (abs >= 10000000) {
      return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
    }
    if (abs >= 100000) {
      return `${sign}₹${(abs / 100000).toFixed(2)} L`;
    }
  }
  if (abs >= 1000) {
    return `${sign}${cfg.symbol}${(abs / 1000).toFixed(1)}k`;
  }
  return formatCurrency(amount, currency);
}

export function getCurrentYearMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function formatMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  if (!y || !m) return yearMonth;
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}
