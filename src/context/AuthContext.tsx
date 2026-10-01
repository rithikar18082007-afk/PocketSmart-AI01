import React, { createContext, useContext, useState, useCallback } from 'react';
import type { User } from '../shared/types.ts';
import { apiRequest, setApiToken } from '../lib/api.ts';
import { getCurrentYearMonth } from '../shared/format.ts';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}

interface AuthContextValue {
  user: User | null;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  availableMonths: { value: string; label: string }[];
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, currency: string) => Promise<void>;
  loginWithDemo: () => Promise<void>;
  logout: () => void;
  updateUserState: (user: User) => void;
  toasts: ToastMessage[];
  notify: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function buildAvailableMonths(): { value: string; label: string }[] {
  const now = new Date();
  const list: { value: string; label: string }[] = [];
  for (let offset = 0; offset >= -5; offset--) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    list.push({ value: val, label });
  }
  return list;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentYearMonth());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const availableMonths = React.useMemo(() => buildAvailableMonths(), []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
      setTimeout(() => {
        dismissToast(id);
      }, 4200);
    },
    [dismissToast]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiRequest<{ user: User; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setApiToken(data.token);
      setUser(data.user);
      notify({
        type: 'success',
        title: `Welcome back, ${data.user.name.split(' ')[0]}`,
        description: 'Your personal finance workspace is ready.',
      });
    },
    [notify]
  );

  const signup = useCallback(
    async (name: string, email: string, password: string, currency: string) => {
      const data = await apiRequest<{ user: User; token: string }>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, currency }),
      });
      setApiToken(data.token);
      setUser(data.user);
      notify({
        type: 'success',
        title: 'Account created',
        description: 'Default categories and your primary savings account have been initialized.',
      });
    },
    [notify]
  );

  const loginWithDemo = useCallback(async () => {
    const data = await apiRequest<{ user: User; token: string }>('/auth/demo', {
      method: 'POST',
    });
    setApiToken(data.token);
    setUser(data.user);
    notify({
      type: 'info',
      title: 'Signed in to Demo Profile',
      description: 'Loaded 6 months of sample INR transactions, budgets, and goals.',
    });
  }, [notify]);

  const logout = useCallback(() => {
    setApiToken(null);
    setUser(null);
    notify({
      type: 'info',
      title: 'Signed out',
      description: 'Your session has been securely closed.',
    });
  }, [notify]);

  const updateUserState = useCallback((updated: User) => {
    setUser(updated);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        selectedMonth,
        setSelectedMonth,
        availableMonths,
        login,
        signup,
        loginWithDemo,
        logout,
        updateUserState,
        toasts,
        notify,
        dismissToast,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
