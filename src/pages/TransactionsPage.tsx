import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Search,
  Upload,
  Download,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Repeat,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest, downloadTransactionsCSV } from '../lib/api.ts';
import type {
  Transaction,
  Category,
  Account,
  RecurringTransaction,
  CSVPreviewRow,
  TransactionType,
  FrequencyType,
} from '../shared/types.ts';
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

const SAMPLE_CSV_TEMPLATE = `Date,Description,Amount,Type,Category,PaymentMethod,Notes
2026-10-02,Blue Tokai Coffee Roasters,480,EXPENSE,Food & Dining,UPI,Morning coffee
2026-10-04,Shell V-Power Fuel Station,2850,EXPENSE,Transportation,Credit Card,Tank refill
2026-10-08,Quarterly Performance Bonus,25000,INCOME,Salary,NEFT,Q3 bonus payout
2026-10-12,Apollo Pharmacy Health Essentials,1150,EXPENSE,Healthcare,UPI,Vitamins and first aid`;

export function TransactionsPage() {
  const { user, notify } = useAuth();
  const cur = user?.currency || 'INR';

  const [subTab, setSubTab] = useState<'ledger' | 'recurring' | 'import'>('ledger');

  // Ledger state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'description'>('date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 12,
    totalCount: 0,
    totalPages: 1,
  });
  const [totals, setTotals] = useState({ income: 0, expense: 0, net: 0 });

  // Add/Edit Transaction Modal
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [txForm, setTxForm] = useState({
    type: 'EXPENSE' as TransactionType,
    amount: '',
    description: '',
    categoryId: '',
    accountId: '',
    date: new Date().toISOString().slice(0, 10),
    paymentMethod: 'UPI',
    notes: '',
  });
  const [savingTx, setSavingTx] = useState(false);

  // Recurring Transactions State
  const [recurringList, setRecurringList] = useState<RecurringTransaction[]>([]);
  const [recModalOpen, setRecModalOpen] = useState(false);
  const [editingRec, setEditingRec] = useState<RecurringTransaction | null>(null);
  const [recForm, setRecForm] = useState({
    description: '',
    amount: '',
    categoryId: '',
    frequency: 'MONTHLY' as FrequencyType,
    nextDate: new Date().toISOString().slice(0, 10),
    active: true,
  });

  // CSV Import State
  const [csvText, setCsvText] = useState('');
  const [csvAccountId, setCsvAccountId] = useState('');
  const [csvPreview, setCsvPreview] = useState<{
    columnsDetected: string[];
    rows: CSVPreviewRow[];
    validCount: number;
    invalidCount: number;
    duplicateCount: number;
  } | null>(null);
  const [importSummary, setImportSummary] = useState<{
    importedCount: number;
    skippedCount: number;
  } | null>(null);
  const [importingCsv, setImportingCsv] = useState(false);

  const loadMetadata = useCallback(async () => {
    try {
      const [catRes, accRes, recRes] = await Promise.all([
        apiRequest<{ categories: Category[] }>('/categories'),
        apiRequest<{ accounts: Account[] }>('/accounts'),
        apiRequest<{ recurring: RecurringTransaction[] }>('/recurring'),
      ]);
      setCategories(catRes.categories);
      setAccounts(accRes.accounts);
      setRecurringList(recRes.recurring);
      if (accRes.accounts[0] && !csvAccountId) {
        setCsvAccountId(accRes.accounts[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load metadata:', err);
    }
  }, [csvAccountId]);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '12',
        sortBy,
        sortOrder,
      });
      if (search.trim()) params.set('search', search.trim());
      if (categoryFilter !== 'ALL') params.set('categoryId', categoryFilter);
      if (typeFilter !== 'ALL') params.set('type', typeFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await apiRequest<{
        transactions: Transaction[];
        pagination: typeof pagination;
        totals: typeof totals;
      }>(`/transactions?${params.toString()}`);

      setTransactions(res.transactions);
      setPagination(res.pagination);
      setTotals(res.totals);
    } catch (err: any) {
      setError(err.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortOrder, search, categoryFilter, typeFilter, startDate, endDate]);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const openAddTxModal = () => {
    setEditingTx(null);
    const defaultCats = categories.filter((c) => c.type === 'EXPENSE');
    setTxForm({
      type: 'EXPENSE',
      amount: '',
      description: '',
      categoryId: defaultCats[0]?.id || categories[0]?.id || '',
      accountId: accounts[0]?.id || '',
      date: new Date().toISOString().slice(0, 10),
      paymentMethod: 'UPI',
      notes: '',
    });
    setTxModalOpen(true);
  };

  const openEditTxModal = (tx: Transaction) => {
    setEditingTx(tx);
    setTxForm({
      type: tx.type,
      amount: String(tx.amount),
      description: tx.description,
      categoryId: tx.categoryId,
      accountId: tx.accountId,
      date: tx.date,
      paymentMethod: tx.paymentMethod,
      notes: tx.notes || '',
    });
    setTxModalOpen(true);
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTx(true);
    try {
      const payload = {
        ...txForm,
        amount: Number(txForm.amount),
      };
      if (editingTx) {
        await apiRequest(`/transactions/${editingTx.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        notify({ type: 'success', title: 'Transaction updated' });
      } else {
        await apiRequest('/transactions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        notify({ type: 'success', title: 'Transaction recorded' });
      }
      setTxModalOpen(false);
      await loadTransactions();
      await loadMetadata();
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Failed to save transaction',
        description: err.message,
      });
    } finally {
      setSavingTx(false);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      await apiRequest(`/transactions/${id}`, { method: 'DELETE' });
      notify({ type: 'info', title: 'Transaction deleted' });
      await loadTransactions();
      await loadMetadata();
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Delete failed',
        description: err.message,
      });
    }
  };

  // Recurring handlers
  const openAddRecurringModal = () => {
    setEditingRec(null);
    const expCats = categories.filter((c) => c.type === 'EXPENSE');
    setRecForm({
      description: '',
      amount: '',
      categoryId: expCats[0]?.id || '',
      frequency: 'MONTHLY',
      nextDate: new Date().toISOString().slice(0, 10),
      active: true,
    });
    setRecModalOpen(true);
  };

  const handleSaveRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...recForm,
        amount: Number(recForm.amount),
      };
      if (editingRec) {
        const res = await apiRequest<{ recurring: RecurringTransaction[] }>(
          `/recurring/${editingRec.id}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          }
        );
        setRecurringList(res.recurring);
        notify({ type: 'success', title: 'Recurring expense updated' });
      } else {
        const res = await apiRequest<{ recurring: RecurringTransaction[] }>('/recurring', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setRecurringList(res.recurring);
        notify({ type: 'success', title: 'Recurring expense added' });
      }
      setRecModalOpen(false);
    } catch (err: any) {
      notify({ type: 'error', title: 'Error', description: err.message });
    }
  };

  const handleDeleteRecurring = async (id: string) => {
    try {
      await apiRequest(`/recurring/${id}`, { method: 'DELETE' });
      setRecurringList((prev) => prev.filter((r) => r.id !== id));
      notify({ type: 'info', title: 'Recurring item removed' });
    } catch (err: any) {
      notify({ type: 'error', title: 'Delete failed', description: err.message });
    }
  };

  // CSV Import handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCsvText(reader.result);
        setCsvPreview(null);
        setImportSummary(null);
      }
    };
    reader.readAsText(file);
  };

  const handlePreviewCSV = async () => {
    setImportSummary(null);
    try {
      const res = await apiRequest<NonNullable<typeof csvPreview>>(
        '/transactions/import/preview',
        {
          method: 'POST',
          body: JSON.stringify({ csvContent: csvText }),
        }
      );
      setCsvPreview(res);
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'CSV Validation Error',
        description: err.message,
      });
    }
  };

  const handleUpdatePreviewRowCategory = (rowNumber: number, newCategoryId: string) => {
    if (!csvPreview) return;
    const cat = categories.find((c) => c.id === newCategoryId);
    setCsvPreview({
      ...csvPreview,
      rows: csvPreview.rows.map((r) =>
        r.rowNumber === rowNumber
          ? {
              ...r,
              suggestedCategoryId: newCategoryId,
              suggestedCategoryName: cat?.name || r.suggestedCategoryName,
            }
          : r
      ),
    });
  };

  const handleConfirmCSVImport = async () => {
    if (!csvPreview) return;
    const validNonDuplicateRows = csvPreview.rows
      .filter((r) => r.isValid && !r.isDuplicate)
      .map((r) => ({
        date: r.date,
        description: r.description,
        amount: r.amount,
        type: r.type,
        categoryId: r.suggestedCategoryId,
        paymentMethod: r.paymentMethod,
        notes: r.notes,
      }));

    if (validNonDuplicateRows.length === 0) {
      notify({
        type: 'error',
        title: 'No valid non-duplicate rows to import',
      });
      return;
    }

    setImportingCsv(true);
    try {
      const res = await apiRequest<{ importedCount: number; skippedCount: number }>(
        '/transactions/import/confirm',
        {
          method: 'POST',
          body: JSON.stringify({
            accountId: csvAccountId || accounts[0]?.id,
            rows: validNonDuplicateRows,
          }),
        }
      );
      setImportSummary({
        importedCount: res.importedCount,
        skippedCount:
          res.skippedCount + csvPreview.invalidCount + csvPreview.duplicateCount,
      });
      setCsvPreview(null);
      setCsvText('');
      await loadTransactions();
      await loadMetadata();
      notify({
        type: 'success',
        title: `Imported ${res.importedCount} transactions`,
      });
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Import failed',
        description: err.message,
      });
    } finally {
      setImportingCsv(false);
    }
  };

  const filteredModalCategories = categories.filter((c) => c.type === txForm.type);

  return (
    <div className="space-y-6">
      {/* Header & Interactive View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Transactions & Cash Flow Ledger
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Search, filter, categorize, manage recurring bills, or import CSV bank statements
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Interactive Segmented Control */}
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            <button
              type="button"
              onClick={() => setSubTab('ledger')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                subTab === 'ledger'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Transactions
            </button>
            <button
              type="button"
              onClick={() => setSubTab('recurring')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                subTab === 'recurring'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Recurring ({recurringList.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('import')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                subTab === 'import'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Import CSV
            </button>
          </div>

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
            <span>Export CSV</span>
          </Button>

          <Button variant="primary" size="sm" onClick={openAddTxModal}>
            <Plus className="h-3.5 w-3.5" />
            <span>Add Transaction</span>
          </Button>
        </div>
      </div>

      {/* TAB 1: LEDGER */}
      {subTab === 'ledger' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <Card className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <div className="lg:col-span-2 relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <Input
                  type="text"
                  placeholder="Search merchant, notes, or UPI..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9"
                />
              </div>

              <div>
                <Select
                  aria-label="Filter by type"
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value as any);
                    setPage(1);
                  }}
                >
                  <option value="ALL">All Types (Income & Expense)</option>
                  <option value="EXPENSE">Expenses Only</option>
                  <option value="INCOME">Income Only</option>
                </Select>
              </div>

              <div>
                <Select
                  aria-label="Filter by category"
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="ALL">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Input
                  type="date"
                  aria-label="Start Date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <div>
                <Select
                  aria-label="Sort transactions"
                  value={`${sortBy}:${sortOrder}`}
                  onChange={(e) => {
                    const [sb, so] = e.target.value.split(':') as [any, any];
                    setSortBy(sb);
                    setSortOrder(so);
                    setPage(1);
                  }}
                >
                  <option value="date:desc">Date: Newest First</option>
                  <option value="date:asc">Date: Oldest First</option>
                  <option value="amount:desc">Amount: Highest First</option>
                  <option value="amount:asc">Amount: Lowest First</option>
                  <option value="description:asc">Description: A–Z</option>
                </Select>
              </div>
            </div>

            {/* Filtered Summary Bar */}
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>
                  Showing <strong className="font-mono tabular-nums">{pagination.totalCount}</strong> matching records
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Filtered Income:{' '}
                  <strong className="font-mono tabular-nums text-emerald-700">
                    {formatCurrency(totals.income, cur)}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Filtered Expenses:{' '}
                  <strong className="font-mono tabular-nums text-slate-900">
                    {formatCurrency(totals.expense, cur)}
                  </strong>
                </span>
              </div>
              {(search || categoryFilter !== 'ALL' || typeFilter !== 'ALL' || startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setCategoryFilter('ALL');
                    setTypeFilter('ALL');
                    setStartDate('');
                    setEndDate('');
                    setPage(1);
                  }}
                  className="text-xs font-medium text-emerald-700 hover:underline cursor-pointer"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </Card>

          {error && <ErrorBanner message={error} onRetry={loadTransactions} />}

          {/* Transactions Table */}
          <Card className="overflow-hidden">
            {loading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="No matching transactions found"
                  description="Try adjusting your filters or record a new income or expense transaction."
                  actionLabel="Add Transaction"
                  onAction={openAddTxModal}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                      <th className="py-3 px-5">Date</th>
                      <th className="py-3 px-4">Description & Notes</th>
                      <th className="py-3 px-4">Category · Payment</th>
                      <th className="py-3 px-4">Account</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-5 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                          {tx.date}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-900">{tx.description}</p>
                          {tx.notes && (
                            <p className="text-[11px] text-slate-400 mt-0.5">{tx.notes}</p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          <span className="font-medium text-slate-800">{tx.categoryName}</span>
                          <span className="mx-1.5 text-slate-300" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-slate-500">{tx.paymentMethod}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {tx.accountName}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                            tx.type === 'INCOME' ? 'text-emerald-700' : 'text-slate-900'
                          }`}
                        >
                          {tx.type === 'INCOME' ? '+' : '-'}
                          {formatCurrency(tx.amount, cur)}
                        </td>
                        <td className="py-3 px-5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditTxModal(tx)}
                              aria-label={`Edit ${tx.description}`}
                              className="p-1.5 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTransaction(tx.id)}
                              aria-label={`Delete ${tx.description}`}
                              className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Footer */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-xs text-slate-600">
                <span className="font-mono tabular-nums">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>Previous</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <span>Next</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 2: RECURRING EXPENSES */}
      {subTab === 'recurring' && (
        <Card className="p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Recurring Bills, Subscriptions & SIPs
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Track fixed monthly, quarterly, or annual financial commitments
              </p>
            </div>
            <Button size="sm" onClick={openAddRecurringModal}>
              <Plus className="h-3.5 w-3.5" />
              <span>Add Recurring Expense</span>
            </Button>
          </div>

          {recurringList.length === 0 ? (
            <EmptyState
              title="No recurring expenses configured"
              description="Add rent, broadband, streaming subscriptions, or SIPs to monitor fixed monthly commitments."
              actionLabel="Add Recurring Item"
              onAction={openAddRecurringModal}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Category · Frequency</th>
                    <th className="py-3 px-4">Next Due Date</th>
                    <th className="py-3 px-4 text-right">Billing Amount</th>
                    <th className="py-3 px-4 text-right">Monthly Equivalent</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {recurringList.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-medium text-slate-900 flex items-center gap-2">
                        <Repeat className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{r.description}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <span>{r.categoryName}</span>
                        <span className="mx-1.5 text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-slate-500">{r.frequency}</span>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-600">
                        {r.nextDate}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatCurrency(r.amount, cur)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                        {formatCurrency(r.monthlyEquivalent, cur)}/mo
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRec(r);
                              setRecForm({
                                description: r.description,
                                amount: String(r.amount),
                                categoryId: r.categoryId,
                                frequency: r.frequency,
                                nextDate: r.nextDate,
                                active: r.active,
                              });
                              setRecModalOpen(true);
                            }}
                            className="p-1.5 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRecurring(r.id)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 3: CSV IMPORT WIZARD */}
      {subTab === 'import' && (
        <Card className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                CSV Statement Import Wizard
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload a CSV file or paste statement rows to validate columns, map categories, and detect duplicates before importing
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCsvText(SAMPLE_CSV_TEMPLATE);
                setCsvPreview(null);
                setImportSummary(null);
              }}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Load Sample CSV</span>
            </Button>
          </div>

          {importSummary && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <div className="text-xs text-emerald-950">
                  <p className="font-semibold">CSV Import Complete</p>
                  <p className="mt-0.5">
                    Successfully stored{' '}
                    <strong className="font-mono tabular-nums">
                      {importSummary.importedCount}
                    </strong>{' '}
                    valid transactions ({importSummary.skippedCount} duplicate or invalid rows skipped).
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSubTab('ledger')}
              >
                View in Ledger
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  1. Target Account for Imported Records
                </label>
                <Select
                  value={csvAccountId}
                  onChange={(e) => setCsvAccountId(e.target.value)}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatCurrency(a.balance, cur)})
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  2. Upload CSV File
                </label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3.5 file:py-2 file:text-xs file:font-medium file:text-white hover:file:bg-slate-800 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Or Paste CSV Content (Required columns: Date, Description, Amount)
                </label>
                <textarea
                  rows={6}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="Date,Description,Amount,Type,Category,PaymentMethod&#10;2026-10-05,Swiggy Order,640,EXPENSE,Food & Dining,UPI"
                  className="w-full rounded-lg border border-slate-200 p-3 text-xs font-mono text-slate-800 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <Button
                variant="primary"
                onClick={handlePreviewCSV}
                disabled={!csvText.trim()}
                className="w-full"
              >
                <Upload className="h-4 w-4" />
                <span>Validate & Preview CSV</span>
              </Button>
            </div>

            <div className="lg:col-span-7">
              {!csvPreview ? (
                <div className="h-full flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                  <FileSpreadsheet className="h-8 w-8 text-slate-400" />
                  <p className="mt-2 text-sm font-medium text-slate-800">
                    Validation & Category Mapping Preview
                  </p>
                  <p className="mt-1 text-xs text-slate-500 max-w-sm">
                    Upload a CSV or click “Load Sample CSV” and press Validate to inspect detected columns, map categories, and check for duplicates.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-100 px-4 py-3 text-xs">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>
                        Ready to Import:{' '}
                        <strong className="font-mono tabular-nums text-emerald-700">
                          {csvPreview.validCount}
                        </strong>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        Duplicates Flagged:{' '}
                        <strong className="font-mono tabular-nums text-amber-700">
                          {csvPreview.duplicateCount}
                        </strong>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        Invalid Rows:{' '}
                        <strong className="font-mono tabular-nums text-red-600">
                          {csvPreview.invalidCount}
                        </strong>
                      </span>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={csvPreview.validCount === 0 || importingCsv}
                      onClick={handleConfirmCSVImport}
                    >
                      {importingCsv
                        ? 'Importing...'
                        : `Confirm Import (${csvPreview.validCount})`}
                    </Button>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-80">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Description</th>
                          <th className="py-2.5 px-3 text-right">Amount</th>
                          <th className="py-2.5 px-3">Mapped Category</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {csvPreview.rows.map((r) => (
                          <tr key={r.rowNumber}>
                            <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap">
                              {r.date}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-900">
                              {r.description || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                              {formatCurrency(r.amount, cur)}
                            </td>
                            <td className="py-2.5 px-3">
                              <Select
                                value={r.suggestedCategoryId}
                                onChange={(e) =>
                                  handleUpdatePreviewRowCategory(
                                    r.rowNumber,
                                    e.target.value
                                  )
                                }
                                className="py-1 px-2 text-xs"
                              >
                                {categories
                                  .filter((c) => c.type === r.type)
                                  .map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                              </Select>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {!r.isValid ? (
                                <span className="text-red-600 font-medium flex items-center gap-1">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  {r.errors[0]}
                                </span>
                              ) : r.isDuplicate ? (
                                <span className="text-amber-700 font-medium">
                                  Duplicate (Skipped)
                                </span>
                              ) : (
                                <span className="text-emerald-700 font-medium">
                                  Valid
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ADD / EDIT TRANSACTION MODAL */}
      <Modal
        open={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        title={editingTx ? 'Edit Transaction' : 'Add New Transaction'}
        description="All amounts update your account balance and monthly analytics immediately."
      >
        <form onSubmit={handleSaveTransaction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Transaction Type
              </label>
              <Select
                value={txForm.type}
                onChange={(e) => {
                  const newType = e.target.value as TransactionType;
                  const matchingCats = categories.filter((c) => c.type === newType);
                  setTxForm({
                    ...txForm,
                    type: newType,
                    categoryId: matchingCats[0]?.id || '',
                  });
                }}
              >
                <option value="EXPENSE">Expense</option>
                <option value="INCOME">Income</option>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Amount ({cur})
              </label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="1250.00"
                value={txForm.amount}
                onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                className="font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Description / Merchant
            </label>
            <Input
              type="text"
              required
              placeholder="e.g., Swiggy Instamart Groceries"
              value={txForm.description}
              onChange={(e) => setTxForm({ ...txForm, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Category
              </label>
              <Select
                value={txForm.categoryId}
                onChange={(e) => setTxForm({ ...txForm, categoryId: e.target.value })}
                required
              >
                {filteredModalCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Account
              </label>
              <Select
                value={txForm.accountId}
                onChange={(e) => setTxForm({ ...txForm, accountId: e.target.value })}
                required
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Date
              </label>
              <Input
                type="date"
                required
                value={txForm.date}
                onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Payment Method
              </label>
              <Select
                value={txForm.paymentMethod}
                onChange={(e) => setTxForm({ ...txForm, paymentMethod: e.target.value })}
              >
                <option value="UPI">UPI</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Debit Card">Debit Card</option>
                <option value="NEFT">NEFT / IMPS</option>
                <option value="Auto-Debit">Auto-Debit / NACH</option>
                <option value="Cash">Cash</option>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Notes (Optional)
            </label>
            <Input
              type="text"
              placeholder="Add context or receipt reference"
              value={txForm.notes}
              onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTxModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={savingTx}>
              {savingTx
                ? 'Saving...'
                : editingTx
                ? 'Update Transaction'
                : 'Save Transaction'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ADD / EDIT RECURRING MODAL */}
      <Modal
        open={recModalOpen}
        onClose={() => setRecModalOpen(false)}
        title={editingRec ? 'Edit Recurring Commitment' : 'Add Recurring Commitment'}
        description="Track fixed monthly bills, subscriptions, or automated investment SIPs."
      >
        <form onSubmit={handleSaveRecurring} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Description
            </label>
            <Input
              type="text"
              required
              placeholder="e.g., Airtel Fiber Broadband"
              value={recForm.description}
              onChange={(e) => setRecForm({ ...recForm, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Amount ({cur})
              </label>
              <Input
                type="number"
                step="0.01"
                min="1"
                required
                value={recForm.amount}
                onChange={(e) => setRecForm({ ...recForm, amount: e.target.value })}
                className="font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Frequency
              </label>
              <Select
                value={recForm.frequency}
                onChange={(e) =>
                  setRecForm({ ...recForm, frequency: e.target.value as FrequencyType })
                }
              >
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="YEARLY">Yearly</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Category
              </label>
              <Select
                value={recForm.categoryId}
                onChange={(e) => setRecForm({ ...recForm, categoryId: e.target.value })}
                required
              >
                {categories
                  .filter((c) => c.type === 'EXPENSE')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Next Billing Date
              </label>
              <Input
                type="date"
                required
                value={recForm.nextDate}
                onChange={(e) => setRecForm({ ...recForm, nextDate: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRecModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {editingRec ? 'Update Recurring' : 'Save Recurring'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
