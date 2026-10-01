import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { AppShell, type NavTab } from './components/layout/AppShell.tsx';
import { LandingPage } from './pages/LandingPage.tsx';
import { AuthPage, type AuthMode } from './pages/AuthPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { TransactionsPage } from './pages/TransactionsPage.tsx';
import { BudgetsPage } from './pages/BudgetsPage.tsx';
import { GoalsPage } from './pages/GoalsPage.tsx';
import { AnalyticsPage } from './pages/AnalyticsPage.tsx';
import { AIAssistantPage } from './pages/AIAssistantPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message || 'Unexpected UI error' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full rounded-xl border border-red-200 bg-white p-6 text-center space-y-3">
            <h2 className="text-base font-bold text-slate-900">
              Something went wrong
            </h2>
            <p className="text-xs text-slate-600">{this.state.message}</p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium cursor-pointer"
            >
              Reload View
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ToastContainer() {
  const { toasts, dismissToast } = useAuth();
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((t) => {
        const Icon =
          t.type === 'success'
            ? CheckCircle2
            : t.type === 'error'
            ? AlertCircle
            : Info;
        const iconColor =
          t.type === 'success'
            ? 'text-emerald-600'
            : t.type === 'error'
            ? 'text-red-600'
            : 'text-slate-700';

        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg"
          >
            <div className="flex items-start gap-2.5">
              <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${iconColor}`} />
              <div>
                <p className="text-xs font-semibold text-slate-900">{t.title}</p>
                {t.description && (
                  <p className="mt-0.5 text-[11px] text-slate-500 leading-relaxed">
                    {t.description}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function PocketSmartRouter() {
  const { user, loginWithDemo } = useAuth();
  const [unauthScreen, setUnauthScreen] = useState<'landing' | 'auth'>('landing');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  if (!user) {
    return (
      <>
        {unauthScreen === 'landing' ? (
          <LandingPage
            onOpenAuth={(mode) => {
              setAuthMode(mode);
              setUnauthScreen('auth');
            }}
            onTryDemo={async () => {
              await loginWithDemo();
              setActiveTab('dashboard');
            }}
          />
        ) : (
          <AuthPage
            initialMode={authMode}
            onBackToLanding={() => setUnauthScreen('landing')}
          />
        )}
        <ToastContainer />
      </>
    );
  }

  return (
    <>
      <AppShell activeTab={activeTab} onSelectTab={setActiveTab}>
        {activeTab === 'dashboard' && <DashboardPage onNavigate={setActiveTab} />}
        {activeTab === 'transactions' && <TransactionsPage />}
        {activeTab === 'budgets' && <BudgetsPage />}
        {activeTab === 'goals' && <GoalsPage />}
        {activeTab === 'analytics' && <AnalyticsPage />}
        {activeTab === 'assistant' && <AIAssistantPage />}
        {activeTab === 'settings' && <SettingsPage />}
      </AppShell>
      <ToastContainer />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <PocketSmartRouter />
      </AuthProvider>
    </ErrorBoundary>
  );
}
