import express from 'express';
import {
  verifyPassword,
  signAuthToken,
  requireAuth,
  createRateLimiter,
  type AuthenticatedRequest,
} from './auth.ts';
import type { PocketSmartDB } from './db.ts';
import {
  buildDashboardSummary,
  calculateBudgetsForMonth,
  calculateGoals,
  generateDeterministicInsights,
  previewCSVImport,
} from './financeEngine.ts';
import { askFinancialAssistant } from './aiService.ts';
import {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  transactionSchema,
  budgetSchema,
  goalSchema,
  recurringSchema,
  categorySchema,
  accountSchema,
  profileUpdateSchema,
  passwordChangeSchema,
  aiQuestionSchema,
} from '../shared/validation.ts';
import { getCurrentYearMonth } from '../shared/format.ts';

export function createApiRouter(database: PocketSmartDB) {
  const router = express.Router();

  const authRateLimiter = createRateLimiter(30, 60 * 1000);
  const aiRateLimiter = createRateLimiter(30, 60 * 1000);

  // ==================== AUTHENTICATION ====================
  router.post('/auth/signup', authRateLimiter, (req, res) => {
    try {
      const parsed = signupSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Invalid registration details',
        });
      }
      const user = database.createUser(parsed.data);
      const token = signAuthToken(user.id, user.email);
      return res.status(201).json({ user, token });
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Unable to sign up' });
    }
  });

  router.post('/auth/login', authRateLimiter, (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Invalid login input',
        });
      }
      const storedUser = database.findUserByEmail(parsed.data.email);
      if (!storedUser || !verifyPassword(parsed.data.password, storedUser.passwordHash)) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      const user = database.stripSensitiveUser(storedUser);
      const token = signAuthToken(user.id, user.email);
      return res.json({ user, token });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Login failed' });
    }
  });

  router.post('/auth/demo', authRateLimiter, (_req, res) => {
    try {
      const demoUser = database.findUserByEmail('demo@pocketsmart.ai');
      if (!demoUser) {
        return res.status(404).json({ error: 'Demo user not found' });
      }
      const user = database.stripSensitiveUser(demoUser);
      const token = signAuthToken(user.id, user.email);
      return res.json({ user, token });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Demo login failed' });
    }
  });

  router.post('/auth/logout', (_req, res) => {
    return res.json({ success: true });
  });

  router.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.userId;
    const stored = database.findUserById(userId);
    if (!stored) {
      return res.status(401).json({ error: 'User no longer exists' });
    }
    return res.json({ user: database.stripSensitiveUser(stored) });
  });

  router.post('/auth/forgot-password', authRateLimiter, (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid email' });
    }
    const code = database.createPasswordResetCode(parsed.data.email);
    // Return reset code in demo preview mode so the user can test the complete flow
    return res.json({
      message: 'If an account matches that email, a 6-digit reset code has been generated.',
      previewResetCode: code,
    });
  });

  router.post('/auth/reset-password', authRateLimiter, (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
    }
    const ok = database.resetPasswordWithCode(
      parsed.data.email,
      parsed.data.resetCode,
      parsed.data.newPassword
    );
    if (!ok) {
      return res.status(400).json({ error: 'Invalid or expired reset code.' });
    }
    return res.json({ success: true, message: 'Password has been reset successfully.' });
  });

  // ==================== DASHBOARD & ANALYTICS ====================
  router.get('/dashboard', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.userId;
      const month = typeof req.query.month === 'string' ? req.query.month : undefined;
      const summary = buildDashboardSummary(database, userId, month);
      return res.json(summary);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to load dashboard' });
    }
  });

  router.get('/analytics', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.userId;
      const month = typeof req.query.month === 'string' ? req.query.month : undefined;
      const summary = buildDashboardSummary(database, userId, month);
      const recurring = database.getRecurringTransactions(userId);
      return res.json({
        ...summary,
        recurring,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to load analytics' });
    }
  });

  // ==================== ACCOUNTS ====================
  router.get('/accounts', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.userId;
    return res.json({ accounts: database.getAccounts(userId) });
  });

  router.post('/accounts', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.userId;
      const parsed = accountSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message });
      }
      const account = database.createAccount(userId, parsed.data);
      return res.status(201).json({ account });
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Failed to create account' });
    }
  });

  // ==================== CATEGORIES ====================
  router.get('/categories', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.userId;
    return res.json({ categories: database.getCategories(userId) });
  });

  router.post('/categories', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.userId;
      const parsed = categorySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message });
      }
      const category = database.createCategory(userId, parsed.data);
      return res.status(201).json({ category });
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Failed to create category' });
    }
  });

  router.delete('/categories/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.userId;
      database.deleteCategory(userId, req.params.id);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Failed to delete category' });
    }
  });

  // ==================== TRANSACTIONS ====================
  router.get('/transactions', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.userId;
      let list = database.getTransactions(userId);

      const {
        search,
        categoryId,
        type,
        startDate,
        endDate,
        month,
        sortBy = 'date',
        sortOrder = 'desc',
        page = '1',
        pageSize = '15',
      } = req.query as Record<string, string | undefined>;

      if (month && /^\d{4}-\d{2}$/.test(month)) {
        list = list.filter((t) => t.date.startsWith(month));
      }
      if (startDate) {
        list = list.filter((t) => t.date >= startDate);
      }
      if (endDate) {
        list = list.filter((t) => t.date <= endDate);
      }
      if (categoryId && categoryId !== 'ALL') {
        list = list.filter((t) => t.categoryId === categoryId);
      }
      if (type && (type === 'INCOME' || type === 'EXPENSE')) {
        list = list.filter((t) => t.type === type);
      }
      if (search && search.trim() !== '') {
        const q = search.trim().toLowerCase();
        list = list.filter(
          (t) =>
            t.description.toLowerCase().includes(q) ||
            (t.categoryName && t.categoryName.toLowerCase().includes(q)) ||
            (t.notes && t.notes.toLowerCase().includes(q)) ||
            t.paymentMethod.toLowerCase().includes(q)
        );
      }

      list.sort((a, b) => {
        const dir = sortOrder === 'asc' ? 1 : -1;
        if (sortBy === 'amount') {
          return (a.amount - b.amount) * dir;
        }
        if (sortBy === 'description') {
          return a.description.localeCompare(b.description) * dir;
        }
        return a.date.localeCompare(b.date) * dir;
      });

      const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(pageSize || '15', 10) || 15));
      const totalCount = list.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / limitNum));
      const paginated = list.slice((pageNum - 1) * limitNum, pageNum * limitNum);

      const totalFilteredIncome = Number(
        list
          .filter((t) => t.type === 'INCOME')
          .reduce((s, t) => s + t.amount, 0)
          .toFixed(2)
      );
      const totalFilteredExpense = Number(
        list
          .filter((t) => t.type === 'EXPENSE')
          .reduce((s, t) => s + t.amount, 0)
          .toFixed(2)
      );

      return res.json({
        transactions: paginated,
        pagination: {
          page: pageNum,
          pageSize: limitNum,
          totalCount,
          totalPages,
        },
        totals: {
          income: totalFilteredIncome,
          expense: totalFilteredExpense,
          net: Number((totalFilteredIncome - totalFilteredExpense).toFixed(2)),
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to fetch transactions' });
    }
  });

  router.post('/transactions', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.userId;
      const parsed = transactionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message });
      }
      const transaction = database.createTransaction(userId, parsed.data);
      return res.status(201).json({ transaction });
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Failed to add transaction' });
    }
  });

  router.put('/transactions/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.userId;
      const parsed = transactionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message });
      }
      const transaction = database.updateTransaction(userId, req.params.id, parsed.data);
      return res.json({ transaction });
    } catch (err: any) {
      const status = err.message?.includes('unauthorized') ? 404 : 400;
      return res.status(status).json({ error: err.message || 'Failed to update transaction' });
    }
  });

  router.delete('/transactions/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.userId;
      database.deleteTransaction(userId, req.params.id);
      return res.json({ success: true });
    } catch (err: any) {
      const status = err.message?.includes('unauthorized') ? 404 : 400;
      return res.status(status).json({ error: err.message || 'Failed to delete transaction' });
    }
  });

  // ==================== CSV IMPORT & EXPORT ====================
  router.post('/transactions/import/preview', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.userId;
      const csvContent = typeof req.body.csvContent === 'string' ? req.body.csvContent : '';
      if (!csvContent.trim()) {
        return res.status(400).json({ error: 'CSV content cannot be empty.' });
      }
      const preview = previewCSVImport(database, userId, csvContent);
      return res.json(preview);
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Failed to validate CSV file' });
    }
  });

  router.post('/transactions/import/confirm', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.userId;
      const { accountId, rows } = req.body as {
        accountId?: string;
        rows?: Array<{
          date: string;
          description: string;
          amount: number;
          type: 'INCOME' | 'EXPENSE';
          categoryId: string;
          paymentMethod?: string;
          notes?: string;
        }>;
      };

      const userAccounts = database.getAccounts(userId);
      const targetAccountId = accountId || userAccounts[0]?.id;
      if (!targetAccountId) {
        return res.status(400).json({ error: 'No valid account found for importing transactions.' });
      }

      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'No valid rows provided for import.' });
      }

      const imported = [];
      const skipped = [];

      for (const row of rows) {
        const validated = transactionSchema.safeParse({
          accountId: targetAccountId,
          categoryId: row.categoryId,
          type: row.type,
          amount: row.amount,
          description: row.description,
          date: row.date,
          paymentMethod: row.paymentMethod || 'CSV Import',
          notes: row.notes || 'Imported via CSV',
        });

        if (!validated.success) {
          skipped.push({ row, reason: validated.error.issues[0]?.message || 'Validation failed' });
          continue;
        }

        const created = database.createTransaction(userId, validated.data);
        imported.push(created);
      }

      return res.status(201).json({
        importedCount: imported.length,
        skippedCount: skipped.length,
        transactions: imported,
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Failed to import transactions' });
    }
  });

  router.get('/transactions/export', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.userId;
    const txs = database.getTransactions(userId);
    const header = 'Date,Description,Category,Type,Amount,PaymentMethod,Account,Notes';
    const csvRows = txs.map((t) => {
      const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
      return [
        t.date,
        esc(t.description),
        esc(t.categoryName || ''),
        t.type,
        t.amount.toFixed(2),
        esc(t.paymentMethod),
        esc(t.accountName || ''),
        esc(t.notes || ''),
      ].join(',');
    });
    const csv = [header, ...csvRows].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="pocketsmart-transactions.csv"');
    return res.send(csv);
  });

  // ==================== BUDGETS ====================
  router.get('/budgets', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.userId;
      const monthParam = typeof req.query.month === 'string' ? req.query.month : getCurrentYearMonth();
      const budgets = calculateBudgetsForMonth(database, userId, monthParam);
      return res.json({ month: monthParam, budgets });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to load budgets' });
    }
  });

  router.post('/budgets', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.userId;
      const parsed = budgetSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message });
      }
      database.upsertBudget(userId, parsed.data);
      const ym = `${parsed.data.year}-${String(parsed.data.month).padStart(2, '0')}`;
      const budgets = calculateBudgetsForMonth(database, userId, ym);
      return res.status(201).json({ budgets });
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Failed to save budget' });
    }
  });

  router.put('/budgets/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.userId;
      const amount = Number(req.body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Budget limit must be greater than zero' });
      }
      const updated = database.updateBudgetById(userId, req.params.id, amount);
      const ym = `${updated.year}-${String(updated.month).padStart(2, '0')}`;
      const budgets = calculateBudgetsForMonth(database, userId, ym);
      return res.json({ budgets });
    } catch (err: any) {
      const status = err.message?.includes('unauthorized') ? 404 : 400;
      return res.status(status).json({ error: err.message || 'Failed to update budget' });
    }
  });

  router.delete('/budgets/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.userId;
      database.deleteBudget(userId, req.params.id);
      return res.json({ success: true });
    } catch (err: any) {
      const status = err.message?.includes('unauthorized') ? 404 : 400;
      return res.status(status).json({ error: err.message || 'Failed to delete budget' });
    }
  });

  // ==================== GOALS ====================
  router.get('/goals', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.userId;
      const summary = buildDashboardSummary(database, userId);
      const goals = calculateGoals(database, userId, summary.netSavings, summary.currency);
      return res.json({ goals });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to load goals' });
    }
  });

  router.post('/goals', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.userId;
      const parsed = goalSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message });
      }
      database.createGoal(userId, parsed.data);
      const summary = buildDashboardSummary(database, userId);
      return res.status(201).json({
        goals: calculateGoals(database, userId, summary.netSavings, summary.currency),
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Failed to create goal' });
    }
  });

  router.put('/goals/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.userId;
      const parsed = goalSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message });
      }
      database.updateGoal(userId, req.params.id, parsed.data);
      const summary = buildDashboardSummary(database, userId);
      return res.json({
        goals: calculateGoals(database, userId, summary.netSavings, summary.currency),
      });
    } catch (err: any) {
      const status = err.message?.includes('unauthorized') ? 404 : 400;
      return res.status(status).json({ error: err.message || 'Failed to update goal' });
    }
  });

  router.delete('/goals/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.userId;
      database.deleteGoal(userId, req.params.id);
      return res.json({ success: true });
    } catch (err: any) {
      const status = err.message?.includes('unauthorized') ? 404 : 400;
      return res.status(status).json({ error: err.message || 'Failed to delete goal' });
    }
  });

  // ==================== RECURRING TRANSACTIONS ====================
  router.get('/recurring', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.userId;
    return res.json({ recurring: database.getRecurringTransactions(userId) });
  });

  router.post('/recurring', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.userId;
      const parsed = recurringSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message });
      }
      database.createRecurring(userId, parsed.data);
      return res.status(201).json({ recurring: database.getRecurringTransactions(userId) });
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Failed to create recurring expense' });
    }
  });

  router.put('/recurring/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.userId;
      const parsed = recurringSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message });
      }
      database.updateRecurring(userId, req.params.id, parsed.data);
      return res.json({ recurring: database.getRecurringTransactions(userId) });
    } catch (err: any) {
      const status = err.message?.includes('unauthorized') ? 404 : 400;
      return res.status(status).json({ error: err.message || 'Failed to update recurring expense' });
    }
  });

  router.delete('/recurring/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.userId;
      database.deleteRecurring(userId, req.params.id);
      return res.json({ success: true });
    } catch (err: any) {
      const status = err.message?.includes('unauthorized') ? 404 : 400;
      return res.status(status).json({ error: err.message || 'Failed to delete recurring expense' });
    }
  });

  // ==================== AI INSIGHTS & AI ASSISTANT ====================
  router.get('/insights', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.userId;
    const month = typeof req.query.month === 'string' ? req.query.month : getCurrentYearMonth();
    const insights = generateDeterministicInsights(database, userId, month);
    return res.json({ insights });
  });

  router.post('/insights/generate', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.userId;
    const month = typeof req.body?.month === 'string' ? req.body.month : getCurrentYearMonth();
    const insights = generateDeterministicInsights(database, userId, month);
    return res.json({ insights });
  });

  router.patch('/insights/:id/read', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.userId;
      const insight = database.markInsightRead(userId, req.params.id);
      return res.json({ insight });
    } catch (err: any) {
      return res.status(404).json({ error: err.message || 'Insight not found' });
    }
  });

  router.post('/ai/chat', requireAuth, aiRateLimiter, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.userId;
      const parsed = aiQuestionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message });
      }
      const response = await askFinancialAssistant(
        database,
        userId,
        parsed.data.question,
        parsed.data.month
      );
      return res.json(response);
    } catch (err: any) {
      return res.status(500).json({
        error: err.message || 'Failed to generate AI financial response',
      });
    }
  });

  // ==================== SETTINGS & PROFILE ====================
  router.put('/users/profile', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.userId;
      const parsed = profileUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message });
      }
      const user = database.updateUserProfile(userId, parsed.data);
      return res.json({ user });
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Failed to update profile' });
    }
  });

  router.put('/users/password', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.userId;
      const parsed = passwordChangeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message });
      }
      database.updateUserPassword(
        userId,
        parsed.data.currentPassword,
        parsed.data.newPassword
      );
      return res.json({ success: true, message: 'Password updated successfully.' });
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Failed to change password' });
    }
  });

  router.get('/users/export', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.userId;
    const storedUser = database.findUserById(userId);
    if (!storedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    const payload = {
      exportedAt: new Date().toISOString(),
      profile: database.stripSensitiveUser(storedUser),
      accounts: database.getAccounts(userId),
      categories: database.getCategories(userId),
      transactions: database.getTransactions(userId),
      budgets: database.getStoredBudgets(userId),
      goals: database.getStoredGoals(userId),
      recurringTransactions: database.getRecurringTransactions(userId),
    };
    return res.json(payload);
  });

  router.delete('/users/account', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.userId;
      database.deleteUserAccount(userId);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to delete account' });
    }
  });

  return router;
}
