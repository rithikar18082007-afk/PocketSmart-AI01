import React, { useEffect, useState, useCallback } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  Plus,
  RefreshCw,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../lib/api.ts';
import type { DashboardSummary } from '../shared/types.ts';
import {
  formatCurrency,
  formatCompactCurrency,
  formatMonthLabel,
} from '../shared/format.ts';
import {
  Button,
  Card,
  Skeleton,
  EmptyState,
  ErrorBanner,
} from '../components/ui/primitives.tsx';
import type { NavTab } from '../components/layout/AppShell.tsx';

export function DashboardPage({
  onNavigate,
}: {
  onNavigate: (tab: NavTab) => void;
}) {
  const { selectedMonth, notify } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshingInsights, setRefreshingInsights] = useState(false);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<DashboardSummary>(
        `/dashboard?month=${encodeURIComponent(selectedMonth)}`
      );
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Unable to load dashboard summary');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleRefreshInsights = async () => {
    setRefreshingInsights(true);
    try {
      const res = await apiRequest<{ insights: DashboardSummary['insights'] }>(
        '/insights/generate',
        {
          method: 'POST',
          body: JSON.stringify({ month: selectedMonth }),
        }
      );
      if (data) {
        setData({ ...data, insights: res.insights });
      }
      notify({
        type: 'success',
        title: 'Insights updated',
        description: 'Recalculated insights from your latest transactions and budgets.',
      });
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Failed to refresh insights',
        description: err.message,
      });
    } finally {
      setRefreshingInsights(false);
    }
  };

  const handleMarkInsightRead = async (id: string) => {
    try {
      await apiRequest(`/insights/${id}/read`, { method: 'PATCH' });
      if (data) {
        setData({
          ...data,
          insights: data.insights.map((ins) =>
            ins.id === id ? { ...ins, readAt: new Date().toISOString() } : ins
          ),
        });
      }
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Skeleton className="lg:col-span-8 h-80 w-full" />
          <Skeleton className="lg:col-span-4 h-80 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <ErrorBanner
        message={error || 'Failed to load dashboard'}
        onRetry={fetchDashboard}
      />
    );
  }

  const cur = data.currency;

  return (
    <div className="space-y-8">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Financial Overview · {formatMonthLabel(data.month)}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Deterministic cash flow, budget utilization, and AI insights for your accounts
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('transactions')}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Transaction</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onNavigate('assistant')}
          >
            <span>Ask AI About {formatMonthLabel(data.month)}</span>
          </Button>
        </div>
      </div>

      {/* 5 Core KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Total Balance</p>
          <p className="mt-2 text-xl font-bold text-slate-900 font-mono tabular-nums">
            {formatCurrency(data.totalBalance, cur)}
          </p>
          <p className="mt-1.5 text-[11px] text-slate-500">
            Across {data.accounts.length} active account{data.accounts.length === 1 ? '' : 's'}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Monthly Income</p>
          <p className="mt-2 text-xl font-bold text-emerald-700 font-mono tabular-nums">
            {formatCurrency(data.monthlyIncome, cur)}
          </p>
          <p className="mt-1.5 text-[11px] text-slate-500 font-mono tabular-nums">
            {data.momIncomeChangePercent !== null
              ? `${data.momIncomeChangePercent >= 0 ? '+' : ''}${data.momIncomeChangePercent}% vs last month`
              : 'Current period total'}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Monthly Expenses</p>
          <p className="mt-2 text-xl font-bold text-slate-900 font-mono tabular-nums">
            {formatCurrency(data.monthlyExpenses, cur)}
          </p>
          <p className="mt-1.5 text-[11px] text-slate-500 font-mono tabular-nums">
            {data.momExpenseChangePercent !== null
              ? `${data.momExpenseChangePercent >= 0 ? '+' : ''}${data.momExpenseChangePercent}% vs last month`
              : 'Current period total'}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Net Savings</p>
          <p
            className={`mt-2 text-xl font-bold font-mono tabular-nums ${
              data.netSavings >= 0 ? 'text-emerald-700' : 'text-red-600'
            }`}
          >
            {formatCurrency(data.netSavings, cur)}
          </p>
          <p className="mt-1.5 text-[11px] text-slate-500 font-mono tabular-nums">
            Savings Rate: {data.savingsRate}%
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Remaining Budget</p>
          <p
            className={`mt-2 text-xl font-bold font-mono tabular-nums ${
              data.remainingBudget >= 0 ? 'text-slate-900' : 'text-red-600'
            }`}
          >
            {formatCurrency(data.remainingBudget, cur)}
          </p>
          <p className="mt-1.5 text-[11px] text-slate-500 font-mono tabular-nums">
            Of {formatCurrency(data.totalBudgeted, cur)} budgeted
          </p>
        </Card>
      </div>

      {/* Spending Trend Chart + AI Insight Engine */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 6-Month Cash Flow & Spending Trend */}
        <Card className="lg:col-span-7 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                6-Month Cash Flow & Spending Trend
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Monthly income vs. expenses trajectory ending {formatMonthLabel(data.month)}
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-emerald-600 inline-block" />
                Income
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-slate-900 inline-block" />
                Expenses
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.spendingTrend}
                margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f172a" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(val) => formatCompactCurrency(val, cur)}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  width={68}
                />
                <Tooltip
                  formatter={(value: any) => formatCurrency(Number(value), cur)}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    borderRadius: '0.5rem',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  name="Income"
                  stroke="#059669"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#incomeGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  name="Expenses"
                  stroke="#0f172a"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#expenseGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* AI Insight Engine */}
        <Card className="lg:col-span-5 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                AI Insight Engine
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Automated observations from your verified financial records
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshInsights}
              disabled={refreshingInsights}
              title="Recalculate insights"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshingInsights ? 'animate-spin' : ''}`}
              />
              <span>Refresh</span>
            </Button>
          </div>

          {data.insights.length === 0 ? (
            <EmptyState
              title="No insights yet"
              description="Add transactions and budgets to receive automated spending insights."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {data.insights.map((ins) => {
                const Icon =
                  ins.severity === 'warning'
                    ? AlertTriangle
                    : ins.severity === 'positive'
                    ? CheckCircle2
                    : Info;
                const iconColor =
                  ins.severity === 'warning'
                    ? 'text-amber-600'
                    : ins.severity === 'positive'
                    ? 'text-emerald-600'
                    : 'text-slate-600';

                return (
                  <div key={ins.id} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-3">
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${iconColor}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-900">
                            {ins.title}
                          </p>
                          {!ins.readAt && (
                            <button
                              type="button"
                              onClick={() => handleMarkInsightRead(ins.id)}
                              className="text-[11px] text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
                            >
                              Acknowledge
                            </button>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                          {ins.description}
                        </p>
                        {ins.secondaryNote && (
                          <p className="mt-1 text-[11px] text-slate-500 font-mono tabular-nums">
                            {ins.secondaryNote}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Budget Progress + Financial Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Budget Progress */}
        <Card className="lg:col-span-6 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Monthly Budget Utilization
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Category limits and remaining room for {formatMonthLabel(data.month)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('budgets')}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 cursor-pointer"
            >
              <span>Manage Budgets</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {data.budgets.length === 0 ? (
            <EmptyState
              title="No budgets configured for this month"
              description="Create monthly category limits to monitor utilization and receive early alerts."
              actionLabel="Set Up Budgets"
              onAction={() => onNavigate('budgets')}
            />
          ) : (
            <div className="space-y-4">
              {data.budgets.slice(0, 5).map((b) => {
                const barColor =
                  b.status === 'EXCEEDED'
                    ? 'bg-red-600'
                    : b.status === 'WARNING'
                    ? 'bg-amber-500'
                    : 'bg-emerald-600';
                const statusLabel =
                  b.status === 'EXCEEDED'
                    ? 'Exceeded limit'
                    : b.status === 'WARNING'
                    ? 'Approaching limit'
                    : 'On track';

                return (
                  <div key={b.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">
                          {b.categoryName}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span
                          className={
                            b.status === 'EXCEEDED'
                              ? 'text-red-600 font-medium'
                              : b.status === 'WARNING'
                              ? 'text-amber-700 font-medium'
                              : 'text-slate-500'
                          }
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <span className="font-mono tabular-nums text-slate-700">
                        {formatCurrency(b.spent, cur)} / {formatCurrency(b.amount, cur)} (
                        {b.utilizationPercent}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${Math.min(100, b.utilizationPercent)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Financial Goals */}
        <Card className="lg:col-span-6 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Financial Goals Progress
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Savings targets and estimated monthly contributions
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('goals')}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 cursor-pointer"
            >
              <span>View All Goals</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {data.goals.length === 0 ? (
            <EmptyState
              title="No active financial goals"
              description="Set a target for your emergency fund, vacation, or major purchase."
              actionLabel="Create Goal"
              onAction={() => onNavigate('goals')}
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {data.goals.slice(0, 4).map((g) => (
                <div key={g.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-900">{g.name}</span>
                      <span className="text-slate-300 mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-slate-500">{g.category}</span>
                    </div>
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {g.progressPercent}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-slate-900"
                      style={{ width: `${Math.min(100, g.progressPercent)}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span className="font-mono tabular-nums">
                      {formatCurrency(g.currentAmount, cur)} of{' '}
                      {formatCurrency(g.targetAmount, cur)}
                    </span>
                    <span>{g.estimatedCompletionText}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent Transactions Table */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Recent Transactions
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Latest entries recorded in {formatMonthLabel(data.month)}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('transactions')}
          >
            View Full Ledger
          </Button>
        </div>

        {data.recentTransactions.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No transactions for this month"
              description="Log an income or expense entry or import a CSV statement."
              actionLabel="Add Transaction"
              onAction={() => onNavigate('transactions')}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Category & Method</th>
                  <th className="py-3 px-4">Account</th>
                  <th className="py-3 px-6 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {data.recentTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3 px-6 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {tx.date}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {tx.description}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      <span>{tx.categoryName}</span>
                      <span className="mx-1.5 text-slate-300" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-slate-400">{tx.paymentMethod}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {tx.accountName}
                    </td>
                    <td
                      className={`py-3 px-6 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                        tx.type === 'INCOME'
                          ? 'text-emerald-700'
                          : 'text-slate-900'
                      }`}
                    >
                      {tx.type === 'INCOME' ? '+' : '-'}
                      {formatCurrency(tx.amount, cur)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
