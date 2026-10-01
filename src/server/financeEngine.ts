import type { PocketSmartDB } from './db.ts';
import type {
  Budget,
  Goal,
  AIInsight,
  DashboardSummary,
  CSVPreviewRow,
  TransactionType,
} from '../shared/types.ts';
import { formatCurrency, formatMonthLabel, getCurrentYearMonth } from '../shared/format.ts';

function getPreviousYearMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function calculateBudgetsForMonth(
  database: PocketSmartDB,
  userId: string,
  yearMonth: string
): Budget[] {
  const [year, month] = yearMonth.split('-').map(Number);
  const user = database.findUserById(userId);
  const threshold = user?.budgetAlertsThreshold ?? 80;

  const storedBudgets = database.getStoredBudgets(userId, month, year);
  const categories = new Map(database.getCategories(userId).map((c) => [c.id, c]));
  const monthTransactions = database
    .getTransactions(userId)
    .filter((t) => t.type === 'EXPENSE' && t.date.startsWith(yearMonth));

  const spentByCat = new Map<string, number>();
  for (const tx of monthTransactions) {
    spentByCat.set(tx.categoryId, (spentByCat.get(tx.categoryId) || 0) + tx.amount);
  }

  return storedBudgets
    .map((b) => {
      const cat = categories.get(b.categoryId);
      const spent = Number((spentByCat.get(b.categoryId) || 0).toFixed(2));
      const remaining = Number((b.amount - spent).toFixed(2));
      const utilizationPercent =
        b.amount > 0 ? Number(((spent / b.amount) * 100).toFixed(1)) : 0;

      const status: 'ON_TRACK' | 'WARNING' | 'EXCEEDED' =
        utilizationPercent >= 100
          ? 'EXCEEDED'
          : utilizationPercent >= threshold
          ? 'WARNING'
          : 'ON_TRACK';

      return {
        id: b.id,
        userId: b.userId,
        categoryId: b.categoryId,
        categoryName: cat?.name || 'Category',
        categoryColor: cat?.color || '#0f172a',
        amount: b.amount,
        spent,
        remaining,
        utilizationPercent,
        status,
        month: b.month,
        year: b.year,
      };
    })
    .sort((a, b) => b.utilizationPercent - a.utilizationPercent);
}

export function calculateGoals(
  database: PocketSmartDB,
  userId: string,
  monthlyNetSavings: number = 0,
  currency: string = 'INR'
): Goal[] {
  const storedGoals = database.getStoredGoals(userId);
  const now = new Date();

  return storedGoals.map((g) => {
    const remainingAmount = Math.max(0, Number((g.targetAmount - g.currentAmount).toFixed(2)));
    const progressPercent =
      g.targetAmount > 0
        ? Math.min(100, Number(((g.currentAmount / g.targetAmount) * 100).toFixed(1)))
        : 0;

    const target = new Date(`${g.targetDate}T00:00:00`);
    const diffMs = target.getTime() - now.getTime();
    const monthsRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30.44)));
    const requiredMonthlyContribution =
      remainingAmount > 0 ? Number((remainingAmount / monthsRemaining).toFixed(2)) : 0;

    let estimatedCompletionText = 'Goal achieved';
    if (remainingAmount > 0) {
      if (monthlyNetSavings > 0) {
        const estMonthsAt25PctSavings = Math.ceil(
          remainingAmount / Math.max(requiredMonthlyContribution, monthlyNetSavings * 0.25)
        );
        estimatedCompletionText = `Needs ${formatCurrency(
          requiredMonthlyContribution,
          currency
        )}/mo over ${monthsRemaining} mo (~${estMonthsAt25PctSavings} mo at current pace)`;
      } else {
        estimatedCompletionText = `Requires ${formatCurrency(
          requiredMonthlyContribution,
          currency
        )}/mo for ${monthsRemaining} months`;
      }
    }

    return {
      ...g,
      progressPercent,
      remainingAmount,
      monthsRemaining,
      requiredMonthlyContribution,
      estimatedCompletionText,
    };
  });
}

export function generateDeterministicInsights(
  database: PocketSmartDB,
  userId: string,
  yearMonth: string
): AIInsight[] {
  const user = database.findUserById(userId);
  const currency = user?.currency || 'INR';
  const prevMonth = getPreviousYearMonth(yearMonth);

  const allTx = database.getTransactions(userId);
  const currentTx = allTx.filter((t) => t.date.startsWith(yearMonth));
  const prevTx = allTx.filter((t) => t.date.startsWith(prevMonth));

  const currentIncome = currentTx
    .filter((t) => t.type === 'INCOME')
    .reduce((s, t) => s + t.amount, 0);
  const currentExpenses = currentTx
    .filter((t) => t.type === 'EXPENSE')
    .reduce((s, t) => s + t.amount, 0);

  const prevIncome = prevTx
    .filter((t) => t.type === 'INCOME')
    .reduce((s, t) => s + t.amount, 0);
  const prevExpenses = prevTx
    .filter((t) => t.type === 'EXPENSE')
    .reduce((s, t) => s + t.amount, 0);

  const insights: Omit<AIInsight, 'id' | 'createdAt'>[] = [];

  // 1. Category-level Month-over-Month spending comparison
  const curCatMap = new Map<string, { name: string; amount: number }>();
  for (const t of currentTx.filter((x) => x.type === 'EXPENSE')) {
    const existing = curCatMap.get(t.categoryId) || {
      name: t.categoryName || 'Category',
      amount: 0,
    };
    existing.amount += t.amount;
    curCatMap.set(t.categoryId, existing);
  }

  const prevCatMap = new Map<string, number>();
  for (const t of prevTx.filter((x) => x.type === 'EXPENSE')) {
    prevCatMap.set(t.categoryId, (prevCatMap.get(t.categoryId) || 0) + t.amount);
  }

  let biggestCatDiff = {
    name: '',
    diff: 0,
    pct: 0,
    cur: 0,
    prev: 0,
  };

  for (const [catId, curObj] of curCatMap.entries()) {
    const prevVal = prevCatMap.get(catId) || 0;
    const diff = curObj.amount - prevVal;
    if (prevVal > 0 && diff > biggestCatDiff.diff) {
      biggestCatDiff = {
        name: curObj.name,
        diff: Number(diff.toFixed(2)),
        pct: Number(((diff / prevVal) * 100).toFixed(1)),
        cur: curObj.amount,
        prev: prevVal,
      };
    }
  }

  if (biggestCatDiff.diff > 0) {
    insights.push({
      userId,
      type: 'SPENDING_INCREASE',
      title: `${biggestCatDiff.name} spending rose this month`,
      description: `You spent ${formatCurrency(
        biggestCatDiff.diff,
        currency
      )} more on ${biggestCatDiff.name} this month than last month.`,
      secondaryNote: `That represents a ${biggestCatDiff.pct}% increase (${formatCurrency(
        biggestCatDiff.cur,
        currency
      )} vs ${formatCurrency(biggestCatDiff.prev, currency)}).`,
      severity: biggestCatDiff.pct >= 20 ? 'warning' : 'info',
      metadata: biggestCatDiff,
    });
  }

  // 2. Budget warnings (approaching or exceeding limits)
  const budgets = calculateBudgetsForMonth(database, userId, yearMonth);
  const warningBudgets = budgets.filter(
    (b) => b.status === 'WARNING' || b.status === 'EXCEEDED'
  );
  if (warningBudgets.length > 0) {
    const topBdg = warningBudgets[0];
    if (topBdg.status === 'EXCEEDED') {
      insights.push({
        userId,
        type: 'BUDGET_WARNING',
        title: `${topBdg.categoryName} budget exceeded`,
        description: `You have utilized ${topBdg.utilizationPercent}% of your ${formatCurrency(
          topBdg.amount,
          currency
        )} ${topBdg.categoryName} budget.`,
        secondaryNote: `Overspent by ${formatCurrency(
          Math.abs(topBdg.remaining),
          currency
        )} for ${formatMonthLabel(yearMonth)}.`,
        severity: 'warning',
      });
    } else {
      insights.push({
        userId,
        type: 'BUDGET_WARNING',
        title: `${topBdg.categoryName} is approaching its budget limit`,
        description: `You have spent ${formatCurrency(
          topBdg.spent,
          currency
        )} (${topBdg.utilizationPercent}%) of your ${formatCurrency(
          topBdg.amount,
          currency
        )} monthly limit.`,
        secondaryNote: `${formatCurrency(
          topBdg.remaining,
          currency
        )} remaining for the rest of the month.`,
        severity: 'warning',
      });
    }
  }

  // 3. Savings rate analysis
  if (currentIncome > 0) {
    const curSavings = currentIncome - currentExpenses;
    const curSavingsRate = Number(((curSavings / currentIncome) * 100).toFixed(1));
    const prevSavingsRate =
      prevIncome > 0
        ? Number((((prevIncome - prevExpenses) / prevIncome) * 100).toFixed(1))
        : null;

    if (prevSavingsRate !== null) {
      const rateDelta = Number((curSavingsRate - prevSavingsRate).toFixed(1));
      insights.push({
        userId,
        type: 'SAVINGS_RATE',
        title:
          rateDelta >= 0
            ? `Savings rate improved to ${curSavingsRate}%`
            : `Savings rate shifted to ${curSavingsRate}%`,
        description: `Your net savings for ${formatMonthLabel(
          yearMonth
        )} is ${formatCurrency(curSavings, currency)} (${curSavingsRate}% of income).`,
        secondaryNote:
          rateDelta >= 0
            ? `Up ${rateDelta} percentage points compared with last month (${prevSavingsRate}%).`
            : `Changed by ${rateDelta} percentage points compared with last month (${prevSavingsRate}%).`,
        severity: curSavingsRate >= 25 ? 'positive' : 'info',
      });
    } else {
      insights.push({
        userId,
        type: 'SAVINGS_RATE',
        title: `Monthly savings rate at ${curSavingsRate}%`,
        description: `You saved ${formatCurrency(
          curSavings,
          currency
        )} out of ${formatCurrency(currentIncome, currency)} income this month.`,
        secondaryNote:
          curSavingsRate >= 20
            ? 'Exceeds the standard 20% personal savings benchmark.'
            : 'Aiming for 20% or more can accelerate your financial goals.',
        severity: curSavingsRate >= 20 ? 'positive' : 'info',
      });
    }
  }

  // 4. Recurring commitments insight
  const recurring = database.getRecurringTransactions(userId).filter((r) => r.active);
  if (recurring.length > 0) {
    const totalMonthlyRecurring = recurring.reduce(
      (sum, r) => sum + r.monthlyEquivalent,
      0
    );
    insights.push({
      userId,
      type: 'RECURRING_ALERT',
      title: `${recurring.length} active recurring commitments`,
      description: `Your scheduled recurring bills and investments total ${formatCurrency(
        totalMonthlyRecurring,
        currency
      )} per month.`,
      secondaryNote:
        currentIncome > 0
          ? `Represents ${((totalMonthlyRecurring / currentIncome) * 100).toFixed(
              1
            )}% of your monthly income.`
          : `Largest recurring item: ${recurring[0].description} (${formatCurrency(
              recurring[0].amount,
              currency
            )}).`,
      severity: 'info',
    });
  }

  // 5. Category concentration / saving opportunity
  if (currentExpenses > 0 && curCatMap.size > 0) {
    const sortedCats = Array.from(curCatMap.values()).sort((a, b) => b.amount - a.amount);
    const topCat = sortedCats[0];
    const topShare = Number(((topCat.amount / currentExpenses) * 100).toFixed(1));
    const discretionaryCat = sortedCats.find(
      (c) =>
        c.name.toLowerCase().includes('food') ||
        c.name.toLowerCase().includes('shopping') ||
        c.name.toLowerCase().includes('entertainment')
    );

    if (discretionaryCat && discretionaryCat.amount > 0) {
      const potential15PctSaving = Number((discretionaryCat.amount * 0.15).toFixed(2));
      insights.push({
        userId,
        type: 'SAVING_OPPORTUNITY',
        title: `Opportunity in ${discretionaryCat.name}`,
        description: `Trimming ${discretionaryCat.name} (${formatCurrency(
          discretionaryCat.amount,
          currency
        )}) by 15% could free up ${formatCurrency(
          potential15PctSaving,
          currency
        )} per month.`,
        secondaryNote: `That equals ${formatCurrency(
          potential15PctSaving * 12,
          currency
        )} in additional annual savings toward your goals.`,
        severity: 'positive',
      });
    } else {
      insights.push({
        userId,
        type: 'CATEGORY_CONCENTRATION',
        title: `${topCat.name} is your largest expense`,
        description: `${topCat.name} accounts for ${topShare}% (${formatCurrency(
          topCat.amount,
          currency
        )}) of your total spending this month.`,
        severity: 'info',
      });
    }
  }

  return database.saveInsightsForUser(userId, insights);
}

export function buildDashboardSummary(
  database: PocketSmartDB,
  userId: string,
  requestedMonth?: string
): DashboardSummary {
  const month =
    requestedMonth && /^\d{4}-\d{2}$/.test(requestedMonth)
      ? requestedMonth
      : getCurrentYearMonth();
  const prevMonth = getPreviousYearMonth(month);
  const user = database.findUserById(userId);
  const currency = user?.currency || 'INR';

  const accounts = database.getAccounts(userId);
  const totalBalance = Number(
    accounts.reduce((sum, acc) => sum + acc.balance, 0).toFixed(2)
  );

  const allTransactions = database.getTransactions(userId);
  const monthTransactions = allTransactions.filter((t) => t.date.startsWith(month));
  const prevMonthTransactions = allTransactions.filter((t) =>
    t.date.startsWith(prevMonth)
  );

  const monthlyIncome = Number(
    monthTransactions
      .filter((t) => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0)
      .toFixed(2)
  );

  const monthlyExpenses = Number(
    monthTransactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0)
      .toFixed(2)
  );

  const prevIncome = Number(
    prevMonthTransactions
      .filter((t) => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0)
      .toFixed(2)
  );

  const prevExpenses = Number(
    prevMonthTransactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0)
      .toFixed(2)
  );

  // Deterministic math:
  // Savings = Income - Expenses
  // Savings Rate = Savings / Income * 100 (safe zero-income handling)
  const netSavings = Number((monthlyIncome - monthlyExpenses).toFixed(2));
  const savingsRate =
    monthlyIncome > 0
      ? Number(((netSavings / monthlyIncome) * 100).toFixed(1))
      : 0;

  const momIncomeChangePercent =
    prevIncome > 0
      ? Number((((monthlyIncome - prevIncome) / prevIncome) * 100).toFixed(1))
      : null;

  const momExpenseChangePercent =
    prevExpenses > 0
      ? Number((((monthlyExpenses - prevExpenses) / prevExpenses) * 100).toFixed(1))
      : null;

  const momExpenseDiff = Number((monthlyExpenses - prevExpenses).toFixed(2));

  const budgets = calculateBudgetsForMonth(database, userId, month);
  const totalBudgeted = Number(
    budgets.reduce((sum, b) => sum + b.amount, 0).toFixed(2)
  );
  const totalBudgetSpent = Number(
    budgets.reduce((sum, b) => sum + b.spent, 0).toFixed(2)
  );
  const remainingBudget = Number((totalBudgeted - totalBudgetSpent).toFixed(2));

  // Build 6-month trend ending at selected month
  const [selYear, selMonth] = month.split('-').map(Number);
  const spendingTrend: DashboardSummary['spendingTrend'] = [];
  for (let offset = -5; offset <= 0; offset++) {
    const d = new Date(selYear, selMonth - 1 + offset, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const mTx = allTransactions.filter((t) => t.date.startsWith(ym));
    const inc = Number(
      mTx
        .filter((t) => t.type === 'INCOME')
        .reduce((s, t) => s + t.amount, 0)
        .toFixed(2)
    );
    const exp = Number(
      mTx
        .filter((t) => t.type === 'EXPENSE')
        .reduce((s, t) => s + t.amount, 0)
        .toFixed(2)
    );
    spendingTrend.push({
      month: ym,
      label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      income: inc,
      expenses: exp,
      savings: Number((inc - exp).toFixed(2)),
    });
  }

  // Category spending breakdown with MoM delta
  const categories = new Map(database.getCategories(userId).map((c) => [c.id, c]));
  const curCatTotals = new Map<string, number>();
  const prevCatTotals = new Map<string, number>();

  for (const t of monthTransactions.filter((x) => x.type === 'EXPENSE')) {
    curCatTotals.set(t.categoryId, (curCatTotals.get(t.categoryId) || 0) + t.amount);
  }
  for (const t of prevMonthTransactions.filter((x) => x.type === 'EXPENSE')) {
    prevCatTotals.set(t.categoryId, (prevCatTotals.get(t.categoryId) || 0) + t.amount);
  }

  const categorySpending = Array.from(curCatTotals.entries())
    .map(([categoryId, rawAmount]) => {
      const cat = categories.get(categoryId);
      const amount = Number(rawAmount.toFixed(2));
      const previousMonthAmount = Number((prevCatTotals.get(categoryId) || 0).toFixed(2));
      const sharePercent =
        monthlyExpenses > 0
          ? Number(((amount / monthlyExpenses) * 100).toFixed(1))
          : 0;
      const changePercent =
        previousMonthAmount > 0
          ? Number(
              (((amount - previousMonthAmount) / previousMonthAmount) * 100).toFixed(1)
            )
          : null;

      return {
        categoryId,
        categoryName: cat?.name || 'Uncategorized',
        color: cat?.color || '#0f172a',
        amount,
        sharePercent,
        previousMonthAmount,
        changePercent,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const goals = calculateGoals(database, userId, netSavings, currency);
  const insights = generateDeterministicInsights(database, userId, month);

  return {
    month,
    currency,
    totalBalance,
    monthlyIncome,
    monthlyExpenses,
    netSavings,
    savingsRate,
    totalBudgeted,
    totalBudgetSpent,
    remainingBudget,
    momIncomeChangePercent,
    momExpenseChangePercent,
    momExpenseDiff,
    spendingTrend,
    categorySpending,
    recentTransactions: monthTransactions.slice(0, 8),
    budgets,
    goals,
    insights,
    accounts,
  };
}

// ==================== CSV IMPORT VALIDATION & PREVIEW ====================

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function normalizeDateString(raw: string): string | null {
  const cleaned = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    const d = new Date(`${cleaned}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : cleaned;
  }
  // Support DD/MM/YYYY or DD-MM-YYYY common in Indian bank statements
  const dmyMatch = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    const iso = `${year}-${month}-${day}`;
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : iso;
  }
  return null;
}

export function previewCSVImport(
  database: PocketSmartDB,
  userId: string,
  csvContent: string
): {
  columnsDetected: string[];
  rows: CSVPreviewRow[];
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
} {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new Error('CSV file must contain a header row and at least one transaction row.');
  }

  const headers = parseCSVLine(lines[0]);
  const lowerHeaders = headers.map((h) => h.toLowerCase());

  const dateIdx = lowerHeaders.findIndex((h) => h.includes('date'));
  const descIdx = lowerHeaders.findIndex(
    (h) =>
      h.includes('description') ||
      h.includes('narration') ||
      h.includes('merchant') ||
      h.includes('particular')
  );
  const amountIdx = lowerHeaders.findIndex((h) => h.includes('amount') || h.includes('value'));
  const typeIdx = lowerHeaders.findIndex((h) => h.includes('type') || h.includes('dr/cr'));
  const catIdx = lowerHeaders.findIndex((h) => h.includes('category'));
  const methodIdx = lowerHeaders.findIndex(
    (h) => h.includes('payment') || h.includes('method') || h.includes('mode')
  );
  const notesIdx = lowerHeaders.findIndex((h) => h.includes('note') || h.includes('remark'));

  if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
    throw new Error(
      'CSV must include at least Date, Description (or Narration), and Amount columns.'
    );
  }

  const userCategories = database.getCategories(userId);
  const existingTransactions = database.getTransactions(userId);

  const matchCategory = (
    rawCat: string,
    description: string,
    txType: TransactionType
  ): { id: string; name: string } => {
    const typedCats = userCategories.filter((c) => c.type === txType);
    const fallback = typedCats[0] || userCategories[0];

    if (rawCat) {
      const exact = typedCats.find(
        (c) =>
          c.name.toLowerCase() === rawCat.toLowerCase() ||
          c.name.toLowerCase().includes(rawCat.toLowerCase())
      );
      if (exact) return { id: exact.id, name: exact.name };
    }

    const descLower = description.toLowerCase();
    const keywordRules: Array<{ keywords: string[]; catMatch: string }> = [
      { keywords: ['swiggy', 'zomato', 'grocery', 'bigbasket', 'cafe', 'restaurant', 'dining', 'food'], catMatch: 'food' },
      { keywords: ['uber', 'ola', 'petrol', 'shell', 'metro', 'flight', 'irctc', 'fuel'], catMatch: 'transport' },
      { keywords: ['rent', 'maintenance', 'society'], catMatch: 'rent' },
      { keywords: ['amazon', 'myntra', 'flipkart', 'store', 'mall'], catMatch: 'shopping' },
      { keywords: ['airtel', 'jio', 'bescom', 'electricity', 'water', 'broadband', 'bill'], catMatch: 'bill' },
      { keywords: ['netflix', 'spotify', 'bookmyshow', 'movie', 'game'], catMatch: 'entertainment' },
      { keywords: ['apollo', 'pharmacy', 'hospital', 'clinic', 'cult.fit', 'gym'], catMatch: 'health' },
      { keywords: ['sip', 'zerodha', 'mutual fund', 'groww', 'investment'], catMatch: 'investment' },
      { keywords: ['salary', 'payroll', 'stipend'], catMatch: 'salary' },
    ];

    for (const rule of keywordRules) {
      if (rule.keywords.some((k) => descLower.includes(k))) {
        const matched = typedCats.find((c) =>
          c.name.toLowerCase().includes(rule.catMatch)
        );
        if (matched) return { id: matched.id, name: matched.name };
      }
    }

    return { id: fallback.id, name: fallback.name };
  };

  const rows: CSVPreviewRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const errors: string[] = [];

    const rawDate = cols[dateIdx] || '';
    const normalizedDate = normalizeDateString(rawDate);
    if (!normalizedDate) {
      errors.push(`Invalid date "${rawDate}" (use YYYY-MM-DD or DD/MM/YYYY)`);
    }

    const description = (cols[descIdx] || '').trim();
    if (!description) {
      errors.push('Missing description');
    }

    const rawAmountStr = (cols[amountIdx] || '').replace(/[₹$,\s]/g, '');
    const parsedAmount = Number(rawAmountStr);
    if (!rawAmountStr || Number.isNaN(parsedAmount) || parsedAmount === 0) {
      errors.push(`Invalid amount "${cols[amountIdx] || ''}"`);
    }

    const rawType = typeIdx !== -1 ? (cols[typeIdx] || '').toUpperCase().trim() : '';
    let txType: TransactionType = 'EXPENSE';
    if (
      rawType === 'INCOME' ||
      rawType === 'CREDIT' ||
      rawType === 'CR' ||
      parsedAmount < 0 && rawType === 'INCOME'
    ) {
      txType = 'INCOME';
    } else if (rawType && !['EXPENSE', 'DEBIT', 'DR', 'INCOME', 'CREDIT', 'CR'].includes(rawType)) {
      errors.push(`Invalid transaction type "${rawType}"`);
    }

    const cleanAmount = Math.abs(Number.isFinite(parsedAmount) ? parsedAmount : 0);
    const rawCat = catIdx !== -1 ? cols[catIdx] || '' : '';
    const paymentMethod =
      methodIdx !== -1 && cols[methodIdx] ? cols[methodIdx].trim() : 'UPI';
    const notes = notesIdx !== -1 && cols[notesIdx] ? cols[notesIdx].trim() : '';

    const matchedCat = matchCategory(rawCat, description, txType);

    const isDuplicate =
      normalizedDate !== null &&
      existingTransactions.some(
        (existing) =>
          existing.date === normalizedDate &&
          Math.abs(existing.amount - cleanAmount) < 0.01 &&
          existing.description.toLowerCase() === description.toLowerCase()
      );

    rows.push({
      rowNumber: i,
      date: normalizedDate || rawDate,
      description,
      amount: cleanAmount,
      type: txType,
      paymentMethod,
      suggestedCategoryId: matchedCat.id,
      suggestedCategoryName: matchedCat.name,
      notes,
      isValid: errors.length === 0,
      isDuplicate,
      errors,
    });
  }

  return {
    columnsDetected: headers,
    rows,
    validCount: rows.filter((r) => r.isValid && !r.isDuplicate).length,
    invalidCount: rows.filter((r) => !r.isValid).length,
    duplicateCount: rows.filter((r) => r.isValid && r.isDuplicate).length,
  };
}
