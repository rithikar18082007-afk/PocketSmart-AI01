# PocketSmart AI

**Your money, understood by AI.**

PocketSmart AI is a full-stack personal finance dashboard and AI financial assistant built with React, TypeScript, Tailwind CSS, Express, Zod, Recharts, Prisma schema definitions, and server-side Google Gemini AI (`@google/genai`).

---

## Core Capabilities

1. **Landing & Onboarding**: Value proposition, live INR snapshot preview, capability overview, security architecture, and FAQ.
2. **Authentication & Security**:
   - Sign up, login, logout, forgot password, and 6-digit password reset code flow.
   - Instant 1-click Demo Profile (`demo@pocketsmart.ai`) pre-populated with 6 months of Indian Rupee (`₹`) transactions, budgets, recurring commitments, and financial goals.
   - Salted `scrypt` password hashing, timing-safe verification, signed HMAC-SHA256 bearer tokens, and per-route rate limiting.
3. **Interactive Dashboard**:
   - Total balance, monthly income, monthly expenses, net savings, savings rate (`Savings / Income × 100` with safe zero-income handling), and remaining budget.
   - 6-month cash flow area chart, automated AI Insight Engine, budget utilization progress bars, goal pacing, and recent transactions.
4. **Transactions, Recurring Commitments & CSV Import/Export**:
   - Full CRUD for income and expense transactions with deterministic account balance synchronization.
   - Search, category filter, income/expense filter, date filter, multi-column sorting, and pagination.
   - Multi-step **CSV Import Wizard**: upload or paste CSV -> validate dates/amounts -> auto-map categories -> flag duplicate records -> confirm import.
5. **Monthly Category Budgets**:
   - Set monthly limits per category, track utilization percentages, and receive automatic warnings when approaching (`>= 80%`) or exceeding (`>= 100%`) limits.
6. **Financial Goals**:
   - Track progress toward Emergency Fund, New Laptop, Vacation, Education, Vehicle, Home, or Custom goals with required monthly contribution math.
7. **Analytics**:
   - Interactive Recharts for Monthly Income vs. Expenses, Net Savings Trajectory, Category Spending Share & MoM change, Budget Planned vs. Actual, and Recurring Expense Commitments.
8. **AI Financial Assistant & Insight Engine**:
   - Server-side integration using `@google/genai` (`gemini-3.8-flash`) with deterministic fallback calculations.
   - Strictly isolated to the authenticated user's financial data.
   - Explicitly separates **Calculated Facts**, **Estimates & Assumptions**, and **Financial Education**.

---

## Setup & Running Locally

### 1. Environment Variables
Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```
- `GEMINI_API_KEY`: Server-side API key for Gemini AI requests.
- `SESSION_SECRET`: Secret key used to sign authentication tokens.
- `DATABASE_URL`: PostgreSQL connection string for Prisma migrations.

### 2. Install Dependencies
```bash
npm install
```

### 3. Database & Prisma Migrations
The normalized PostgreSQL schema is located in `prisma/schema.prisma`. To run Prisma migrations against a PostgreSQL instance:
```bash
npx prisma generate
npx prisma migrate dev --name init_pocketsmart_ai
```
For zero-config local and preview execution, the server also includes an automatic disk-persisted relational store (`.data/pocketsmart-db.json`) seeded with 6 months of sample INR (`₹`) data.

### 4. Start Development Server
```bash
npm run dev
```
The full-stack Express + Vite application runs on `http://localhost:3000`.

### 5. Run Automated Tests & Type Check
```bash
npm run lint
npm test
```
