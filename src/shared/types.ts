export type TransactionType = 'INCOME' | 'EXPENSE';

export type AccountType = 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'INVESTMENT' | 'WALLET';

export type FrequencyType = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export type InsightType =
  | 'SPENDING_INCREASE'
  | 'BUDGET_WARNING'
  | 'RECURRING_ALERT'
  | 'SAVINGS_RATE'
  | 'CATEGORY_CONCENTRATION'
  | 'SAVING_OPPORTUNITY';

export interface User {
  id: string;
  name: string;
  email: string;
  currency: string;
  isDemo: boolean;
  notificationsEnabled: boolean;
  budgetAlertsThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  categoryId: string;
  categoryName?: string;
  categoryColor?: string;
  accountName?: string;
  type: TransactionType;
  amount: number;
  description: string;
  date: string; // YYYY-MM-DD
  paymentMethod: string;
  notes?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  amount: number;
  spent: number;
  remaining: number;
  utilizationPercent: number;
  status: 'ON_TRACK' | 'WARNING' | 'EXCEEDED';
  month: number;
  year: number;
}

export interface Goal {
  id: string;
  userId: string;
  name: string;
  category: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string; // YYYY-MM-DD
  description?: string;
  progressPercent: number;
  remainingAmount: number;
  monthsRemaining: number;
  requiredMonthlyContribution: number;
  estimatedCompletionText: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringTransaction {
  id: string;
  userId: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  description: string;
  amount: number;
  frequency: FrequencyType;
  monthlyEquivalent: number;
  nextDate: string; // YYYY-MM-DD
  active: boolean;
}

export interface AIInsight {
  id: string;
  userId: string;
  type: InsightType;
  title: string;
  description: string;
  secondaryNote?: string;
  severity: 'info' | 'warning' | 'positive';
  metadata?: Record<string, unknown>;
  createdAt: string;
  readAt?: string | null;
}

export interface DashboardSummary {
  month: string; // YYYY-MM
  currency: string;
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  netSavings: number;
  savingsRate: number;
  totalBudgeted: number;
  totalBudgetSpent: number;
  remainingBudget: number;
  momIncomeChangePercent: number | null;
  momExpenseChangePercent: number | null;
  momExpenseDiff: number;
  spendingTrend: {
    month: string;
    label: string;
    income: number;
    expenses: number;
    savings: number;
  }[];
  categorySpending: {
    categoryId: string;
    categoryName: string;
    color: string;
    amount: number;
    sharePercent: number;
    previousMonthAmount: number;
    changePercent: number | null;
  }[];
  recentTransactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  insights: AIInsight[];
  accounts: Account[];
}

export interface CSVPreviewRow {
  rowNumber: number;
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  paymentMethod: string;
  suggestedCategoryId: string;
  suggestedCategoryName: string;
  notes?: string;
  isValid: boolean;
  isDuplicate: boolean;
  errors: string[];
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  structuredBreakdown?: {
    calculatedFacts: string[];
    estimatesAndAssumptions: string[];
    financialEducation: string[];
  };
}
