import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { hashPassword, verifyPassword } from './auth.ts';
import type {
  User,
  Account,
  Category,
  Transaction,
  RecurringTransaction,
  AIInsight,
  TransactionType,
  AccountType,
  FrequencyType,
} from '../shared/types.ts';

export interface StoredUser extends User {
  passwordHash: string;
  resetCode?: string | null;
  resetCodeExpiresAt?: number | null;
}

export interface StoredBudget {
  id: string;
  userId: string;
  categoryId: string;
  amount: number;
  month: number;
  year: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoredGoal {
  id: string;
  userId: string;
  name: string;
  category: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredRecurring {
  id: string;
  userId: string;
  categoryId: string;
  description: string;
  amount: number;
  frequency: FrequencyType;
  nextDate: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DatabaseSchema {
  users: StoredUser[];
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: StoredBudget[];
  goals: StoredGoal[];
  recurringTransactions: StoredRecurring[];
  aiInsights: AIInsight[];
}

const DEFAULT_CATEGORIES: Array<{
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
}> = [
  { name: 'Food & Dining', type: 'EXPENSE', icon: 'utensils', color: '#0f172a' },
  { name: 'Rent & Housing', type: 'EXPENSE', icon: 'home', color: '#1e293b' },
  { name: 'Transportation', type: 'EXPENSE', icon: 'car', color: '#334155' },
  { name: 'Shopping', type: 'EXPENSE', icon: 'shopping-bag', color: '#047857' },
  { name: 'Bills & Utilities', type: 'EXPENSE', icon: 'zap', color: '#0369a1' },
  { name: 'Entertainment', type: 'EXPENSE', icon: 'film', color: '#4338ca' },
  { name: 'Healthcare', type: 'EXPENSE', icon: 'heart-pulse', color: '#b91c1c' },
  { name: 'Education', type: 'EXPENSE', icon: 'graduation-cap', color: '#0f766e' },
  { name: 'Investments', type: 'EXPENSE', icon: 'trending-up', color: '#059669' },
  { name: 'Other', type: 'EXPENSE', icon: 'more-horizontal', color: '#64748b' },
  { name: 'Salary', type: 'INCOME', icon: 'briefcase', color: '#059669' },
  { name: 'Freelance & Consulting', type: 'INCOME', icon: 'laptop', color: '#0d9488' },
  { name: 'Dividends & Interest', type: 'INCOME', icon: 'landmark', color: '#0284c7' },
];

export class PocketSmartDB {
  private filePath: string;
  private state: DatabaseSchema;
  private persistEnabled: boolean;

  constructor(customFilePath?: string, persistEnabled = true) {
    this.persistEnabled = persistEnabled;
    const dataDir = path.resolve(process.cwd(), '.data');
    if (this.persistEnabled && !fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.filePath = customFilePath || path.join(dataDir, 'pocketsmart-db.json');
    this.state = this.loadOrSeed();
  }

  private loadOrSeed(): DatabaseSchema {
    if (this.persistEnabled && fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw) as DatabaseSchema;
        if (parsed && Array.isArray(parsed.users) && parsed.users.length > 0) {
          return parsed;
        }
      } catch (err) {
        console.error('Error loading persisted DB, seeding fresh instance:', err);
      }
    }
    const seeded = this.createInitialSeed();
    this.save(seeded);
    return seeded;
  }

  private save(data: DatabaseSchema = this.state) {
    if (!this.persistEnabled) return;
    try {
      const tempPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      console.error('Failed to persist database state:', err);
    }
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private createInitialSeed(): DatabaseSchema {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12

    const demoUserId = 'usr_demo_aarav_sharma';
    const nowIso = now.toISOString();

    const demoUser: StoredUser = {
      id: demoUserId,
      name: 'Aarav Sharma (Demo)',
      email: 'demo@pocketsmart.ai',
      passwordHash: hashPassword('Demo@1234'),
      currency: 'INR',
      isDemo: true,
      notificationsEnabled: true,
      budgetAlertsThreshold: 80,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const categories: Category[] = DEFAULT_CATEGORIES.map((c, idx) => ({
      id: `cat_demo_${idx + 1}`,
      userId: demoUserId,
      name: c.name,
      type: c.type,
      icon: c.icon,
      color: c.color,
    }));

    const catByName = (name: string) =>
      categories.find((c) => c.name === name)?.id || categories[0].id;

    const accounts: Account[] = [
      {
        id: 'acc_demo_hdfc',
        userId: demoUserId,
        name: 'HDFC Salary Savings',
        type: 'SAVINGS',
        balance: 342500,
        currency: 'INR',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'acc_demo_icici',
        userId: demoUserId,
        name: 'ICICI Amazon Pay Credit Card',
        type: 'CREDIT_CARD',
        balance: -24850,
        currency: 'INR',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'acc_demo_zerodha',
        userId: demoUserId,
        name: 'Zerodha Mutual Fund Folio',
        type: 'INVESTMENT',
        balance: 585000,
        currency: 'INR',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];

    // Helper to format YYYY-MM-DD relative to current month
    const makeDate = (monthOffset: number, day: number): string => {
      const d = new Date(currentYear, currentMonth - 1 + monthOffset, day);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(Math.min(day, 28)).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };

    const transactions: Transaction[] = [];
    const addSeedTx = (
      monthOffset: number,
      day: number,
      type: TransactionType,
      amount: number,
      categoryName: string,
      description: string,
      paymentMethod: string,
      accountId = 'acc_demo_hdfc',
      notes = 'Demo seed record'
    ) => {
      transactions.push({
        id: this.generateId('txn'),
        userId: demoUserId,
        accountId,
        categoryId: catByName(categoryName),
        type,
        amount,
        description,
        date: makeDate(monthOffset, day),
        paymentMethod,
        notes,
        isDemo: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    };

    // Seed 6 months of realistic Indian personal finance history (-5 to 0)
    for (let offset = -5; offset <= 0; offset++) {
      // Monthly Salary
      addSeedTx(offset, 1, 'INCOME', 145000, 'Salary', 'Monthly Tech Lead Salary Credit', 'NEFT', 'acc_demo_hdfc', ' Employer payroll');
      if (offset % 2 === 0) {
        addSeedTx(offset, 14, 'INCOME', 18500, 'Freelance & Consulting', 'UI Architecture Advisory Retainer', 'IMPS', 'acc_demo_hdfc', 'Advisory session');
      }
      if (offset === 0 || offset === -3) {
        addSeedTx(offset, 20, 'INCOME', 4200, 'Dividends & Interest', 'Quarterly Savings & Equity Dividend', 'Direct Credit', 'acc_demo_hdfc');
      }

      // Fixed Rent & SIP Investments
      addSeedTx(offset, 3, 'EXPENSE', 32000, 'Rent & Housing', '2BHK Apartment Rent - Indiranagar', 'UPI', 'acc_demo_hdfc', 'Monthly house rent');
      addSeedTx(offset, 5, 'EXPENSE', 25000, 'Investments', 'Nifty 50 Index & Flexi-Cap SIP', 'Auto-Debit', 'acc_demo_zerodha', 'Automated monthly wealth SIP');
      addSeedTx(offset, 7, 'EXPENSE', 4450, 'Bills & Utilities', 'BESCOM Electricity & Airtel Fiber', 'UPI', 'acc_demo_hdfc');

      // Variable expenses with intentional pattern in current month vs last month
      const isCurrent = offset === 0;
      const isPrev = offset === -1;

      const diningSpend1 = isCurrent ? 4850 : isPrev ? 3100 : 3400;
      const diningSpend2 = isCurrent ? 5690 : isPrev ? 4200 : 3800;
      const grocerySpend = isCurrent ? 6200 : 5800;

      addSeedTx(offset, 6, 'EXPENSE', grocerySpend, 'Food & Dining', 'BigBasket & Organic Groceries', 'UPI', 'acc_demo_hdfc');
      addSeedTx(offset, 11, 'EXPENSE', diningSpend1, 'Food & Dining', 'Swiggy Instamart & Weekend Dining', 'Credit Card', 'acc_demo_icici');
      addSeedTx(offset, 19, 'EXPENSE', diningSpend2, 'Food & Dining', 'Team Dinner at Koramangala Social', 'Credit Card', 'acc_demo_icici');

      addSeedTx(offset, 9, 'EXPENSE', isCurrent ? 5400 : 4800, 'Transportation', 'Shell Petrol & Uber Airport Rides', 'UPI', 'acc_demo_hdfc');
      addSeedTx(offset, 15, 'EXPENSE', isCurrent ? 14200 : isPrev ? 9500 : 8200, 'Shopping', 'Myntra Apparel & Home Ergonomics', 'Credit Card', 'acc_demo_icici');
      addSeedTx(offset, 18, 'EXPENSE', 2199, 'Entertainment', 'Netflix 4K, Spotify Duo & BookMyShow', 'Credit Card', 'acc_demo_icici');
      addSeedTx(offset, 22, 'EXPENSE', isCurrent ? 3400 : 1800, 'Healthcare', 'Apollo Pharmacy & Cult.fit Pro Membership', 'UPI', 'acc_demo_hdfc');
      addSeedTx(offset, 25, 'EXPENSE', 2800, 'Education', 'O’Reilly Learning & System Design Course', 'Credit Card', 'acc_demo_icici');
    }

    // Budgets for Current Month and Previous Month
    const budgets: StoredBudget[] = [];
    const budgetSpecs = [
      { category: 'Food & Dining', amount: 18000 },
      { category: 'Rent & Housing', amount: 32000 },
      { category: 'Shopping', amount: 15000 },
      { category: 'Transportation', amount: 7000 },
      { category: 'Bills & Utilities', amount: 6000 },
      { category: 'Entertainment', amount: 4000 },
      { category: 'Healthcare', amount: 5000 },
      { category: 'Investments', amount: 25000 },
    ];

    for (const mOffset of [-1, 0]) {
      const d = new Date(currentYear, currentMonth - 1 + mOffset, 1);
      const bMonth = d.getMonth() + 1;
      const bYear = d.getFullYear();
      for (const spec of budgetSpecs) {
        budgets.push({
          id: this.generateId('bdg'),
          userId: demoUserId,
          categoryId: catByName(spec.category),
          amount: spec.amount,
          month: bMonth,
          year: bYear,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
    }

    const goals: StoredGoal[] = [
      {
        id: 'goal_demo_emergency',
        userId: demoUserId,
        name: '6-Month Emergency Fund',
        category: 'Emergency fund',
        targetAmount: 600000,
        currentAmount: 420000,
        targetDate: makeDate(6, 1),
        description: 'Liquid high-yield savings reserve covering 6 months of core living expenses.',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'goal_demo_laptop',
        userId: demoUserId,
        name: 'MacBook Pro M4 Max',
        category: 'New laptop',
        targetAmount: 245000,
        currentAmount: 185000,
        targetDate: makeDate(3, 15),
        description: 'Workstation upgrade for local AI engineering and development.',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'goal_demo_vacation',
        userId: demoUserId,
        name: 'Autumn Japan Trip',
        category: 'Vacation',
        targetAmount: 320000,
        currentAmount: 140000,
        targetDate: makeDate(9, 10),
        description: '12-day Kyoto & Tokyo itinerary including flights and rail pass.',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];

    const recurringTransactions: StoredRecurring[] = [
      {
        id: 'rec_demo_rent',
        userId: demoUserId,
        categoryId: catByName('Rent & Housing'),
        description: 'Apartment Rent - Indiranagar',
        amount: 32000,
        frequency: 'MONTHLY',
        nextDate: makeDate(1, 3),
        active: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'rec_demo_sip',
        userId: demoUserId,
        categoryId: catByName('Investments'),
        description: 'Nifty 50 & Flexi-Cap SIP',
        amount: 25000,
        frequency: 'MONTHLY',
        nextDate: makeDate(1, 5),
        active: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'rec_demo_fiber',
        userId: demoUserId,
        categoryId: catByName('Bills & Utilities'),
        description: 'Airtel Xstream Fiber Gigabit Plan',
        amount: 1499,
        frequency: 'MONTHLY',
        nextDate: makeDate(1, 7),
        active: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'rec_demo_streaming',
        userId: demoUserId,
        categoryId: catByName('Entertainment'),
        description: 'Netflix 4K & Spotify Duo Bundle',
        amount: 828,
        frequency: 'MONTHLY',
        nextDate: makeDate(1, 18),
        active: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'rec_demo_gym',
        userId: demoUserId,
        categoryId: catByName('Healthcare'),
        description: 'Cult.fit Elite Annual Membership',
        amount: 16500,
        frequency: 'YEARLY',
        nextDate: makeDate(4, 10),
        active: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];

    return {
      users: [demoUser],
      accounts,
      categories,
      transactions,
      budgets,
      goals,
      recurringTransactions,
      aiInsights: [],
    };
  }

  public stripSensitiveUser(u: StoredUser): User {
    const { passwordHash: _ph, resetCode: _rc, resetCodeExpiresAt: _rce, ...clean } = u;
    return clean;
  }

  // ==================== USERS & AUTH ====================
  public findUserByEmail(email: string): StoredUser | undefined {
    const normalized = email.trim().toLowerCase();
    return this.state.users.find((u) => u.email.toLowerCase() === normalized);
  }

  public findUserById(userId: string): StoredUser | undefined {
    return this.state.users.find((u) => u.id === userId);
  }

  public createUser(input: {
    name: string;
    email: string;
    password: string;
    currency?: string;
  }): User {
    const existing = this.findUserByEmail(input.email);
    if (existing) {
      throw new Error('An account with this email already exists.');
    }

    const nowIso = new Date().toISOString();
    const userId = this.generateId('usr');
    const currency = input.currency || 'INR';

    const newUser: StoredUser = {
      id: userId,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      passwordHash: hashPassword(input.password),
      currency,
      isDemo: false,
      notificationsEnabled: true,
      budgetAlertsThreshold: 80,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    this.state.users.push(newUser);

    // Provision default categories for the new user
    for (const c of DEFAULT_CATEGORIES) {
      this.state.categories.push({
        id: this.generateId('cat'),
        userId,
        name: c.name,
        type: c.type,
        icon: c.icon,
        color: c.color,
      });
    }

    // Provision a default primary bank account
    this.state.accounts.push({
      id: this.generateId('acc'),
      userId,
      name: 'Primary Savings Account',
      type: 'SAVINGS',
      balance: 0,
      currency,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    this.save();
    return this.stripSensitiveUser(newUser);
  }

  public updateUserProfile(
    userId: string,
    updates: {
      name: string;
      currency: string;
      notificationsEnabled: boolean;
      budgetAlertsThreshold: number;
    }
  ): User {
    const user = this.findUserById(userId);
    if (!user) throw new Error('User not found');

    user.name = updates.name;
    user.currency = updates.currency;
    user.notificationsEnabled = updates.notificationsEnabled;
    user.budgetAlertsThreshold = updates.budgetAlertsThreshold;
    user.updatedAt = new Date().toISOString();

    // Sync account currencies
    for (const acc of this.state.accounts) {
      if (acc.userId === userId) {
        acc.currency = updates.currency;
      }
    }

    this.save();
    return this.stripSensitiveUser(user);
  }

  public updateUserPassword(userId: string, currentPassword: string, newPassword: string): void {
    const user = this.findUserById(userId);
    if (!user) throw new Error('User not found');
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      throw new Error('Current password is incorrect.');
    }
    user.passwordHash = hashPassword(newPassword);
    user.updatedAt = new Date().toISOString();
    this.save();
  }

  public createPasswordResetCode(email: string): string | null {
    const user = this.findUserByEmail(email);
    if (!user) return null;
    const code = String(Math.floor(100000 + Math.random() * 900000));
    user.resetCode = code;
    user.resetCodeExpiresAt = Date.now() + 15 * 60 * 1000; // 15 mins
    this.save();
    return code;
  }

  public resetPasswordWithCode(email: string, code: string, newPassword: string): boolean {
    const user = this.findUserByEmail(email);
    if (!user || !user.resetCode || !user.resetCodeExpiresAt) return false;
    if (Date.now() > user.resetCodeExpiresAt) return false;
    if (user.resetCode !== code.trim()) return false;

    user.passwordHash = hashPassword(newPassword);
    user.resetCode = null;
    user.resetCodeExpiresAt = null;
    user.updatedAt = new Date().toISOString();
    this.save();
    return true;
  }

  public deleteUserAccount(userId: string): void {
    this.state.users = this.state.users.filter((u) => u.id !== userId);
    this.state.accounts = this.state.accounts.filter((a) => a.userId !== userId);
    this.state.categories = this.state.categories.filter((c) => c.userId !== userId);
    this.state.transactions = this.state.transactions.filter((t) => t.userId !== userId);
    this.state.budgets = this.state.budgets.filter((b) => b.userId !== userId);
    this.state.goals = this.state.goals.filter((g) => g.userId !== userId);
    this.state.recurringTransactions = this.state.recurringTransactions.filter(
      (r) => r.userId !== userId
    );
    this.state.aiInsights = this.state.aiInsights.filter((i) => i.userId !== userId);
    this.save();
  }

  // ==================== ACCOUNTS ====================
  public getAccounts(userId: string): Account[] {
    return this.state.accounts.filter((a) => a.userId === userId);
  }

  public createAccount(
    userId: string,
    input: { name: string; type: AccountType; balance: number }
  ): Account {
    const user = this.findUserById(userId);
    const nowIso = new Date().toISOString();
    const acc: Account = {
      id: this.generateId('acc'),
      userId,
      name: input.name,
      type: input.type,
      balance: Number(input.balance),
      currency: user?.currency || 'INR',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    this.state.accounts.push(acc);
    this.save();
    return acc;
  }

  // ==================== CATEGORIES ====================
  public getCategories(userId: string): Category[] {
    return this.state.categories.filter((c) => c.userId === userId);
  }

  public createCategory(
    userId: string,
    input: { name: string; type: TransactionType; icon?: string; color?: string }
  ): Category {
    const exists = this.state.categories.find(
      (c) =>
        c.userId === userId &&
        c.name.toLowerCase() === input.name.trim().toLowerCase() &&
        c.type === input.type
    );
    if (exists) {
      throw new Error('A category with this name and type already exists.');
    }
    const cat: Category = {
      id: this.generateId('cat'),
      userId,
      name: input.name.trim(),
      type: input.type,
      icon: input.icon || 'tag',
      color: input.color || '#0f172a',
    };
    this.state.categories.push(cat);
    this.save();
    return cat;
  }

  public deleteCategory(userId: string, categoryId: string): void {
    const cat = this.state.categories.find((c) => c.id === categoryId && c.userId === userId);
    if (!cat) throw new Error('Category not found or unauthorized');
    const inUse = this.state.transactions.some(
      (t) => t.userId === userId && t.categoryId === categoryId
    );
    if (inUse) {
      throw new Error('Cannot delete a category that has existing transactions.');
    }
    this.state.categories = this.state.categories.filter(
      (c) => !(c.id === categoryId && c.userId === userId)
    );
    this.state.budgets = this.state.budgets.filter(
      (b) => !(b.categoryId === categoryId && b.userId === userId)
    );
    this.save();
  }

  // ==================== TRANSACTIONS ====================
  public getTransactions(userId: string): Transaction[] {
    const cats = new Map(this.getCategories(userId).map((c) => [c.id, c]));
    const accs = new Map(this.getAccounts(userId).map((a) => [a.id, a]));

    return this.state.transactions
      .filter((t) => t.userId === userId)
      .map((t) => ({
        ...t,
        categoryName: cats.get(t.categoryId)?.name || 'Uncategorized',
        categoryColor: cats.get(t.categoryId)?.color || '#0f172a',
        accountName: accs.get(t.accountId)?.name || 'Primary Account',
      }))
      .sort((a, b) => {
        if (b.date !== a.date) return b.date.localeCompare(a.date);
        return b.createdAt.localeCompare(a.createdAt);
      });
  }

  public getTransactionById(userId: string, transactionId: string): Transaction | undefined {
    return this.getTransactions(userId).find((t) => t.id === transactionId);
  }

  public createTransaction(
    userId: string,
    input: {
      accountId: string;
      categoryId: string;
      type: TransactionType;
      amount: number;
      description: string;
      date: string;
      paymentMethod: string;
      notes?: string;
    }
  ): Transaction {
    const account = this.state.accounts.find(
      (a) => a.id === input.accountId && a.userId === userId
    );
    if (!account) {
      throw new Error('Invalid account selected');
    }
    const category = this.state.categories.find(
      (c) => c.id === input.categoryId && c.userId === userId
    );
    if (!category) {
      throw new Error('Invalid category selected');
    }

    const nowIso = new Date().toISOString();
    const tx: Transaction = {
      id: this.generateId('txn'),
      userId,
      accountId: input.accountId,
      categoryId: input.categoryId,
      type: input.type,
      amount: Number(input.amount),
      description: input.description.trim(),
      date: input.date,
      paymentMethod: input.paymentMethod.trim(),
      notes: input.notes?.trim() || '',
      isDemo: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // Adjust account balance deterministically
    const delta = tx.type === 'INCOME' ? tx.amount : -tx.amount;
    account.balance = Number((account.balance + delta).toFixed(2));
    account.updatedAt = nowIso;

    this.state.transactions.push(tx);
    this.save();
    return {
      ...tx,
      categoryName: category.name,
      categoryColor: category.color,
      accountName: account.name,
    };
  }

  public updateTransaction(
    userId: string,
    transactionId: string,
    input: {
      accountId: string;
      categoryId: string;
      type: TransactionType;
      amount: number;
      description: string;
      date: string;
      paymentMethod: string;
      notes?: string;
    }
  ): Transaction {
    const existing = this.state.transactions.find(
      (t) => t.id === transactionId && t.userId === userId
    );
    if (!existing) {
      throw new Error('Transaction not found or unauthorized');
    }

    const oldAccount = this.state.accounts.find(
      (a) => a.id === existing.accountId && a.userId === userId
    );
    const newAccount = this.state.accounts.find(
      (a) => a.id === input.accountId && a.userId === userId
    );
    const category = this.state.categories.find(
      (c) => c.id === input.categoryId && c.userId === userId
    );

    if (!newAccount || !category) {
      throw new Error('Invalid account or category');
    }

    // Revert old balance effect
    if (oldAccount) {
      const revertDelta = existing.type === 'INCOME' ? -existing.amount : existing.amount;
      oldAccount.balance = Number((oldAccount.balance + revertDelta).toFixed(2));
    }

    // Apply new balance effect
    const applyDelta = input.type === 'INCOME' ? Number(input.amount) : -Number(input.amount);
    newAccount.balance = Number((newAccount.balance + applyDelta).toFixed(2));

    const nowIso = new Date().toISOString();
    existing.accountId = input.accountId;
    existing.categoryId = input.categoryId;
    existing.type = input.type;
    existing.amount = Number(input.amount);
    existing.description = input.description.trim();
    existing.date = input.date;
    existing.paymentMethod = input.paymentMethod.trim();
    existing.notes = input.notes?.trim() || '';
    existing.updatedAt = nowIso;

    this.save();
    return {
      ...existing,
      categoryName: category.name,
      categoryColor: category.color,
      accountName: newAccount.name,
    };
  }

  public deleteTransaction(userId: string, transactionId: string): void {
    const existing = this.state.transactions.find(
      (t) => t.id === transactionId && t.userId === userId
    );
    if (!existing) {
      throw new Error('Transaction not found or unauthorized');
    }
    const account = this.state.accounts.find(
      (a) => a.id === existing.accountId && a.userId === userId
    );
    if (account) {
      const revertDelta = existing.type === 'INCOME' ? -existing.amount : existing.amount;
      account.balance = Number((account.balance + revertDelta).toFixed(2));
      account.updatedAt = new Date().toISOString();
    }
    this.state.transactions = this.state.transactions.filter(
      (t) => !(t.id === transactionId && t.userId === userId)
    );
    this.save();
  }

  // ==================== BUDGETS ====================
  public getStoredBudgets(userId: string, month?: number, year?: number): StoredBudget[] {
    return this.state.budgets.filter((b) => {
      if (b.userId !== userId) return false;
      if (month !== undefined && b.month !== month) return false;
      if (year !== undefined && b.year !== year) return false;
      return true;
    });
  }

  public upsertBudget(
    userId: string,
    input: { categoryId: string; amount: number; month: number; year: number }
  ): StoredBudget {
    const cat = this.state.categories.find(
      (c) => c.id === input.categoryId && c.userId === userId
    );
    if (!cat) throw new Error('Category not found or unauthorized');

    const nowIso = new Date().toISOString();
    const existing = this.state.budgets.find(
      (b) =>
        b.userId === userId &&
        b.categoryId === input.categoryId &&
        b.month === input.month &&
        b.year === input.year
    );

    if (existing) {
      existing.amount = Number(input.amount);
      existing.updatedAt = nowIso;
      this.save();
      return existing;
    }

    const created: StoredBudget = {
      id: this.generateId('bdg'),
      userId,
      categoryId: input.categoryId,
      amount: Number(input.amount),
      month: input.month,
      year: input.year,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    this.state.budgets.push(created);
    this.save();
    return created;
  }

  public updateBudgetById(userId: string, budgetId: string, amount: number): StoredBudget {
    const bdg = this.state.budgets.find((b) => b.id === budgetId && b.userId === userId);
    if (!bdg) throw new Error('Budget not found or unauthorized');
    bdg.amount = Number(amount);
    bdg.updatedAt = new Date().toISOString();
    this.save();
    return bdg;
  }

  public deleteBudget(userId: string, budgetId: string): void {
    const exists = this.state.budgets.some((b) => b.id === budgetId && b.userId === userId);
    if (!exists) throw new Error('Budget not found or unauthorized');
    this.state.budgets = this.state.budgets.filter(
      (b) => !(b.id === budgetId && b.userId === userId)
    );
    this.save();
  }

  // ==================== GOALS ====================
  public getStoredGoals(userId: string): StoredGoal[] {
    return this.state.goals.filter((g) => g.userId === userId);
  }

  public createGoal(
    userId: string,
    input: {
      name: string;
      category: string;
      targetAmount: number;
      currentAmount: number;
      targetDate: string;
      description?: string;
    }
  ): StoredGoal {
    const nowIso = new Date().toISOString();
    const goal: StoredGoal = {
      id: this.generateId('goal'),
      userId,
      name: input.name.trim(),
      category: input.category.trim(),
      targetAmount: Number(input.targetAmount),
      currentAmount: Number(input.currentAmount),
      targetDate: input.targetDate,
      description: input.description?.trim() || '',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    this.state.goals.push(goal);
    this.save();
    return goal;
  }

  public updateGoal(
    userId: string,
    goalId: string,
    input: {
      name: string;
      category: string;
      targetAmount: number;
      currentAmount: number;
      targetDate: string;
      description?: string;
    }
  ): StoredGoal {
    const goal = this.state.goals.find((g) => g.id === goalId && g.userId === userId);
    if (!goal) throw new Error('Goal not found or unauthorized');

    goal.name = input.name.trim();
    goal.category = input.category.trim();
    goal.targetAmount = Number(input.targetAmount);
    goal.currentAmount = Number(input.currentAmount);
    goal.targetDate = input.targetDate;
    goal.description = input.description?.trim() || '';
    goal.updatedAt = new Date().toISOString();

    this.save();
    return goal;
  }

  public deleteGoal(userId: string, goalId: string): void {
    const exists = this.state.goals.some((g) => g.id === goalId && g.userId === userId);
    if (!exists) throw new Error('Goal not found or unauthorized');
    this.state.goals = this.state.goals.filter((g) => !(g.id === goalId && g.userId === userId));
    this.save();
  }

  // ==================== RECURRING TRANSACTIONS ====================
  public getRecurringTransactions(userId: string): RecurringTransaction[] {
    const cats = new Map(this.getCategories(userId).map((c) => [c.id, c]));
    return this.state.recurringTransactions
      .filter((r) => r.userId === userId)
      .map((r) => {
        const multiplier =
          r.frequency === 'WEEKLY'
            ? 52 / 12
            : r.frequency === 'MONTHLY'
            ? 1
            : r.frequency === 'QUARTERLY'
            ? 1 / 3
            : 1 / 12;
        return {
          ...r,
          categoryName: cats.get(r.categoryId)?.name || 'Expense',
          categoryColor: cats.get(r.categoryId)?.color || '#0f172a',
          monthlyEquivalent: Number((r.amount * multiplier).toFixed(2)),
        };
      });
  }

  public createRecurring(
    userId: string,
    input: {
      categoryId: string;
      description: string;
      amount: number;
      frequency: FrequencyType;
      nextDate: string;
      active?: boolean;
    }
  ): StoredRecurring {
    const cat = this.state.categories.find(
      (c) => c.id === input.categoryId && c.userId === userId
    );
    if (!cat) throw new Error('Category not found or unauthorized');
    const nowIso = new Date().toISOString();
    const rec: StoredRecurring = {
      id: this.generateId('rec'),
      userId,
      categoryId: input.categoryId,
      description: input.description.trim(),
      amount: Number(input.amount),
      frequency: input.frequency,
      nextDate: input.nextDate,
      active: input.active ?? true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    this.state.recurringTransactions.push(rec);
    this.save();
    return rec;
  }

  public updateRecurring(
    userId: string,
    recId: string,
    input: {
      categoryId: string;
      description: string;
      amount: number;
      frequency: FrequencyType;
      nextDate: string;
      active: boolean;
    }
  ): StoredRecurring {
    const rec = this.state.recurringTransactions.find(
      (r) => r.id === recId && r.userId === userId
    );
    if (!rec) throw new Error('Recurring expense not found or unauthorized');
    rec.categoryId = input.categoryId;
    rec.description = input.description.trim();
    rec.amount = Number(input.amount);
    rec.frequency = input.frequency;
    rec.nextDate = input.nextDate;
    rec.active = input.active;
    rec.updatedAt = new Date().toISOString();
    this.save();
    return rec;
  }

  public deleteRecurring(userId: string, recId: string): void {
    const exists = this.state.recurringTransactions.some(
      (r) => r.id === recId && r.userId === userId
    );
    if (!exists) throw new Error('Recurring expense not found or unauthorized');
    this.state.recurringTransactions = this.state.recurringTransactions.filter(
      (r) => !(r.id === recId && r.userId === userId)
    );
    this.save();
  }

  // ==================== AI INSIGHTS ====================
  public getInsights(userId: string): AIInsight[] {
    return this.state.aiInsights
      .filter((i) => i.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public saveInsightsForUser(userId: string, insights: Omit<AIInsight, 'id' | 'createdAt'>[]): AIInsight[] {
    const existingReadIds = new Set(
      this.state.aiInsights
        .filter((i) => i.userId === userId && i.readAt)
        .map((i) => i.title)
    );
    const nowIso = new Date().toISOString();
    this.state.aiInsights = this.state.aiInsights.filter((i) => i.userId !== userId);

    const stored: AIInsight[] = insights.map((item) => ({
      ...item,
      id: this.generateId('ins'),
      createdAt: nowIso,
      readAt: existingReadIds.has(item.title) ? nowIso : null,
    }));

    this.state.aiInsights.push(...stored);
    this.save();
    return stored;
  }

  public markInsightRead(userId: string, insightId: string): AIInsight {
    const insight = this.state.aiInsights.find(
      (i) => i.id === insightId && i.userId === userId
    );
    if (!insight) throw new Error('Insight not found or unauthorized');
    insight.readAt = new Date().toISOString();
    this.save();
    return insight;
  }
}

export const db = new PocketSmartDB();
