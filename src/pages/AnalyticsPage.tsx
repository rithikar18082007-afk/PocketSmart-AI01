import React, { useEffect, useState, useCallback } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../lib/api.ts';
import type { DashboardSummary, RecurringTransaction } from '../shared/types.ts';
import {
  formatCurrency,
  formatCompactCurrency,
  formatMonthLabel,
} from '../shared/format.ts';
import {
  Card,
  Skeleton,
  EmptyState,
  ErrorBanner,
} from '../components/ui/primitives.tsx';

interface AnalyticsPayload extends DashboardSummary {
  recurring: RecurringTransaction[];
}

export function AnalyticsPage() {
  const { selectedMonth } = useAuth();
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<AnalyticsPayload>(
        `/analytics?month=${encodeURIComponent(selectedMonth)}`
      );
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Unable to load analytics');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <ErrorBanner
        message={error || 'Failed to load analytics'}
        onRetry={loadAnalytics}
      />
    );
  }

  const cur = data.currency;
  const activeRecurring = data.recurring.filter((r) => r.active);
  const totalMonthlyRecurring = activeRecurring.reduce(
    (s, r) => s + r.monthlyEquivalent,
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Spending & Cash Flow Analytics · {formatMonthLabel(data.month)}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Deep breakdown of income vs. expenses, category concentration, savings trajectory, and budget performance
        </p>
      </div>

      {/* Row 1: Monthly Income vs Expenses + Savings Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900">
              Monthly Income vs. Expenses (6-Month Window)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Side-by-side cash inflow and outflow comparison
            </p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.spendingTrend}
                margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => formatCompactCurrency(v, cur)}
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
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar
                  dataKey="income"
                  name="Income"
                  fill="#059669"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="expenses"
                  name="Expenses"
                  fill="#0f172a"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Net Savings Trend */}
        <Card className="p-6">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900">
              Net Monthly Savings Trajectory
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Monthly surplus retained after all recorded expenses
            </p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data.spendingTrend}
                margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => formatCompactCurrency(v, cur)}
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
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line
                  type="monotone"
                  dataKey="savings"
                  name="Net Savings"
                  stroke="#059669"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#059669' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Row 2: Top Spending Categories & MoM Breakdown + Budget Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-6 p-6">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900">
              Spending by Category ({formatMonthLabel(data.month)})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Share of monthly expenses and month-over-month change
            </p>
          </div>

          {data.categorySpending.length === 0 ? (
            <EmptyState
              title="No expenses recorded in this period"
              description="Category distribution will appear once expenses are logged for this month."
            />
          ) : (
            <div className="space-y-3.5">
              {data.categorySpending.map((cat) => (
                <div key={cat.categoryId} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">
                        {cat.categoryName}
                      </span>
                      <span className="text-slate-300" aria-hidden="true">
                        ·
                      </span>
                      <span className="font-mono tabular-nums text-slate-500">
                        {cat.sharePercent}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono tabular-nums">
                      <span className="font-semibold text-slate-900">
                        {formatCurrency(cat.amount, cur)}
                      </span>
                      {cat.changePercent !== null && (
                        <span
                          className={`text-[11px] ${
                            cat.changePercent > 0
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          ({cat.changePercent > 0 ? '+' : ''}
                          {cat.changePercent}% MoM)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-slate-900"
                      style={{ width: `${Math.min(100, cat.sharePercent)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Budget Performance Chart */}
        <Card className="lg:col-span-6 p-6">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900">
              Budget Performance (Planned vs. Actual)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparison of category budget limits against actual spend
            </p>
          </div>

          {data.budgets.length === 0 ? (
            <EmptyState
              title="No budgets configured"
              description="Set category budgets on the Budgets page to compare planned vs. actual spend."
            />
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.budgets}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 20, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => formatCompactCurrency(v, cur)}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="categoryName"
                    tick={{ fontSize: 11, fill: '#0f172a' }}
                    axisLine={false}
                    tickLine={false}
                    width={110}
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
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar
                    dataKey="amount"
                    name="Budget Limit"
                    fill="#94a3b8"
                    radius={[0, 4, 4, 0]}
                  />
                  <Bar
                    dataKey="spent"
                    name="Actual Spent"
                    fill="#0f172a"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Row 3: Recurring Commitment Analysis */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Recurring Expense Commitments
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Active fixed bills, subscriptions, and automated investment plans
            </p>
          </div>
          <div className="text-xs text-slate-700 font-mono tabular-nums">
            Total Monthly Equivalent:{' '}
            <strong className="text-slate-900">
              {formatCurrency(totalMonthlyRecurring, cur)}/mo
            </strong>{' '}
            ({formatCurrency(totalMonthlyRecurring * 12, cur)}/yr)
          </div>
        </div>

        {activeRecurring.length === 0 ? (
          <EmptyState
            title="No active recurring expenses"
            description="Configure recurring items in the Transactions page to analyze your fixed commitments."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeRecurring.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-slate-200 p-4 space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900 truncate">
                    {item.description}
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {formatCurrency(item.amount, cur)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    {item.categoryName} · {item.frequency}
                  </span>
                  <span className="font-mono tabular-nums">
                    ~{formatCurrency(item.monthlyEquivalent, cur)}/mo
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
