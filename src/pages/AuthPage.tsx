import React, { useState } from 'react';
import { ArrowLeft, Lock, Mail, User as UserIcon, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../lib/api.ts';
import { Button, Input, Select, Card, ErrorBanner } from '../components/ui/primitives.tsx';

export type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';

export function AuthPage({
  initialMode = 'login',
  onBackToLanding,
}: {
  initialMode?: AuthMode;
  onBackToLanding: () => void;
}) {
  const { login, signup, loginWithDemo, notify } = useAuth();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [generatedPreviewCode, setGeneratedPreviewCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else if (mode === 'signup') {
        await signup(name, email, password, currency);
      } else if (mode === 'forgot') {
        const res = await apiRequest<{ message: string; previewResetCode?: string | null }>(
          '/auth/forgot-password',
          {
            method: 'POST',
            body: JSON.stringify({ email }),
          }
        );
        setGeneratedPreviewCode(res.previewResetCode || null);
        notify({
          type: 'info',
          title: 'Reset code generated',
          description: res.message,
        });
        setMode('reset');
      } else if (mode === 'reset') {
        await apiRequest('/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({
            email,
            resetCode,
            newPassword,
          }),
        });
        notify({
          type: 'success',
          title: 'Password updated',
          description: 'You can now sign in with your new password.',
        });
        setPassword('');
        setMode('login');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithDemo();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in to demo account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <button
          type="button"
          onClick={onBackToLanding}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 mb-6 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to PocketSmart AI home</span>
        </button>

        <Card className="p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              {mode === 'login' && 'Sign in to PocketSmart AI'}
              {mode === 'signup' && 'Create your PocketSmart AI account'}
              {mode === 'forgot' && 'Reset your password'}
              {mode === 'reset' && 'Enter your 6-digit reset code'}
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              {mode === 'login' &&
                'Access your personal finance dashboard, budgets, and AI assistant.'}
              {mode === 'signup' &&
                'Start tracking expenses in INR (₹) or your preferred currency.'}
              {mode === 'forgot' &&
                'Enter your registered email address to request a password reset code.'}
              {mode === 'reset' &&
                'Provide the 6-digit verification code and choose a new password.'}
            </p>
          </div>

          {error && (
            <div className="mb-4">
              <ErrorBanner message={error} />
            </div>
          )}

          {mode === 'reset' && generatedPreviewCode && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
              <p className="font-semibold">Verification Code (Preview Environment):</p>
              <p className="mt-1 font-mono text-sm font-bold tracking-wider">
                {generatedPreviewCode}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="auth-name"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                  <Input
                    id="auth-name"
                    type="text"
                    required
                    placeholder="Aarav Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <Input
                  id="auth-email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {(mode === 'login' || mode === 'signup') && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="auth-password"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Password
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setMode('forgot');
                      }}
                      className="text-xs font-medium text-emerald-700 hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                  <Input
                    id="auth-password"
                    type="password"
                    required
                    minLength={mode === 'signup' ? 8 : 1}
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="auth-currency"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Primary Currency
                </label>
                <Select
                  id="auth-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="INR">INR (₹) — Indian Rupee</option>
                  <option value="USD">USD ($) — US Dollar</option>
                  <option value="EUR">EUR (€) — Euro</option>
                  <option value="GBP">GBP (£) — British Pound</option>
                </Select>
              </div>
            )}

            {mode === 'reset' && (
              <>
                <div>
                  <label
                    htmlFor="auth-reset-code"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    6-Digit Reset Code
                  </label>
                  <div className="relative">
                    <KeyRound className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                    <Input
                      id="auth-reset-code"
                      type="text"
                      required
                      placeholder="123456"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      className="pl-9 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="auth-new-password"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    New Password
                  </label>
                  <Input
                    id="auth-new-password"
                    type="password"
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
              </>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={loading}
            >
              {loading
                ? 'Processing...'
                : mode === 'login'
                ? 'Sign In'
                : mode === 'signup'
                ? 'Create Account'
                : mode === 'forgot'
                ? 'Generate Reset Code'
                : 'Reset Password'}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleDemo}
              disabled={loading}
            >
              Instant Demo Sign-In (Aarav Sharma · INR Data)
            </Button>

            <div className="text-center text-xs text-slate-600 pt-1">
              {mode === 'login' ? (
                <>
                  Don’t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setMode('signup');
                    }}
                    className="font-semibold text-slate-900 hover:underline cursor-pointer"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setMode('login');
                    }}
                    className="font-semibold text-slate-900 hover:underline cursor-pointer"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
