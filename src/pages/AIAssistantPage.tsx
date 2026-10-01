import React, { useState, useEffect, useCallback } from 'react';
import { Send, Bot, User as UserIcon, ShieldCheck, CheckCircle2, Info, BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../lib/api.ts';
import type { AIChatMessage, DashboardSummary } from '../shared/types.ts';
import { formatCurrency, formatMonthLabel } from '../shared/format.ts';
import { Button, Input, Card } from '../components/ui/primitives.tsx';

const SUGGESTED_QUESTIONS = [
  'Where did I spend the most this month?',
  'How much did I spend on food?',
  'How much can I save if I reduce dining expenses?',
  'Show me my biggest recurring expenses.',
  'Compare this month with last month.',
  'Give me ideas to reduce unnecessary spending.',
  'Am I staying within my budget?',
];

export function AIAssistantPage() {
  const { user, selectedMonth, notify } = useAuth();
  const cur = user?.currency || 'INR';

  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      id: 'welcome_msg',
      role: 'assistant',
      content: `Hello ${
        user?.name.split(' ')[0] || 'there'
      }. I am your PocketSmart AI financial assistant. I only use your authorized financial records for **${formatMonthLabel(
        selectedMonth
      )}** and separate calculated facts from estimates and general financial education. Ask me anything about your spending, budgets, or savings goals.`,
      createdAt: new Date().toISOString(),
    },
  ]);
  const [questionInput, setQuestionInput] = useState('');
  const [sending, setSending] = useState(false);
  const [contextSummary, setContextSummary] = useState<DashboardSummary | null>(null);

  const loadAuthorizedSnapshot = useCallback(async () => {
    try {
      const res = await apiRequest<DashboardSummary>(
        `/dashboard?month=${encodeURIComponent(selectedMonth)}`
      );
      setContextSummary(res);
    } catch {
      // ignore
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadAuthorizedSnapshot();
  }, [loadAuthorizedSnapshot]);

  const sendQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || sending) return;

    const userMsg: AIChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuestionInput('');
    setSending(true);

    try {
      const res = await apiRequest<{
        answer: string;
        structuredBreakdown: NonNullable<AIChatMessage['structuredBreakdown']>;
      }>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          question: trimmed,
          month: selectedMonth,
        }),
      });

      const aiMsg: AIChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: res.answer,
        createdAt: new Date().toISOString(),
        structuredBreakdown: res.structuredBreakdown,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'AI Assistant Error',
        description: err.message,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            AI Financial Assistant · {formatMonthLabel(selectedMonth)}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Answers grounded strictly in your authenticated ledger with transparent fact vs. estimate separation
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-700 font-medium">
          <ShieldCheck className="h-4 w-4" />
          <span>Isolated User Data Context Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Chat Interface */}
        <Card className="lg:col-span-8 flex flex-col h-[640px] overflow-hidden">
          {/* Suggested Prompts Bar */}
          <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3">
            <p className="text-[11px] font-semibold text-slate-500 mb-2">
              Suggested Financial Questions:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={sending}
                  onClick={() => sendQuestion(q)}
                  className="px-2.5 py-1 rounded-md border border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${
                  msg.role === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    msg.role === 'assistant'
                      ? 'bg-slate-900 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <Bot className="h-4 w-4" />
                  ) : (
                    <UserIcon className="h-4 w-4" />
                  )}
                </div>

                <div
                  className={`max-w-[85%] rounded-xl p-4 text-xs leading-relaxed space-y-3 ${
                    msg.role === 'assistant'
                      ? 'border border-slate-200 bg-white text-slate-800'
                      : 'bg-slate-900 text-white'
                  }`}
                >
                  <div className="whitespace-pre-line">{msg.content}</div>

                  {/* Transparent AI Safety Breakdown */}
                  {msg.structuredBreakdown && (
                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      {msg.structuredBreakdown.calculatedFacts.length > 0 && (
                        <div className="rounded-lg bg-slate-50 p-3 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-900">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Calculated Facts (From Your Authorized Ledger)</span>
                          </div>
                          <ul className="space-y-1 pl-5 list-disc text-[11px] text-slate-700 font-mono tabular-nums">
                            {msg.structuredBreakdown.calculatedFacts.map((f, i) => (
                              <li key={i}>{f}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {msg.structuredBreakdown.estimatesAndAssumptions.length > 0 && (
                        <div className="rounded-lg bg-amber-50/70 p-3 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-900">
                            <Info className="h-3.5 w-3.5 text-amber-600" />
                            <span>Estimates & Assumptions (Hypothetical Scenarios)</span>
                          </div>
                          <ul className="space-y-1 pl-5 list-disc text-[11px] text-amber-900">
                            {msg.structuredBreakdown.estimatesAndAssumptions.map(
                              (e, i) => (
                                <li key={i}>{e}</li>
                              )
                            )}
                          </ul>
                        </div>
                      )}

                      {msg.structuredBreakdown.financialEducation.length > 0 && (
                        <div className="rounded-lg bg-slate-50 p-3 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                            <BookOpen className="h-3.5 w-3.5 text-slate-500" />
                            <span>Financial Education Note</span>
                          </div>
                          <ul className="space-y-1 pl-5 list-disc text-[11px] text-slate-500">
                            {msg.structuredBreakdown.financialEducation.map(
                              (ed, i) => (
                                <li key={i}>{ed}</li>
                              )
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
                  <Bot className="h-4 w-4 animate-pulse" />
                </div>
                <span>Analyzing your verified {formatMonthLabel(selectedMonth)} metrics...</span>
              </div>
            )}
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendQuestion(questionInput);
            }}
            className="border-t border-slate-200 p-4 bg-white flex items-center gap-2.5"
          >
            <Input
              type="text"
              placeholder="Ask about your expenses, budgets, recurring bills, or savings rate..."
              value={questionInput}
              onChange={(e) => setQuestionInput(e.target.value)}
              disabled={sending}
            />
            <Button type="submit" variant="primary" disabled={sending || !questionInput.trim()}>
              <Send className="h-4 w-4" />
              <span>Send</span>
            </Button>
          </form>
        </Card>

        {/* Right Column: Authorized Financial Context Snapshot */}
        <Card className="lg:col-span-4 p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Authorized Data Context
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Deterministic numbers supplied to the assistant for {formatMonthLabel(selectedMonth)}
            </p>
          </div>

          {contextSummary ? (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Total Balance</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {formatCurrency(contextSummary.totalBalance, cur)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Monthly Income</span>
                <span className="font-mono tabular-nums font-semibold text-emerald-700">
                  {formatCurrency(contextSummary.monthlyIncome, cur)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Monthly Expenses</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {formatCurrency(contextSummary.monthlyExpenses, cur)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Net Savings ({contextSummary.savingsRate}%)</span>
                <span className="font-mono tabular-nums font-semibold text-emerald-700">
                  {formatCurrency(contextSummary.netSavings, cur)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Remaining Budget</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {formatCurrency(contextSummary.remainingBudget, cur)}
                </span>
              </div>

              {contextSummary.categorySpending.length > 0 && (
                <div className="pt-2 space-y-2">
                  <p className="text-[11px] font-semibold text-slate-700">
                    Top Categories This Month:
                  </p>
                  {contextSummary.categorySpending.slice(0, 4).map((c) => (
                    <div
                      key={c.categoryId}
                      className="flex items-center justify-between text-[11px]"
                    >
                      <span className="text-slate-600">{c.categoryName}</span>
                      <span className="font-mono tabular-nums text-slate-900">
                        {formatCurrency(c.amount, cur)} ({c.sharePercent}%)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Loading financial context...</p>
          )}

          <div className="rounded-lg bg-slate-50 p-3 text-[11px] text-slate-500 leading-relaxed">
            <strong>AI Safety Notice:</strong> PocketSmart AI uses deterministic
            server-side math for all ledger totals and never accesses another user’s
            data. Guidance is educational and does not constitute guaranteed financial
            outcomes.
          </div>
        </Card>
      </div>
    </div>
  );
}
