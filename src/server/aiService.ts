import { GoogleGenAI, Type } from '@google/genai';
import type { PocketSmartDB } from './db.ts';
import { buildDashboardSummary } from './financeEngine.ts';
import { formatCurrency, formatMonthLabel } from '../shared/format.ts';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface AssistantResponsePayload {
  answer: string;
  structuredBreakdown: {
    calculatedFacts: string[];
    estimatesAndAssumptions: string[];
    financialEducation: string[];
  };
}

/**
 * Deterministic fallback analyzer that uses the user's exact server-side
 * financial calculations if the Gemini API is unavailable or unconfigured.
 * Never fabricates balances, transactions, budgets, or goals.
 */
function buildDeterministicAssistantResponse(
  question: string,
  summary: ReturnType<typeof buildDashboardSummary>,
  recurring: ReturnType<PocketSmartDB['getRecurringTransactions']>
): AssistantResponsePayload {
  const q = question.toLowerCase();
  const cur = summary.currency;
  const monthLabel = formatMonthLabel(summary.month);

  const topCat = summary.categorySpending[0];
  const foodCat = summary.categorySpending.find(
    (c) =>
      c.categoryName.toLowerCase().includes('food') ||
      c.categoryName.toLowerCase().includes('dining')
  );

  const facts: string[] = [
    `${monthLabel} Total Income: ${formatCurrency(summary.monthlyIncome, cur)}`,
    `${monthLabel} Total Expenses: ${formatCurrency(summary.monthlyExpenses, cur)}`,
    `${monthLabel} Net Savings: ${formatCurrency(summary.netSavings, cur)} (Savings Rate: ${summary.savingsRate}%)`,
    `Combined Account Balance: ${formatCurrency(summary.totalBalance, cur)}`,
  ];

  const estimates: string[] = [];
  const education: string[] = [
    'The 50/30/20 rule suggests allocating 50% of take-home pay to essentials, 30% to discretionary lifestyle spending, and at least 20% to savings and investments.',
    'All figures above are derived strictly from your recorded PocketSmart AI transactions; projections are educational estimates and not guaranteed outcomes.',
  ];

  let answer = '';

  if (q.includes('food') || q.includes('dining') || q.includes('reduce dining')) {
    const foodSpend = foodCat ? foodCat.amount : 0;
    const save20 = Number((foodSpend * 0.2).toFixed(2));
    const save30 = Number((foodSpend * 0.3).toFixed(2));
    if (foodCat) {
      facts.unshift(
        `Food & Dining spending in ${monthLabel}: ${formatCurrency(foodSpend, cur)} (${foodCat.sharePercent}% of monthly expenses).`
      );
      if (foodCat.changePercent !== null) {
        facts.push(
          `Compared to last month (${formatCurrency(foodCat.previousMonthAmount, cur)}), Food & Dining changed by ${foodCat.changePercent > 0 ? '+' : ''}${foodCat.changePercent}%.`
        );
      }
    }
    estimates.push(
      `Assumed 20% reduction in Food & Dining frees up ${formatCurrency(save20, cur)}/month (${formatCurrency(save20 * 12, cur)}/year).`,
      `Assumed 30% reduction in Food & Dining frees up ${formatCurrency(save30, cur)}/month (${formatCurrency(save30 * 12, cur)}/year).`
    );
    answer = foodCat
      ? `In **${monthLabel}**, you spent **${formatCurrency(foodSpend, cur)}** on **${foodCat.categoryName}**, which represents **${foodCat.sharePercent}%** of your total monthly expenses (${formatCurrency(summary.monthlyExpenses, cur)}).\n\nIf you reduce dining and food delivery expenses by **20%**, you can save approximately **${formatCurrency(save20, cur)} per month** (**${formatCurrency(save20 * 12, cur)} annually**). A **30% reduction** would save **${formatCurrency(save30, cur)} per month**.`
      : `You have no recorded expenses under Food & Dining for **${monthLabel}**. Your total expenses for the month are **${formatCurrency(summary.monthlyExpenses, cur)}**.`;
  } else if (q.includes('recurring') || q.includes('subscription')) {
    const activeRec = recurring.filter((r) => r.active).sort((a, b) => b.monthlyEquivalent - a.monthlyEquivalent);
    const totalMonthlyRec = activeRec.reduce((s, r) => s + r.monthlyEquivalent, 0);
    facts.unshift(
      `Active recurring expenses: ${activeRec.length} items totaling ${formatCurrency(totalMonthlyRec, cur)}/month equivalent.`
    );
    for (const item of activeRec.slice(0, 4)) {
      facts.push(
        `${item.description}: ${formatCurrency(item.amount, cur)} (${item.frequency}) — ${formatCurrency(item.monthlyEquivalent, cur)}/mo`
      );
    }
    estimates.push(
      `Annualized recurring commitment at current rates is ${formatCurrency(totalMonthlyRec * 12, cur)}/year.`
    );
    answer =
      activeRec.length > 0
        ? `You have **${activeRec.length} active recurring commitments** totaling **${formatCurrency(totalMonthlyRec, cur)}/month**:\n\n` +
          activeRec
            .map(
              (r, idx) =>
                `${idx + 1}. **${r.description}** (${r.categoryName}): **${formatCurrency(r.amount, cur)}** (${r.frequency}, ~${formatCurrency(r.monthlyEquivalent, cur)}/mo)`
            )
            .join('\n')
        : `You currently have no active recurring transactions configured in your profile.`;
  } else if (q.includes('compare') || q.includes('last month')) {
    const prevTrend = summary.spendingTrend[summary.spendingTrend.length - 2];
    const prevExp = prevTrend ? prevTrend.expenses : 0;
    const diff = summary.momExpenseDiff;
    facts.unshift(
      `Previous month expenses: ${formatCurrency(prevExp, cur)} vs ${monthLabel} expenses: ${formatCurrency(summary.monthlyExpenses, cur)}.`
    );
    estimates.push(
      `If your current monthly net savings (${formatCurrency(summary.netSavings, cur)}) stays steady over the next 6 months, you could accumulate ${formatCurrency(Math.max(0, summary.netSavings * 6), cur)} in additional savings.`
    );
    answer = `Comparing **${monthLabel}** with last month:\n\n- **Monthly Income:** ${formatCurrency(summary.monthlyIncome, cur)} (${summary.momIncomeChangePercent !== null ? `${summary.momIncomeChangePercent >= 0 ? '+' : ''}${summary.momIncomeChangePercent}% vs last month` : 'baseline'})\n- **Monthly Expenses:** ${formatCurrency(summary.monthlyExpenses, cur)} (${diff >= 0 ? `+${formatCurrency(diff, cur)}` : formatCurrency(diff, cur)} / ${summary.momExpenseChangePercent !== null ? `${summary.momExpenseChangePercent >= 0 ? '+' : ''}${summary.momExpenseChangePercent}%` : 'N/A'})\n- **Net Savings:** ${formatCurrency(summary.netSavings, cur)} (**${summary.savingsRate}%** savings rate)`;
  } else if (q.includes('budget')) {
    const exceeded = summary.budgets.filter((b) => b.status === 'EXCEEDED');
    const warning = summary.budgets.filter((b) => b.status === 'WARNING');
    facts.unshift(
      `Total monthly budget: ${formatCurrency(summary.totalBudgeted, cur)} | Spent: ${formatCurrency(summary.totalBudgetSpent, cur)} | Remaining: ${formatCurrency(summary.remainingBudget, cur)}.`
    );
    estimates.push(
      `Keeping variable spending within the remaining ${formatCurrency(Math.max(0, summary.remainingBudget), cur)} allocation preserves your planned ${summary.savingsRate}% savings rate.`
    );
    answer = `For **${monthLabel}**, you have spent **${formatCurrency(summary.totalBudgetSpent, cur)}** out of your **${formatCurrency(summary.totalBudgeted, cur)}** total budget (**${formatCurrency(summary.remainingBudget, cur)} remaining**).\n\n- **Exceeded Budgets (${exceeded.length}):** ${exceeded.length > 0 ? exceeded.map((b) => `${b.categoryName} (${b.utilizationPercent}%)`).join(', ') : 'None'}\n- **Approaching Limit (${warning.length}):** ${warning.length > 0 ? warning.map((b) => `${b.categoryName} (${b.utilizationPercent}%)`).join(', ') : 'None'}`;
  } else {
    // Default comprehensive breakdown (e.g. "Where did I spend the most this month?" or "Give me ideas to reduce unnecessary spending")
    if (topCat) {
      facts.unshift(
        `Highest spending category in ${monthLabel}: ${topCat.categoryName} at ${formatCurrency(topCat.amount, cur)} (${topCat.sharePercent}% of total expenses).`
      );
    }
    const top3 = summary.categorySpending.slice(0, 3);
    const discretionaryTrim = Number((summary.monthlyExpenses * 0.1).toFixed(2));
    estimates.push(
      `Reducing top discretionary expenses by 10% would save an estimated ${formatCurrency(discretionaryTrim, cur)}/month (${formatCurrency(discretionaryTrim * 12, cur)}/year).`
    );
    answer = topCat
      ? `In **${monthLabel}**, your highest spending category is **${topCat.categoryName}** at **${formatCurrency(topCat.amount, cur)}** (**${topCat.sharePercent}%** of your ${formatCurrency(summary.monthlyExpenses, cur)} total expenses).\n\n**Top Spending Categories:**\n` +
        top3
          .map(
            (c, i) =>
              `${i + 1}. **${c.categoryName}:** ${formatCurrency(c.amount, cur)} (${c.sharePercent}%)`
          )
          .join('\n') +
        `\n\nYour net savings for ${monthLabel} is **${formatCurrency(summary.netSavings, cur)}** (**${summary.savingsRate}%** savings rate).`
      : `You have no recorded expenses for **${monthLabel}** yet. Add or import transactions to see category insights.`;
  }

  return {
    answer,
    structuredBreakdown: {
      calculatedFacts: facts,
      estimatesAndAssumptions: estimates,
      financialEducation: education,
    },
  };
}

export async function askFinancialAssistant(
  database: PocketSmartDB,
  userId: string,
  question: string,
  month?: string
): Promise<AssistantResponsePayload> {
  // Strictly load ONLY the authenticated user's data
  const summary = buildDashboardSummary(database, userId, month);
  const recurring = database.getRecurringTransactions(userId);
  const user = database.findUserById(userId);

  const ai = getGeminiClient();
  if (!ai) {
    return buildDeterministicAssistantResponse(question, summary, recurring);
  }

  const authorizedFinancialContext = {
    userName: user?.name || 'User',
    currency: summary.currency,
    selectedMonth: summary.month,
    totalBalanceAcrossAccounts: summary.totalBalance,
    accounts: summary.accounts.map((a) => ({
      name: a.name,
      type: a.type,
      balance: a.balance,
    })),
    monthlyMetrics: {
      income: summary.monthlyIncome,
      expenses: summary.monthlyExpenses,
      netSavings: summary.netSavings,
      savingsRatePercent: summary.savingsRate,
      totalBudgeted: summary.totalBudgeted,
      totalBudgetSpent: summary.totalBudgetSpent,
      remainingBudget: summary.remainingBudget,
      monthOverMonthIncomeChangePercent: summary.momIncomeChangePercent,
      monthOverMonthExpenseChangePercent: summary.momExpenseChangePercent,
      monthOverMonthExpenseDiff: summary.momExpenseDiff,
    },
    categorySpendingBreakdown: summary.categorySpending,
    budgets: summary.budgets.map((b) => ({
      category: b.categoryName,
      limit: b.amount,
      spent: b.spent,
      remaining: b.remaining,
      utilizationPercent: b.utilizationPercent,
      status: b.status,
    })),
    goals: summary.goals.map((g) => ({
      name: g.name,
      category: g.category,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      progressPercent: g.progressPercent,
      targetDate: g.targetDate,
      requiredMonthlyContribution: g.requiredMonthlyContribution,
    })),
    recurringTransactions: recurring.map((r) => ({
      description: r.description,
      category: r.categoryName,
      amount: r.amount,
      frequency: r.frequency,
      monthlyEquivalent: r.monthlyEquivalent,
      active: r.active,
    })),
    sixMonthTrend: summary.spendingTrend,
    recentTransactions: summary.recentTransactions.map((t) => ({
      date: t.date,
      description: t.description,
      category: t.categoryName,
      type: t.type,
      amount: t.amount,
      paymentMethod: t.paymentMethod,
    })),
  };

  const systemInstruction = `You are PocketSmart AI, an accurate, trustworthy personal finance assistant.
You are answering a question for the authenticated user using ONLY their authorized deterministic financial data provided below.

CRITICAL AI SAFETY & FINANCIAL ACCURACY RULES:
1. NEVER fabricate transactions, balances, income, expenses, budgets, or goals.
2. If requested information is not present in the provided JSON context, state clearly that the information is unavailable in their recorded records.
3. Rely on the pre-calculated deterministic numbers in the JSON context (e.g., monthlyMetrics, categorySpendingBreakdown, budgets, goals, recurringTransactions) rather than inventing numbers.
4. Format currency amounts in ${summary.currency} (using ₹ for INR, e.g., ₹1,250.00).
5. Clearly separate your response into:
   - answer: A clear, concise, helpful markdown response directly answering the user's question.
   - calculatedFacts: 2 to 5 exact, verifiable facts directly from the user's data.
   - estimatesAndAssumptions: 1 to 3 clearly labeled estimates or "what-if" projections (explaining the assumption used).
   - financialEducation: 1 to 2 general financial education principles (never present personalized guidance as a guaranteed outcome).

AUTHORIZED USER FINANCIAL CONTEXT (JSON):
${JSON.stringify(authorizedFinancialContext, null, 2)}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: question,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: {
              type: Type.STRING,
              description: 'Concise markdown answer to the user question grounded in their data.',
            },
            calculatedFacts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Exact facts calculated from the user financial records.',
            },
            estimatesAndAssumptions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Estimates or what-if projections with explicit assumptions.',
            },
            financialEducation: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'General financial education notes and non-guarantee disclaimers.',
            },
          },
          required: [
            'answer',
            'calculatedFacts',
            'estimatesAndAssumptions',
            'financialEducation',
          ],
        },
      },
    });

    const rawText = response.text;
    if (!rawText) {
      return buildDeterministicAssistantResponse(question, summary, recurring);
    }
    const parsed = JSON.parse(rawText.trim());
    return {
      answer: parsed.answer || 'Here is the analysis based on your financial records.',
      structuredBreakdown: {
        calculatedFacts: Array.isArray(parsed.calculatedFacts) ? parsed.calculatedFacts : [],
        estimatesAndAssumptions: Array.isArray(parsed.estimatesAndAssumptions)
          ? parsed.estimatesAndAssumptions
          : [],
        financialEducation: Array.isArray(parsed.financialEducation)
          ? parsed.financialEducation
          : [],
      },
    };
  } catch (error) {
    console.error('Gemini API fallback triggered:', error);
    return buildDeterministicAssistantResponse(question, summary, recurring);
  }
}
