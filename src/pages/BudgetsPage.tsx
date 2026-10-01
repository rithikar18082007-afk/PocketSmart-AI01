import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../lib/api.ts';
import type { Budget, Category } from '../shared/types.ts';
import { formatCurrency, formatMonthLabel } from '../shared/format.ts';
import {
  Button,
  Input,
  Select,
  Card,
  Modal,
  Skeleton,
  EmptyState,
  ErrorBanner,
} from '../components/ui/primitives.tsx';

export function BudgetsPage() {
  const { user, selectedMonth, notify } = useAuth();
  const cur = user?.currency || 'INR';

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [saving, setSaving] = useState(false);

  const loadBudgets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bRes, cRes] = await Promise.all([
        apiRequest<{ budgets: Budget[] }>(
          `/budgets?month=${encodeURIComponent(selectedMonth)}`
        ),
        apiRequest<{ categories: Category[] }>('/categories'),
      ]);
      setBudgets(bRes.budgets);
      const expCats = cRes.categories.filter((c) => c.type === 'EXPENSE');
      setCategories(expCats);
      if (expCats[0] && !selectedCategoryId) {
        setSelectedCategoryId(expCats[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load budgets');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedCategoryId]);

  useEffect(() => {
    loadBudgets();
  }, [loadBudgets]);

  const openCreateModal = (presetCategoryId?: string) => {
    setEditingBudget(null);
    setSelectedCategoryId(presetCategoryId || categories[0]?.id || '');
    setAmountInput('');
    setModalOpen(true);
  };

  const openEditModal = (b: Budget) => {
    setEditingBudget(b);
    setSelectedCategoryId(b.categoryId);
    setAmountInput(String(b.amount));
    setModalOpen(true);
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const [yearStr, monthStr] = selectedMonth.split('-');
      if (editingBudget) {
        const res = await apiRequest<{ budgets: Budget[] }>(
          `/budgets/${editingBudget.id}`,
          {
            method: 'PUT',
            body: JSON.stringify({ amount: Number(amountInput) }),
          }
        );
        setBudgets(res.budgets);
        notify({ type: 'success', title: 'Budget limit updated' });
      } else {
        const res = await apiRequest<{ budgets: Budget[] }>('/budgets', {
          method: 'POST',
          body: JSON.stringify({
            categoryId: selectedCategoryId,
            amount: Number(amountInput),
            month: Number(monthStr),
            year: Number(yearStr),
          }),
        });
        setBudgets(res.budgets);
        notify({ type: 'success', title: 'Monthly category budget saved' });
      }
      setModalOpen(false);
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Failed to save budget',
        description: err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    try {
      await apiRequest(`/budgets/${id}`, { method: 'DELETE' });
      setBudgets((prev) => prev.filter((b) => b.id !== id));
      notify({ type: 'info', title: 'Budget removed' });
    } catch (err: any) {
      notify({ type: 'error', title: 'Delete failed', description: err.message });
    }
  };

  const totalBudgeted = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const totalRemaining = totalBudgeted - totalSpent;
  const overallUtilization =
    totalBudgeted > 0 ? Number(((totalSpent / totalBudgeted) * 100).toFixed(1)) : 0;

  const budgetedCatIds = new Set(budgets.map((b) => b.categoryId));
  const unbudgetedCategories = categories.filter((c) => !budgetedCatIds.has(c.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Monthly Budgets · {formatMonthLabel(selectedMonth)}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Set category limits, track real-time utilization, and receive warnings at{' '}
            {user?.budgetAlertsThreshold || 80}% utilization
          </p>
        </div>
        <Button size="sm" onClick={() => openCreateModal()}>
          <Plus className="h-3.5 w-3.5" />
          <span>Create Category Budget</span>
        </Button>
      </div>

      {error && <ErrorBanner message={error} onRetry={loadBudgets} />}

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Total Planned Budget</p>
          <p className="mt-1.5 text-xl font-bold text-slate-900 font-mono tabular-nums">
            {formatCurrency(totalBudgeted, cur)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Across {budgets.length} budgeted categor{budgets.length === 1 ? 'y' : 'ies'}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Total Budget Spent</p>
          <p className="mt-1.5 text-xl font-bold text-slate-900 font-mono tabular-nums">
            {formatCurrency(totalSpent, cur)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 font-mono tabular-nums">
            {overallUtilization}% overall utilization
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Remaining Allocation</p>
          <p
            className={`mt-1.5 text-xl font-bold font-mono tabular-nums ${
              totalRemaining >= 0 ? 'text-emerald-700' : 'text-red-600'
            }`}
          >
            {formatCurrency(totalRemaining, cur)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {totalRemaining >= 0 ? 'Available before hitting cap' : 'Over planned total'}
          </p>
        </Card>
      </div>

      {/* Budgets List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <EmptyState
          title={`No category budgets set for ${formatMonthLabel(selectedMonth)}`}
          description="Create monthly category limits to monitor spending pace and prevent budget overruns."
          actionLabel="Create First Budget"
          onAction={() => openCreateModal()}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map((b) => {
            const isExceeded = b.status === 'EXCEEDED';
            const isWarning = b.status === 'WARNING';

            const StatusIcon = isExceeded
              ? AlertOctagon
              : isWarning
              ? AlertTriangle
              : CheckCircle2;
            const statusText = isExceeded
              ? `Exceeded by ${formatCurrency(Math.abs(b.remaining), cur)}`
              : isWarning
              ? `Approaching limit · ${formatCurrency(b.remaining, cur)} left`
              : `On track · ${formatCurrency(b.remaining, cur)} remaining`;
            const statusColor = isExceeded
              ? 'text-red-600'
              : isWarning
              ? 'text-amber-700'
              : 'text-emerald-700';
            const barColor = isExceeded
              ? 'bg-red-600'
              : isWarning
              ? 'bg-amber-500'
              : 'bg-emerald-600';

            return (
              <Card key={b.id} className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {b.categoryName}
                    </h3>
                    <div
                      className={`mt-1 flex items-center gap-1.5 text-xs font-medium ${statusColor}`}
                    >
                      <StatusIcon className="h-3.5 w-3.5 shrink-0" />
                      <span>{statusText}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(b)}
                      aria-label={`Edit ${b.categoryName} budget`}
                      className="p-1.5 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBudget(b.id)}
                      aria-label={`Delete ${b.categoryName} budget`}
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-mono tabular-nums text-slate-700">
                      Spent: <strong>{formatCurrency(b.spent, cur)}</strong> of{' '}
                      {formatCurrency(b.amount, cur)}
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {b.utilizationPercent}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${Math.min(100, b.utilizationPercent)}%` }}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Quick Unbudgeted Categories */}
      {unbudgetedCategories.length > 0 && (
        <Card className="p-5">
          <p className="text-xs font-semibold text-slate-800">
            Unbudgeted Expense Categories for {formatMonthLabel(selectedMonth)}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Click any category below to assign a monthly spending cap:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {unbudgetedCategories.map((c) => (
              <Button
                key={c.id}
                variant="outline"
                size="sm"
                onClick={() => openCreateModal(c.id)}
              >
                <Plus className="h-3 w-3" />
                <span>{c.name}</span>
              </Button>
            ))}
          </div>
        </Card>
      )}

      {/* Create/Edit Budget Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingBudget
            ? `Update ${editingBudget.categoryName} Budget`
            : `Set Category Budget (${formatMonthLabel(selectedMonth)})`
        }
        description="Define a monthly spending cap to track utilization and trigger early threshold warnings."
      >
        <form onSubmit={handleSaveBudget} className="space-y-4">
          {!editingBudget && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Expense Category
              </label>
              <Select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                required
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Monthly Limit ({cur})
            </label>
            <Input
              type="number"
              step="100"
              min="1"
              required
              placeholder="15000"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className="font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Budget Limit'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
