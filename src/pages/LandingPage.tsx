import React, { useState } from 'react';
import {
  ArrowRight,
  ShieldCheck,
  Lock,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react';
import { Button } from '../components/ui/primitives.tsx';

const HERO_IMAGE_URL = '/src/assets/images/hero_finance_workspace_1790844902350.jpg';
const AVATAR_PRIYA_URL = '/src/assets/images/avatar_priya_sharma_1790844916801.jpg';
const AVATAR_ARJUN_URL = '/src/assets/images/avatar_arjun_mehta_1790844930836.jpg';

const FAQS = [
  {
    q: 'How does the AI financial assistant protect my privacy?',
    a: 'PocketSmart AI enforces strict server-side user isolation. Your financial records are scoped to your authenticated user ID on every database query, and API keys remain strictly on the server.',
  },
  {
    q: 'Does the AI perform financial calculations or guess numbers?',
    a: 'All balances, savings rates, category totals, and month-over-month comparisons are computed deterministically by the server before reaching the AI layer. The assistant never invents transactions or balances.',
  },
  {
    q: 'Can I import bank or UPI statements via CSV?',
    a: 'Yes. The multi-step CSV import wizard detects columns (Date, Description, Amount, Type), maps categories automatically, flags duplicate entries, and lets you review every row before importing.',
  },
  {
    q: 'Is Indian Rupee (₹) supported natively?',
    a: 'Yes. PocketSmart AI formats Indian Rupee (₹1,250.00) with Indian numbering conventions by default, and also supports switching to USD, EUR, or GBP in Settings.',
  },
];

export function LandingPage({
  onOpenAuth,
  onTryDemo,
}: {
  onOpenAuth: (mode: 'login' | 'signup') => void;
  onTryDemo: () => void;
}) {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [heroImgError, setHeroImgError] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 lg:px-12 py-4 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
        {/* Zone 1: Single text element wordmark */}
        <a href="#top" className="text-lg font-bold tracking-tight text-slate-900">
          PocketSmart AI
        </a>

        {/* Zone 2: 4 clean text navigation links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <a href="#features" className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors">
            Features
          </a>
          <a href="#how-it-works" className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors">
            How It Works
          </a>
          <a href="#security" className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors">
            Security
          </a>
          <a href="#faq" className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors">
            FAQ
          </a>
        </nav>

        {/* Zone 3: 2 primary actions */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => onOpenAuth('login')}>
            Sign In
          </Button>
          <Button variant="primary" size="sm" onClick={() => onOpenAuth('signup')}>
            Get Started
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section id="top" className="px-6 lg:px-12 pt-14 pb-20 max-w-[1280px] mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="text-xs font-medium text-emerald-700">
              Personal Finance Intelligence · Built for INR (₹) & Multi-Currency
            </div>
            <h1
              className="text-4xl sm:text-5xl lg:text-[54px] font-bold tracking-tight text-slate-900 leading-[1.1]"
              style={{ textWrap: 'balance' } as React.CSSProperties}
            >
              Your money, understood by AI.
            </h1>
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
              Track spending, plan your budget, and understand your finances with an
              intelligent personal finance assistant. Deterministic accounting meets
              conversational clarity.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button variant="secondary" size="lg" onClick={() => onOpenAuth('signup')}>
                <span>Create Free Account</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="lg" onClick={onTryDemo}>
                Explore Live Demo (INR Seed Data)
              </Button>
            </div>

            <div className="pt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
              <span>Deterministic INR (₹) ledger</span>
              <span aria-hidden="true">·</span>
              <span>User-isolated AI context</span>
              <span aria-hidden="true">·</span>
              <span>Instant CSV bank import</span>
            </div>
          </div>

          {/* Right Column: Studio Visual + Live Financial Preview */}
          <div className="lg:col-span-5">
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="relative aspect-16/9 w-full bg-slate-900 overflow-hidden">
                {!heroImgError ? (
                  <img
                    src={HERO_IMAGE_URL}
                    alt="PocketSmart AI minimalist financial workspace"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgError(true)}
                    className="h-full w-full object-cover opacity-90"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex items-center justify-center p-6 text-white text-sm">
                    PocketSmart AI Financial Workspace
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent flex items-end p-5">
                  <div className="text-white">
                    <p className="text-xs text-emerald-300 font-medium">
                      Live Monthly Snapshot · October 2026
                    </p>
                    <p className="text-2xl font-bold font-mono tabular-nums mt-0.5">
                      ₹9,02,650.00
                    </p>
                  </div>
                </div>
              </div>

              {/* Interactive Mock Dashboard Summary */}
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-3 gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-[11px] text-slate-500">Monthly Income</p>
                    <p className="text-sm font-semibold text-slate-900 font-mono tabular-nums mt-0.5">
                      ₹1,67,700.00
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">Monthly Expenses</p>
                    <p className="text-sm font-semibold text-slate-900 font-mono tabular-nums mt-0.5">
                      ₹1,03,739.00
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">Net Savings (38.1%)</p>
                    <p className="text-sm font-semibold text-emerald-700 font-mono tabular-nums mt-0.5">
                      +₹63,961.00
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-800">
                    AI Insight Engine Output
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    You spent <span className="font-mono tabular-nums font-medium text-slate-900">₹3,640.00</span> more on Food & Dining this month than last month. That represents a <span className="font-mono tabular-nums font-medium text-amber-700">27.8%</span> increase.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features (Asymmetric Bento & Editorial Numbering) */}
      <section id="features" className="py-20 bg-white border-y border-slate-200 px-6 lg:px-12">
        <div className="max-w-[1280px] mx-auto">
          <div className="max-w-2xl">
            <p className="text-xs font-medium text-emerald-700">Core Capabilities</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              Built for clarity, precision, and everyday financial control
            </h2>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              Every tool in PocketSmart AI connects directly to your verified ledger,
              eliminating spreadsheet maintenance while keeping you in full command of
              your cash flow.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 rounded-xl border border-slate-200 p-6 bg-slate-50/50">
              <h3 className="text-base font-semibold text-slate-900">
                01. Conversational AI Grounded in Deterministic Math
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Ask questions like “Where did I spend the most this month?” or “How much
                can I save if I reduce dining expenses by 20%?” Every response separates
                verified facts from projections and general financial education.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-200/80 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
                <span>Zero hallucinated balances</span>
                <span aria-hidden="true">·</span>
                <span>Fact vs. assumption breakdown</span>
                <span aria-hidden="true">·</span>
                <span>Strict per-user authorization</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-6 bg-white">
              <h3 className="text-base font-semibold text-slate-900">
                02. Proactive AI Insight Engine
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Automatically detects month-over-month category spikes, approaching
                budget thresholds, savings rate changes, and recurring bill commitments.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-6 bg-white">
              <h3 className="text-base font-semibold text-slate-900">
                03. Category Budgets with Early Warnings
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Set monthly limits per category and track real-time utilization with
                configurable alert thresholds before you overspend.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-6 bg-white">
              <h3 className="text-base font-semibold text-slate-900">
                04. Goal Pacing & Completion Forecasting
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Plan your emergency fund, home down payment, or laptop upgrade with
                required monthly contribution math tied to your actual net savings.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-6 bg-white">
              <h3 className="text-base font-semibold text-slate-900">
                05. Validated CSV Statement Import
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Upload CSV files with automatic column detection, intelligent category
                mapping, duplicate prevention, and row-by-row validation preview.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works + Attributable Proof */}
      <section id="how-it-works" className="py-20 px-6 lg:px-12 max-w-[1280px] mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-6 space-y-6">
            <p className="text-xs font-medium text-emerald-700">Workflow</p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              From raw transactions to actionable financial decisions in three steps
            </h2>
            <div className="space-y-6 pt-2">
              <div className="border-l-2 border-slate-900 pl-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Step 1 · Log or Import Your Transactions
                </h3>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Record UPI, NEFT, credit card, or cash transactions—or upload a CSV
                  statement with automatic duplicate detection and category mapping.
                </p>
              </div>
              <div className="border-l-2 border-emerald-600 pl-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Step 2 · Monitor Cash Flow, Budgets & Recurring Commitments
                </h3>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  PocketSmart AI computes your savings rate, category shares, and
                  budget utilization across months without manual formulas.
                </p>
              </div>
              <div className="border-l-2 border-slate-300 pl-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Step 3 · Query Your Personal AI Assistant
                </h3>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Ask plain-English questions about your spending patterns and receive
                  verified facts alongside clear savings simulations.
                </p>
              </div>
            </div>
          </div>

          {/* Attributable Proof / Case Studies */}
          <div className="lg:col-span-6 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <p className="text-sm text-slate-700 leading-relaxed">
                “Before PocketSmart AI, our household UPI and credit card expenses were
                scattered across three bank statements. Within two months of setting
                category budgets and reviewing the AI dining alerts, we reduced impulse
                food delivery by <span className="font-mono tabular-nums font-semibold">31%</span> and increased our monthly SIP contribution by <span className="font-mono tabular-nums font-semibold">₹12,500.00</span>.”
              </p>
              <div className="mt-4 flex items-center gap-3 pt-3 border-t border-slate-100">
                <img
                  src={AVATAR_PRIYA_URL}
                  alt="Priya Sharma"
                  referrerPolicy="no-referrer"
                  className="h-10 w-10 rounded-full object-cover bg-slate-200"
                />
                <div>
                  <p className="text-xs font-semibold text-slate-900">Priya Sharma</p>
                  <p className="text-xs text-slate-500">
                    Director of Product · Bengaluru
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <p className="text-sm text-slate-700 leading-relaxed">
                “What stood out immediately is that the AI assistant never guesses. It
                shows the exact calculated rupee figures from my ledger first, then
                separates out what-if savings assumptions so I can plan my emergency
                fund with confidence.”
              </p>
              <div className="mt-4 flex items-center gap-3 pt-3 border-t border-slate-100">
                <img
                  src={AVATAR_ARJUN_URL}
                  alt="Arjun Mehta"
                  referrerPolicy="no-referrer"
                  className="h-10 w-10 rounded-full object-cover bg-slate-200"
                />
                <div>
                  <p className="text-xs font-semibold text-slate-900">Arjun Mehta</p>
                  <p className="text-xs text-slate-500">
                    Principal Systems Architect · Pune
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security & Privacy Section */}
      <section id="security" className="py-16 bg-slate-900 text-white px-6 lg:px-12">
        <div className="max-w-[1280px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-7 space-y-3">
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
              <ShieldCheck className="h-4 w-4" />
              <span>Security & Data Isolation Architecture</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Your financial data is isolated, validated, and never shared across accounts
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
              Every API request requires a signed authentication token. Server-side
              ownership guards ensure no user or AI query can ever read or modify another
              user’s records.
            </p>
          </div>
          <div className="md:col-span-5 space-y-2.5 text-xs text-slate-200">
            <div className="flex items-center gap-2.5">
              <Check className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Scrypt salted password hashing & timing-safe verification</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Check className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Strict server-side AI integration (zero client-side API keys)</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Check className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Full JSON & CSV data portability and instant account deletion</span>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-6 lg:px-12 max-w-3xl mx-auto w-full">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 text-center">
          Frequently Asked Questions
        </h2>
        <div className="mt-8 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {FAQS.map((item, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div key={item.q} className="p-5">
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-900 cursor-pointer"
                >
                  <span>{item.q}</span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-slate-500 shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <p className="mt-2.5 text-xs text-slate-600 leading-relaxed">
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Final Call-to-Action */}
      <section className="py-16 px-6 lg:px-12 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto text-center space-y-5">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Start making confident financial decisions today
          </h2>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            Create your private personal finance profile in seconds or explore the
            pre-populated Indian Rupee (₹) demo account immediately.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button variant="secondary" size="lg" onClick={() => onOpenAuth('signup')}>
              Get Started Free
            </Button>
            <Button variant="outline" size="lg" onClick={onTryDemo}>
              Launch Instant Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 px-6 lg:px-12 py-8 text-xs text-slate-500">
        <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-semibold text-slate-800">PocketSmart AI</span>
            <span aria-hidden="true">·</span>
            <span>Intelligent Personal Finance Assistant</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="hover:text-slate-900">
              Features
            </a>
            <a href="#security" className="hover:text-slate-900">
              Security
            </a>
            <a href="#faq" className="hover:text-slate-900">
              FAQ
            </a>
            <span>© {new Date().getFullYear()} PocketSmart AI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
