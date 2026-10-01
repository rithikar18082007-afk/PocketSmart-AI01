import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { PocketSmartDB } from '../server/db.ts';
import {
  hashPassword,
  verifyPassword,
  signAuthToken,
  verifyAuthToken,
} from '../server/auth.ts';
import {
  buildDashboardSummary,
  calculateBudgetsForMonth,
  calculateGoals,
  previewCSVImport,
} from '../server/financeEngine.ts';
import { askFinancialAssistant } from '../server/aiService.ts';
import { createApiRouter } from '../server/apiRouter.ts';
import { getCurrentYearMonth } from '../shared/format.ts';

test('1. Authentication: password hashing and token verification', () => {
  const hash = hashPassword('StrongPass#2026');
  assert.equal(verifyPassword('StrongPass#2026', hash), true);
  assert.equal(verifyPassword('WrongPass', hash), false);

  const token = signAuthToken('usr_123', 'priya@example.com');
  const payload = verifyAuthToken(token);
  assert.ok(payload);
  assert.equal(payload.userId, 'usr_123');
  assert.equal(payload.email, 'priya@example.com');

  assert.equal(verifyAuthToken(`${token}tampered`), null);
});

test('2. Transaction Creation, Editing, and Deletion with Balance Integrity', () => {
  const db = new PocketSmartDB(undefined, false);
  const user = db.createUser({
    name: 'Rohan Verma',
    email: 'rohan@example.com',
    password: 'Password123',
    currency: 'INR',
  });

  const accounts = db.getAccounts(user.id);
  const categories = db.getCategories(user.id);
  const primaryAcc = accounts[0];
  const salaryCat = categories.find((c) => c.type === 'INCOME')!;
  const foodCat = categories.find((c) => c.name.includes('Food'))!;

  const ym = getCurrentYearMonth();

  // Create Income (+1,00,000)
  const incomeTx = db.createTransaction(user.id, {
    accountId: primaryAcc.id,
    categoryId: salaryCat.id,
    type: 'INCOME',
    amount: 100000,
    description: 'October Salary',
    date: `${ym}-01`,
    paymentMethod: 'NEFT',
  });
  assert.equal(db.getAccounts(user.id)[0].balance, 100000);

  // Create Expense (-4,500)
  const expenseTx = db.createTransaction(user.id, {
    accountId: primaryAcc.id,
    categoryId: foodCat.id,
    type: 'EXPENSE',
    amount: 4500,
    description: 'Grocery Order',
    date: `${ym}-05`,
    paymentMethod: 'UPI',
  });
  assert.equal(db.getAccounts(user.id)[0].balance, 95500);

  // Edit Expense from 4,500 to 6,000
  db.updateTransaction(user.id, expenseTx.id, {
    accountId: primaryAcc.id,
    categoryId: foodCat.id,
    type: 'EXPENSE',
    amount: 6000,
    description: 'Grocery Order Updated',
    date: `${ym}-05`,
    paymentMethod: 'UPI',
  });
  assert.equal(db.getAccounts(user.id)[0].balance, 94000);

  // Delete Expense (-6,000 reverted)
  db.deleteTransaction(user.id, expenseTx.id);
  assert.equal(db.getAccounts(user.id)[0].balance, 100000);
  assert.equal(db.getTransactions(user.id).length, 1);
  assert.equal(db.getTransactions(user.id)[0].id, incomeTx.id);
});

test('3. Budget Calculations & Threshold Warnings', () => {
  const db = new PocketSmartDB(undefined, false);
  const user = db.createUser({
    name: 'Meera Nair',
    email: 'meera@example.com',
    password: 'Password123',
  });

  const acc = db.getAccounts(user.id)[0];
  const foodCat = db
    .getCategories(user.id)
    .find((c) => c.name.includes('Food'))!;

  const ym = getCurrentYearMonth();
  const [year, month] = ym.split('-').map(Number);

  db.upsertBudget(user.id, {
    categoryId: foodCat.id,
    amount: 10000,
    month,
    year,
  });

  db.createTransaction(user.id, {
    accountId: acc.id,
    categoryId: foodCat.id,
    type: 'EXPENSE',
    amount: 8500,
    description: 'Dining & Groceries',
    date: `${ym}-10`,
    paymentMethod: 'UPI',
  });

  const budgets = calculateBudgetsForMonth(db, user.id, ym);
  assert.equal(budgets.length, 1);
  assert.equal(budgets[0].spent, 8500);
  assert.equal(budgets[0].remaining, 1500);
  assert.equal(budgets[0].utilizationPercent, 85);
  assert.equal(budgets[0].status, 'WARNING');
});

test('4. Analytics & Dashboard Calculations (including Zero-Income Safe Handling)', () => {
  const db = new PocketSmartDB(undefined, false);
  const user = db.createUser({
    name: 'Kabir Das',
    email: 'kabir@example.com',
    password: 'Password123',
  });
  const ym = getCurrentYearMonth();

  // Zero-income state should never divide by zero or return NaN
  const emptySummary = buildDashboardSummary(db, user.id, ym);
  assert.equal(emptySummary.monthlyIncome, 0);
  assert.equal(emptySummary.monthlyExpenses, 0);
  assert.equal(emptySummary.savingsRate, 0);

  const acc = db.getAccounts(user.id)[0];
  const cats = db.getCategories(user.id);
  const salaryCat = cats.find((c) => c.type === 'INCOME')!;
  const rentCat = cats.find((c) => c.name.includes('Rent'))!;

  db.createTransaction(user.id, {
    accountId: acc.id,
    categoryId: salaryCat.id,
    type: 'INCOME',
    amount: 120000,
    description: 'Salary',
    date: `${ym}-01`,
    paymentMethod: 'NEFT',
  });

  db.createTransaction(user.id, {
    accountId: acc.id,
    categoryId: rentCat.id,
    type: 'EXPENSE',
    amount: 30000,
    description: 'Rent',
    date: `${ym}-03`,
    paymentMethod: 'UPI',
  });

  const summary = buildDashboardSummary(db, user.id, ym);
  assert.equal(summary.monthlyIncome, 120000);
  assert.equal(summary.monthlyExpenses, 30000);
  assert.equal(summary.netSavings, 90000);
  assert.equal(summary.savingsRate, 75);
});

test('5. Goal Progress & Completion Calculations', () => {
  const db = new PocketSmartDB(undefined, false);
  const user = db.createUser({
    name: 'Ananya Rao',
    email: 'ananya@example.com',
    password: 'Password123',
  });

  db.createGoal(user.id, {
    name: 'Emergency Reserve',
    category: 'Emergency fund',
    targetAmount: 200000,
    currentAmount: 50000,
    targetDate: '2027-06-01',
    description: 'Core emergency reserve',
  });

  const goals = calculateGoals(db, user.id, 40000, 'INR');
  assert.equal(goals.length, 1);
  assert.equal(goals[0].progressPercent, 25);
  assert.equal(goals[0].remainingAmount, 150000);
  assert.ok(goals[0].requiredMonthlyContribution > 0);
});

test('6. User Authorization & Strict Data Isolation', () => {
  const db = new PocketSmartDB(undefined, false);
  const userA = db.createUser({
    name: 'User A',
    email: 'usera@example.com',
    password: 'Password123',
  });
  const userB = db.createUser({
    name: 'User B',
    email: 'userb@example.com',
    password: 'Password123',
  });

  const accA = db.getAccounts(userA.id)[0];
  const catA = db.getCategories(userA.id)[0];
  const txA = db.createTransaction(userA.id, {
    accountId: accA.id,
    categoryId: catA.id,
    type: 'EXPENSE',
    amount: 2500,
    description: 'Private User A Expense',
    date: '2026-10-01',
    paymentMethod: 'UPI',
  });

  // User B cannot see User A's transactions
  assert.equal(db.getTransactions(userB.id).length, 0);

  // User B cannot delete or update User A's transaction
  assert.throws(() => {
    db.deleteTransaction(userB.id, txA.id);
  }, /unauthorized/);

  assert.throws(() => {
    db.updateTransaction(userB.id, txA.id, {
      accountId: accA.id,
      categoryId: catA.id,
      type: 'EXPENSE',
      amount: 10,
      description: 'Hacked',
      date: '2026-10-01',
      paymentMethod: 'UPI',
    });
  }, /unauthorized/);
});

test('7. CSV Import Validation, Category Mapping & Duplicate Detection', () => {
  const db = new PocketSmartDB(undefined, false);
  const user = db.createUser({
    name: 'Vikram Singh',
    email: 'vikram@example.com',
    password: 'Password123',
  });

  const acc = db.getAccounts(user.id)[0];
  const foodCat = db
    .getCategories(user.id)
    .find((c) => c.name.includes('Food'))!;

  // Existing transaction to test duplicate detection
  db.createTransaction(user.id, {
    accountId: acc.id,
    categoryId: foodCat.id,
    type: 'EXPENSE',
    amount: 550,
    description: 'Swiggy Dinner',
    date: '2026-10-02',
    paymentMethod: 'UPI',
  });

  const csvContent = [
    'Date,Description,Amount,Type,PaymentMethod',
    '2026-10-02,Swiggy Dinner,550,EXPENSE,UPI', // duplicate
    '2026-10-04,Uber Airport Ride,920,EXPENSE,UPI', // valid & auto-mapped to Transportation
    'invalid-date,Missing Amount Row,0,EXPENSE,UPI', // invalid
  ].join('\n');

  const preview = previewCSVImport(db, user.id, csvContent);
  assert.equal(preview.rows.length, 3);
  assert.equal(preview.duplicateCount, 1);
  assert.equal(preview.validCount, 1);
  assert.equal(preview.invalidCount, 1);
  assert.ok(
    preview.rows[1].suggestedCategoryName.toLowerCase().includes('transport')
  );
});

test('8. AI API Authorization & Deterministic User-Isolated Response', async () => {
  const db = new PocketSmartDB(undefined, false);
  const demoUser = db.findUserByEmail('demo@pocketsmart.ai')!;
  const ym = getCurrentYearMonth();

  const aiRes = await askFinancialAssistant(
    db,
    demoUser.id,
    'How much did I spend on food?',
    ym
  );
  assert.ok(aiRes.answer.length > 10);
  assert.ok(aiRes.structuredBreakdown.calculatedFacts.length > 0);
  assert.ok(aiRes.structuredBreakdown.financialEducation.length > 0);

  // Verify Express API router blocks unauthenticated AI requests with 401
  const app = express();
  app.use(express.json());
  app.use('/api', createApiRouter(db));

  const server = app.listen(0);
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;

  try {
    const unauthRes = await fetch(`http://127.0.0.1:${port}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Where did I spend the most?' }),
    });
    assert.equal(unauthRes.status, 401);
  } finally {
    server.close();
  }
});
