import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Download,
  ShieldAlert,
  Lock,
  Landmark,
  Tag,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest, downloadTransactionsCSV } from '../lib/api.ts';
import type { Category, Account, TransactionType, AccountType } from '../shared/types.ts';
import { formatCurrency } from '../shared/format.ts';
import {
  Button,
  Input,
  Select,
  Card,
  Modal,
} from '../components/ui/primitives.tsx';

export function SettingsPage() {
  const { user, updateUserState, logout, notify } = useAuth();
  const cur = user?.currency || 'INR';

  // Profile & Preferences
  const [name, setName] = useState(user?.name || '');
  const [currency, setCurrency] = useState(user?.currency || 'INR');
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    user?.notificationsEnabled ?? true
  );
  const [budgetAlertsThreshold, setBudgetAlertsThreshold] = useState(
    String(user?.budgetAlertsThreshold ?? 80)
  );
  const [savingProfile, setSavingProfile] = useState(false);

  // Categories & Accounts
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<TransactionType>('EXPENSE');
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<AccountType>('SAVINGS');
  const [newAccBalance, setNewAccBalance] = useState('');

  // Security (Password Change)
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Delete Account Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const loadSettingsData = useCallback(async () => {
    try {
      const [catRes, accRes] = await Promise.all([
        apiRequest<{ categories: Category[] }>('/categories'),
        apiRequest<{ accounts: Account[] }>('/accounts'),
      ]);
      setCategories(catRes.categories);
      setAccounts(accRes.accounts);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadSettingsData();
  }, [loadSettingsData]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await apiRequest<{ user: NonNullable<typeof user> }>(
        '/users/profile',
        {
          method: 'PUT',
          body: JSON.stringify({
            name,
            currency,
            notificationsEnabled,
            budgetAlertsThreshold: Number(budgetAlertsThreshold),
          }),
        }
      );
      updateUserState(res.user);
      notify({
        type: 'success',
        title: 'Profile & preferences saved',
      });
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Failed to update profile',
        description: err.message,
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      const res = await apiRequest<{ category: Category }>('/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: newCatName.trim(),
          type: newCatType,
          color: '#0f172a',
        }),
      });
      setCategories((prev) => [...prev, res.category]);
      setNewCatName('');
      notify({ type: 'success', title: `Added category "${res.category.name}"` });
    } catch (err: any) {
      notify({ type: 'error', title: 'Could not add category', description: err.message });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await apiRequest(`/categories/${id}`, { method: 'DELETE' });
      setCategories((prev) => prev.filter((c) => c.id !== id));
      notify({ type: 'info', title: 'Category deleted' });
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Cannot delete category',
        description: err.message,
      });
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) return;
    try {
      const res = await apiRequest<{ account: Account }>('/accounts', {
        method: 'POST',
        body: JSON.stringify({
          name: newAccName.trim(),
          type: newAccType,
          balance: Number(newAccBalance || 0),
        }),
      });
      setAccounts((prev) => [...prev, res.account]);
      setNewAccName('');
      setNewAccBalance('');
      notify({ type: 'success', title: `Account "${res.account.name}" added` });
    } catch (err: any) {
      notify({ type: 'error', title: 'Failed to add account', description: err.message });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangingPassword(true);
    try {
      await apiRequest('/users/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      notify({ type: 'success', title: 'Password updated successfully' });
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Password update failed',
        description: err.message,
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleExportFullJSON = async () => {
    try {
      const data = await apiRequest<Record<string, unknown>>('/users/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pocketsmart-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify({ type: 'success', title: 'Complete JSON archive exported' });
    } catch (err: any) {
      notify({ type: 'error', title: 'Export failed', description: err.message });
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await apiRequest('/users/account', { method: 'DELETE' });
      setDeleteModalOpen(false);
      logout();
    } catch (err: any) {
      notify({ type: 'error', title: 'Delete failed', description: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Account & Workspace Settings
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage your profile, default currency, custom categories, accounts, security, and data portability
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Profile, Currency & Notification Preferences */}
        <Card className="lg:col-span-6 p-6 space-y-5">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Profile, Currency & Alert Preferences
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure how currency amounts and budget warnings are displayed across PocketSmart AI
            </p>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Display Name
              </label>
              <Input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Primary Currency
                </label>
                <Select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="INR">Indian Rupee (₹ INR)</option>
                  <option value="USD">US Dollar ($ USD)</option>
                  <option value="EUR">Euro (€ EUR)</option>
                  <option value="GBP">British Pound (£ GBP)</option>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Budget Warning Threshold (%)
                </label>
                <Input
                  type="number"
                  min="50"
                  max="100"
                  required
                  value={budgetAlertsThreshold}
                  onChange={(e) => setBudgetAlertsThreshold(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3.5">
              <div>
                <p className="text-xs font-medium text-slate-900">
                  Proactive AI Insight & Budget Alerts
                </p>
                <p className="text-[11px] text-slate-500">
                  Show warnings when category spending approaches your threshold
                </p>
              </div>
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
                className="h-4 w-4 accent-slate-900 cursor-pointer"
              />
            </div>

            <Button type="submit" variant="primary" disabled={savingProfile}>
              {savingProfile ? 'Saving...' : 'Save Preferences'}
            </Button>
          </form>
        </Card>

        {/* Security & Password */}
        <Card className="lg:col-span-6 p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-slate-600" />
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Security & Password
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Update your authentication password
              </p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Current Password
              </label>
              <Input
                type="password"
                required
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                New Password
              </label>
              <Input
                type="password"
                required
                minLength={8}
                placeholder="Minimum 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <Button type="submit" variant="outline" disabled={changingPassword}>
              {changingPassword ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        </Card>
      </div>

      {/* Accounts & Custom Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Accounts */}
        <Card className="lg:col-span-6 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-slate-600" />
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Financial Accounts
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Bank accounts, credit cards, and investment folios
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="py-2.5 flex items-center justify-between"
              >
                <div>
                  <span className="font-medium text-slate-900">{acc.name}</span>
                  <span className="mx-1.5 text-slate-300" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-slate-500">{acc.type}</span>
                </div>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {formatCurrency(acc.balance, cur)}
                </span>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleAddAccount}
            className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2.5"
          >
            <Input
              type="text"
              placeholder="Account Name"
              value={newAccName}
              onChange={(e) => setNewAccName(e.target.value)}
              required
            />
            <Select
              value={newAccType}
              onChange={(e) => setNewAccType(e.target.value as AccountType)}
            >
              <option value="SAVINGS">Savings</option>
              <option value="CHECKING">Current / Checking</option>
              <option value="CREDIT_CARD">Credit Card</option>
              <option value="INVESTMENT">Investment</option>
              <option value="WALLET">UPI / Wallet</option>
            </Select>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Balance"
                value={newAccBalance}
                onChange={(e) => setNewAccBalance(e.target.value)}
                className="font-mono"
              />
              <Button type="submit" size="sm">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </form>
        </Card>

        {/* Categories */}
        <Card className="lg:col-span-6 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-slate-600" />
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Transaction Categories
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Customize income and expense categories
              </p>
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 text-xs pr-1">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="py-2 flex items-center justify-between"
              >
                <div>
                  <span className="font-medium text-slate-900">{cat.name}</span>
                  <span className="mx-1.5 text-slate-300" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-slate-500">{cat.type}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(cat.id)}
                  aria-label={`Delete ${cat.name}`}
                  className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleAddCategory}
            className="pt-3 border-t border-slate-100 flex items-center gap-2"
          >
            <Input
              type="text"
              placeholder="New category name..."
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              required
            />
            <Select
              value={newCatType}
              onChange={(e) => setNewCatType(e.target.value as TransactionType)}
              className="w-36"
            >
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
            </Select>
            <Button type="submit" size="sm">
              <Plus className="h-3.5 w-3.5" />
              <span>Add</span>
            </Button>
          </form>
        </Card>
      </div>

      {/* Data Export & Account Deletion */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-6 p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">
            Data Export & Portability
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Download your complete personal finance archive in JSON format or export your transaction ledger as a standard CSV spreadsheet.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleExportFullJSON}>
              <Download className="h-3.5 w-3.5" />
              <span>Export Full JSON Archive</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await downloadTransactionsCSV();
                  notify({ type: 'success', title: 'CSV exported' });
                } catch (err: any) {
                  notify({ type: 'error', title: 'Export failed', description: err.message });
                }
              }}
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Transactions CSV</span>
            </Button>
          </div>
        </Card>

        <Card className="lg:col-span-6 p-6 border-red-200 bg-red-50/30 space-y-4">
          <div className="flex items-center gap-2 text-red-700">
            <ShieldAlert className="h-4 w-4" />
            <h3 className="text-base font-semibold">Delete Account & Erase Data</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Permanently remove your profile, accounts, transactions, budgets, goals, and AI insights from the server.
          </p>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setDeleteModalOpen(true)}
          >
            Delete My Account
          </Button>
        </Card>
      </div>

      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirm Permanent Account Deletion"
        description="This action permanently deletes your profile, transactions, budgets, and goals. Type DELETE to confirm."
      >
        <div className="space-y-4">
          <Input
            type="text"
            placeholder="Type DELETE to confirm"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={deleteConfirmText !== 'DELETE'}
              onClick={handleDeleteAccount}
            >
              Permanently Delete Account
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
