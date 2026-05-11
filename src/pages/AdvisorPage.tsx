import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, AlertCircle, Bot, Info, Camera, Share2, Receipt } from 'lucide-react';
import { BottomNav } from '@/components/budget/BottomNav';
import { useStorage } from '@/hooks/useStorage';
import { useBudget } from '@/hooks/useBudget';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatCurrency } from '@/lib/utils';
import { ADVISOR_DISCLAIMER } from '@/constants/legal';
import { supabase } from '@/integrations/supabase/client';

interface ReceiptData {
  extracted: {
    vendor: string;
    amount: number;
    date: string;
    time: string | null;
    category_id: string;
    items: string[];
    summary: string;
  };
  feedback: string;
  transaction_id: string;
  accountant: { email: string; subject: string; body: string };
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'receipt';
  imageDataUrl?: string;
  receipt?: ReceiptData;
  receiptFile?: File;
}

const WELCOME = `שלום! אני יועץ פיננסי AI של Lazy Finance.

אני מכיר את המצב הפיננסי שלך ויכול לעזור עם:
• האם כדאי לבצע הוצאה מסוימת?
• איפה אפשר לחסוך?
• שאלות על השקעות
• 📸 לחץ על המצלמה — אצלם קבלה, אחלץ נתונים, ארשום אוטומטית

שאל אותי כל שאלה או שלח קבלה!`;

export default function AdvisorPage() {
  useDocumentTitle('יועץ AI');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: WELCOME },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch('/api/advisor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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

  const fileToBase64 = (file: File): Promise<{ base64: string; dataUrl: string }> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const dataUrl = r.result as string;
        const base64 = dataUrl.split(',')[1] || '';
        resolve({ base64, dataUrl });
      };
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });

  const handleReceiptFile = async (file: File) => {
    if (loading) return;
    if (file.size > 8 * 1024 * 1024) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ הקבלה גדולה מדי (מקס 8MB). נסה לצלם שוב באיכות נמוכה יותר.' }]);
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ סוג קובץ לא נתמך. JPG / PNG / WebP בלבד.' }]);
      return;
    }

    setLoading(true);
    setApiError(null);

    let dataUrl = '';
    try {
      const conv = await fileToBase64(file);
      dataUrl = conv.dataUrl;
      setMessages(prev => [
        ...prev,
        { role: 'user', content: '📸 קבלה נשלחה', imageDataUrl: dataUrl, type: 'text' },
      ]);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch('/api/process-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          image: conv.base64,
          mimeType: file.type,
          context: financialContext,
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        if (data.error === 'ANTHROPIC_API_KEY_MISSING') {
          setApiError('missing_key');
        } else if (data.error === 'not_a_receipt') {
          setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ זאת לא נראית כמו קבלה. נסה תמונה ברורה יותר של הקבלה.' }]);
        } else if (data.error === 'image_too_large') {
          setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ הקבלה גדולה מדי. נסה איכות נמוכה יותר.' }]);
        } else if (data.error === 'amount_invalid') {
          setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ לא הצלחתי לזהות את הסכום. ודא שהסכום הסופי מופיע ברור בקבלה.' }]);
        } else {
          setApiError('generic');
        }
        return;
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: '',
          type: 'receipt',
          receipt: data as ReceiptData,
          receiptFile: file,
        },
      ]);
    } catch (err) {
      console.error('Receipt processing failed:', err);
      setApiError('generic');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleReceiptFile(file);
  };

  const shareToAccountant = async (receipt: ReceiptData, imageFile?: File) => {
    const { email, subject, body } = receipt.accountant;
    const shareData: ShareData = { title: subject, text: body };
    if (imageFile && navigator.canShare?.({ files: [imageFile] })) {
      shareData.files = [imageFile];
    }

    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
      }
    }
    const params = new URLSearchParams({ subject, body: body + (imageFile ? '\n\n(צרף את התמונה מהגלריה)' : '') });
    window.location.href = `mailto:${email}?${params.toString()}`;
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

          <div
            className="rounded-xl border p-3 flex items-start gap-2"
            style={{ borderColor: 'rgba(148,163,184,0.2)', background: 'rgba(148,163,184,0.05)' }}
          >
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {ADVISOR_DISCLAIMER}
            </p>
          </div>

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

          {messages.map((m, i) => {
            if (m.type === 'receipt' && m.receipt) {
              const r = m.receipt;
              return (
                <div key={i} className="flex justify-end">
                  <div
                    className="max-w-[85%] rounded-2xl rounded-tl-sm border border-border overflow-hidden"
                    style={{ background: 'rgba(244,63,94,0.06)' }}
                  >
                    <div className="px-4 py-3 border-b border-border/40 flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5" style={{ color: '#f43f5e' }} />
                      <span className="text-[10px] font-semibold" style={{ color: '#f43f5e' }}>קבלה נרשמה</span>
                    </div>
                    <div className="px-4 py-3 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ספק:</span>
                        <span className="font-semibold">{r.extracted.vendor}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">סכום:</span>
                        <span className="font-bold tabular-nums">₪{r.extracted.amount.toLocaleString('he-IL')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">תאריך:</span>
                        <span className="tabular-nums">{r.extracted.date}{r.extracted.time ? ` · ${r.extracted.time}` : ''}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">קטגוריה:</span>
                        <span>{r.extracted.category_id}</span>
                      </div>
                    </div>
                    {r.feedback && (
                      <div className="px-4 py-3 border-t border-border/40 text-sm whitespace-pre-wrap text-foreground/90">
                        💡 {r.feedback}
                      </div>
                    )}
                    <button
                      onClick={() => shareToAccountant(r, m.receiptFile)}
                      className="w-full px-4 py-3 border-t border-border/40 flex items-center justify-center gap-2 text-sm font-semibold transition-colors hover:bg-white/5"
                      style={{ color: '#f43f5e' }}
                    >
                      <Share2 className="w-4 h-4" />
                      שלח לדותן (רואה חשבון)
                    </button>
                  </div>
                </div>
              );
            }

            return (
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
                  {m.imageDataUrl && (
                    <img src={m.imageDataUrl} alt="קבלה" className="rounded-lg mb-2 max-h-48 w-auto" />
                  )}
                  {m.content}
                </div>
              </div>
            );
          })}

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
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={onFileChange}
          className="hidden"
        />
        <div className="max-w-lg mx-auto flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            aria-label="צלם קבלה"
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-40 border border-border hover:bg-accent"
          >
            <Camera className="w-4 h-4" style={{ color: '#f43f5e' }} />
          </button>
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
