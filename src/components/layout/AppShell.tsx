import React, { useState } from 'react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  PieChart,
  Target,
  BarChart3,
  Bot,
  Settings,
  LogOut,
  Menu,
  X,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { Button, Select } from '../ui/primitives.tsx';

export type NavTab =
  | 'dashboard'
  | 'transactions'
  | 'budgets'
  | 'goals'
  | 'analytics'
  | 'assistant'
  | 'settings';

const NAV_ITEMS: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] =
  [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
    { id: 'budgets', label: 'Budgets', icon: PieChart },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'assistant', label: 'AI Assistant', icon: Bot },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

export function AppShell({
  activeTab,
  onSelectTab,
  children,
}: {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  children: React.ReactNode;
}) {
  const { user, selectedMonth, setSelectedMonth, availableMonths, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentNavLabel =
    NAV_ITEMS.find((i) => i.id === activeTab)?.label || 'Dashboard';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Desktop Sidebar (256px) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 bg-slate-900 text-slate-100">
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-800">
          <button
            type="button"
            onClick={() => onSelectTab('dashboard')}
            className="text-lg font-bold tracking-tight text-white cursor-pointer"
          >
            PocketSmart AI
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-5" aria-label="Sidebar Navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <div className="mb-3 px-2">
            <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            {user?.isDemo && (
              <p className="mt-1 text-[11px] text-emerald-400">
                Demo Account · Sample INR Data
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 backdrop-blur-xs px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation drawer"
              className="lg:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-400 hidden sm:inline">Workspace</span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-semibold text-slate-900">{currentNavLabel}</h1>
              {user?.isDemo && (
                <>
                  <span className="text-slate-300 hidden md:inline" aria-hidden="true">
                    ·
                  </span>
                  <span className="hidden md:inline text-xs text-emerald-700 font-medium">
                    Sample INR Dataset
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400 hidden sm:block" />
              <Select
                aria-label="Select reporting month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-40 py-1.5 text-xs font-medium"
              >
                {availableMonths.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelectTab('assistant')}
              className="hidden sm:inline-flex"
            >
              <Bot className="h-3.5 w-3.5 text-emerald-600" />
              <span>Ask AI</span>
            </Button>
          </div>
        </header>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative z-10 flex w-64 flex-col bg-slate-900 text-white p-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <span className="text-base font-bold">PocketSmart AI</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation menu"
                  className="rounded-lg p-1 text-slate-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="mt-4 flex-1 space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelectTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                        active
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
              <div className="border-t border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Viewport Content */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 pb-24 lg:pb-10 max-w-[1360px] w-full mx-auto">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <nav
          aria-label="Mobile Bottom Navigation"
          className="lg:hidden fixed bottom-0 inset-x-0 z-20 flex h-14 items-center justify-around border-t border-slate-200 bg-white px-2"
        >
          {NAV_ITEMS.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 text-[11px] font-medium ${
                  active ? 'text-emerald-700' : 'text-slate-500'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => onSelectTab('assistant')}
            className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 text-[11px] font-medium ${
              activeTab === 'assistant' ? 'text-emerald-700' : 'text-slate-500'
            }`}
          >
            <Bot className="h-4 w-4" />
            <span>AI</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
