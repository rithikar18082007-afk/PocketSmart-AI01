import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../lib/api.ts';
import type { Goal } from '../shared/types.ts';
import { formatCurrency } from '../shared/format.ts';
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

const GOAL_CATEGORIES = [
  'Emergency fund',
  'New laptop',
  'Vacation',
  'Education',
  'Vehicle',
  'Home',
  'Custom goal',
];

export function GoalsPage() {
  const { user, notify } = useAuth();
  const cur = user?.currency || 'INR';

  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [form, setForm] = useState({
    name: '',
    category: 'Emergency fund',
    targetAmount: '',
    currentAmount: '',
    targetDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
    description: '',
  });
  const [saving, setSaving] = useState(false);

  const loadGoals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ goals: Goal[] }>('/goals');
      setGoals(res.goals);
    } catch (err: any) {
      setError(err.message || 'Failed to load financial goals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const openCreateModal = (presetCat = 'Emergency fund') => {
    setEditingGoal(null);
    setForm({
      name: presetCat === 'Custom goal' ? '' : presetCat,
      category: presetCat,
      targetAmount: '',
      currentAmount: '0',
      targetDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
      description: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (g: Goal) => {
    setEditingGoal(g);
    setForm({
      name: g.name,
      category: g.category,
      targetAmount: String(g.targetAmount),
      currentAmount: String(g.currentAmount),
      targetDate: g.targetDate,
      description: g.description || '',
    });
    setModalOpen(true);
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        category: form.category,
        targetAmount: Number(form.targetAmount),
        currentAmount: Number(form.currentAmount),
        targetDate: form.targetDate,
        description: form.description,
      };
      if (editingGoal) {
        const res = await apiRequest<{ goals: Goal[] }>(
          `/goals/${editingGoal.id}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          }
        );
        setGoals(res.goals);
        notify({ type: 'success', title: 'Financial goal updated' });
      } else {
        const res = await apiRequest<{ goals: Goal[] }>('/goals', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setGoals(res.goals);
        notify({ type: 'success', title: 'Financial goal created' });
      }
      setModalOpen(false);
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Unable to save goal',
        description: err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAddContribution = async (g: Goal, increment: number) => {
    try {
      const nextAmount = Math.min(g.targetAmount, g.currentAmount + increment);
      const res = await apiRequest<{ goals: Goal[] }>(`/goals/${g.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: g.name,
          category: g.category,
          targetAmount: g.targetAmount,
          currentAmount: nextAmount,
          targetDate: g.targetDate,
          description: g.description || '',
        }),
      });
      setGoals(res.goals);
      notify({
        type: 'success',
        title: `Added ${formatCurrency(increment, cur)} to ${g.name}`,
      });
    } catch (err: any) {
      notify({ type: 'error', title: 'Update failed', description: err.message });
    }
  };

  const handleDeleteGoal = async (id: string) => {
    try {
      await apiRequest(`/goals/${id}`, { method: 'DELETE' });
      setGoals((prev) => prev.filter((g) => g.id !== id));
      notify({ type: 'info', title: 'Goal deleted' });
    } catch (err: any) {
      notify({ type: 'error', title: 'Delete failed', description: err.message });
    }
  };

  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0);
  const overallProgress =
    totalTarget > 0 ? Number(((totalSaved / totalTarget) * 100).toFixed(1)) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Financial Goals & Milestones
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track progress toward your emergency fund, major purchases, education, or home targets
          </p>
        </div>
        <Button size="sm" onClick={() => openCreateModal()}>
          <Plus className="h-3.5 w-3.5" />
          <span>New Financial Goal</span>
        </Button>
      </div>

      {/* Quick Presets */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-500 font-medium mr-1">Quick Goal Templates:</span>
        {GOAL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => openCreateModal(cat)}
            className="px-2.5 py-1 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
          >
            + {cat}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error} onRetry={loadGoals} />}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Combined Goal Target</p>
          <p className="mt-1.5 text-xl font-bold text-slate-900 font-mono tabular-nums">
            {formatCurrency(totalTarget, cur)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Across {goals.length} active milestone{goals.length === 1 ? '' : 's'}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Total Accumulated</p>
          <p className="mt-1.5 text-xl font-bold text-emerald-700 font-mono tabular-nums">
            {formatCurrency(totalSaved, cur)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 font-mono tabular-nums">
            {overallProgress}% combined completion
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Remaining to Save</p>
          <p className="mt-1.5 text-xl font-bold text-slate-900 font-mono tabular-nums">
            {formatCurrency(Math.max(0, totalTarget - totalSaved), cur)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Paced against your target dates
          </p>
        </Card>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <EmptyState
          title="No financial goals created yet"
          description="Set a target for your emergency fund, new laptop, vacation, or home to see monthly savings pacing."
          actionLabel="Create First Goal"
          onAction={() => openCreateModal()}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {goals.map((g) => {
            const isComplete = g.progressPercent >= 100;
            return (
              <Card key={g.id} className="p-6 flex flex-col justify-between space-y-5">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {g.category} · Target {g.targetDate}
                      </p>
                      <h3 className="text-base font-semibold text-slate-900 mt-0.5">
                        {g.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(g)}
                        aria-label={`Edit ${g.name}`}
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteGoal(g.id)}
                        aria-label={`Delete ${g.name}`}
                        className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {g.description && (
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {g.description}
                    </p>
                  )}

                  <div className="pt-2 space-y-2">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-mono tabular-nums font-semibold text-slate-900">
                        {formatCurrency(g.currentAmount, cur)}
                      </span>
                      <span className="font-mono tabular-nums text-slate-500">
                        of {formatCurrency(g.targetAmount, cur)} ({g.progressPercent}%)
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isComplete ? 'bg-emerald-600' : 'bg-slate-900'
                        }`}
                        style={{ width: `${Math.min(100, g.progressPercent)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="text-xs text-slate-600 flex items-center gap-1.5">
                    {isComplete ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="font-medium text-emerald-700">
                          Goal achieved!
                        </span>
                      </>
                    ) : (
                      <span className="font-mono tabular-nums text-[11px] text-slate-500">
                        {g.estimatedCompletionText}
                      </span>
                    )}
                  </div>

                  {!isComplete && (
                    <div className="flex items-center justify-between gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => handleQuickAddContribution(g, 5000)}
                      >
                        <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Add +{formatCurrency(5000, cur)}</span>
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Goal Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingGoal ? 'Edit Financial Goal' : 'Create Financial Goal'}
        description="Set a target amount and completion date to calculate your monthly required contribution."
      >
        <form onSubmit={handleSaveGoal} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Goal Category
              </label>
              <Select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {GOAL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Goal Name
              </label>
              <Input
                type="text"
                required
                placeholder="e.g., 6-Month Emergency Fund"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Target Amount ({cur})
              </label>
              <Input
                type="number"
                step="100"
                min="1"
                required
                placeholder="300000"
                value={form.targetAmount}
                onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
                className="font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Current Saved Amount ({cur})
              </label>
              <Input
                type="number"
                step="100"
                min="0"
                required
                placeholder="50000"
                value={form.currentAmount}
                onChange={(e) => setForm({ ...form, currentAmount: e.target.value })}
                className="font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Target Completion Date
            </label>
            <Input
              type="date"
              required
              value={form.targetDate}
              onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Description (Optional)
            </label>
            <Input
              type="text"
              placeholder="Notes on where this fund is invested or held"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
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
              {saving ? 'Saving...' : editingGoal ? 'Update Goal' : 'Create Goal'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
