import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, AlertCircle, Bot } from 'lucide-react';
import { BottomNav } from '@/components/budget/BottomNav';
import { useStorage } from '@/hooks/useStorage';
import { useBudget } from '@/hooks/useBudget';
import { formatCurrency } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const WELCOME = `שלום! אני יועץ פיננסי AI של Lazy Finance.

אני מכיר את המצב הפיננסי שלך ויכול לעזור עם:
• האם כדאי לבצע הוצאה מסוימת?
• איפה אפשר לחסוך?
• שאלות על השקעות
• כל שאלה פיננסית אחרת

שאל אותי כל שאלה!`;

export default function AdvisorPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: WELCOME },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const today = new Date();
  const { transactions, settings } = useStorage();
  const { totalIncome, totalExpenses, balance } = useBudget({
    transactions,
    settings,
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  });

  const financialContext = `חודש נוכחי: ${today.toLocaleString('he-IL', { month: 'long', year: 'numeric' })}
הכנסות: ${formatCurrency(totalIncome)}
הוצאות: ${formatCurrency(totalExpenses)}
יתרה: ${formatCurrency(balance)}
הכנסה חודשית צפויה: ${formatCurrency(settings.expectedMonthlyIncome)}`;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setApiError(null);

    try {
      const res = await fetch('/api/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          context: financialContext,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        if (data.error === 'ANTHROPIC_API_KEY_MISSING') {
          setApiError('missing_key');
        } else {
          setApiError('generic');
        }
        return;
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
    } catch {
      setApiError('generic');
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const SUGGESTIONS = ['כמה אני מוציא על אוכל?', 'איפה אני יכול לחסוך?', 'האם כדאי לי להשקיע?'];

  return (
    <div dir="rtl" className="min-h-screen bg-background flex flex-col pb-16">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-4 flex-shrink-0">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(244,63,94,0.12)' }}
          >
            <Bot className="w-5 h-5" style={{ color: '#f43f5e' }} />
          </div>
          <div>
            <h1 className="font-bold text-sm text-foreground">יועץ פיננסי AI</h1>
            <p className="text-[11px] text-muted-foreground">מבוסס Claude · מכיר את המצב שלך</p>
          </div>

          {/* Financial context strip */}
          <div className="mr-auto flex items-center gap-3 text-[11px] font-mono tabular-nums">
            <span style={{ color: '#4ade80' }}>+{formatCurrency(totalIncome)}</span>
            <span className="text-muted-foreground/40">|</span>
            <span style={{ color: '#fb7185' }}>−{formatCurrency(totalExpenses)}</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-lg mx-auto space-y-4">

          {/* API key missing error */}
          {apiError === 'missing_key' && (
            <div
              className="rounded-xl border p-4 flex items-start gap-3"
              style={{ borderColor: 'rgba(245,158,11,0.25)', background: 'rgba(245,158,11,0.06)' }}
            >
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#f59e0b' }} />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">נדרשת הגדרה חד-פעמית</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  כדי להפעיל את יועץ ה-AI, הוסף את ה-
                  <code className="font-mono bg-secondary px-1 rounded">ANTHROPIC_API_KEY</code>
                  {' '}ב-Vercel → Project Settings → Environment Variables.
                  <br />
                  ניתן לקבל מפתח בחינם ב-console.anthropic.com
                </p>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-secondary text-foreground rounded-tr-sm'
                    : 'text-foreground rounded-tl-sm border border-border'
                }`}
                style={m.role === 'assistant' ? { background: 'rgba(244,63,94,0.06)' } : {}}
              >
                {m.role === 'assistant' && i > 0 && (
                  <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-border/40">
                    <Sparkles className="w-3 h-3" style={{ color: '#f43f5e' }} />
                    <span className="text-[10px] font-semibold" style={{ color: '#f43f5e' }}>יועץ AI</span>
                  </div>
                )}
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-end">
              <div
                className="rounded-2xl rounded-tl-sm border border-border px-4 py-3"
                style={{ background: 'rgba(244,63,94,0.06)' }}
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Suggestion chips — show only at start */}
      {messages.length === 1 && (
        <div className="px-4 pb-3 flex-shrink-0">
          <div className="max-w-lg mx-auto flex gap-2 overflow-x-auto pb-1">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => { setInput(s); inputRef.current?.focus(); }}
                className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border border-border hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border bg-card px-4 py-3 flex-shrink-0" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <div className="max-w-lg mx-auto flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="שאל שאלה פיננסית..."
            disabled={loading}
            className="flex-1 bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-right text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-rose-500/50 disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #be123c, #f43f5e)' }}
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
