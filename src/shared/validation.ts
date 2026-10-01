import { z } from 'zod';

export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80, 'Name is too long'),
  email: z.string().trim().email('Please enter a valid email address').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password is too long'),
  currency: z.enum(['INR', 'USD', 'EUR', 'GBP']).optional().default('INR'),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address').toLowerCase(),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address').toLowerCase(),
  resetCode: z.string().trim().min(6, 'Reset code must be 6 digits'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const transactionSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  categoryId: z.string().min(1, 'Category is required'),
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.coerce.number().positive('Amount must be greater than zero').max(100000000, 'Amount exceeds limit'),
  description: z.string().trim().min(1, 'Description is required').max(160, 'Description is too long'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  paymentMethod: z.string().trim().min(1, 'Payment method is required').max(50).default('UPI'),
  notes: z.string().trim().max(500, 'Notes cannot exceed 500 characters').optional().default(''),
});

export const budgetSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  amount: z.coerce.number().positive('Budget limit must be greater than zero').max(100000000),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2035),
});

export const goalSchema = z.object({
  name: z.string().trim().min(2, 'Goal name is required').max(100),
  category: z.string().trim().min(1, 'Goal category is required').max(60).default('Emergency fund'),
  targetAmount: z.coerce.number().positive('Target amount must be greater than zero').max(1000000000),
  currentAmount: z.coerce.number().min(0, 'Current amount cannot be negative').max(1000000000),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Target date must be in YYYY-MM-DD format'),
  description: z.string().trim().max(300).optional().default(''),
});

export const recurringSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  description: z.string().trim().min(2, 'Description is required').max(120),
  amount: z.coerce.number().positive('Amount must be greater than zero').max(100000000),
  frequency: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
  nextDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Next date must be in YYYY-MM-DD format'),
  active: z.boolean().optional().default(true),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2, 'Category name is required').max(50),
  type: z.enum(['INCOME', 'EXPENSE']),
  icon: z.string().trim().max(30).optional().default('tag'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex code').optional().default('#0f172a'),
});

export const accountSchema = z.object({
  name: z.string().trim().min(2, 'Account name is required').max(80),
  type: z.enum(['CHECKING', 'SAVINGS', 'CREDIT_CARD', 'INVESTMENT', 'WALLET']),
  balance: z.coerce.number().min(-100000000).max(1000000000),
});

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  currency: z.enum(['INR', 'USD', 'EUR', 'GBP']),
  notificationsEnabled: z.boolean(),
  budgetAlertsThreshold: z.coerce.number().int().min(50).max(100),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(100),
});

export const aiQuestionSchema = z.object({
  question: z.string().trim().min(2, 'Please enter a question').max(600, 'Question is too long'),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});
