import { useState, useEffect, useRef } from 'react';
import { Send, Bot, Sparkles, MessageSquarePlus } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ALL_CATEGORIES, CATEGORY_ICON_MAP } from '@/constants/categories';
import { todayStr, formatCurrency } from '@/lib/utils';
import type { Transaction } from '@/types/budget';

interface ChatTransactionSheetProps {
  open: boolean;
  onClose: () => void;
  onSave: (tx: Omit<Transaction, 'id'>) => Promise<Transaction | null> | void;
  onSwitchToForm: () => void;
}

type ChatMsg =
  | { id: string; role: 'bot'; text: string }
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'saved'; tx: Transaction };

const WELCOME =
  'תכתוב לי בקצרה על העסקה. למשל "קניתי קפה ב-22 ש"ח" או "קיבלתי משכורת 8500".';

export function ChatTransactionSheet({
  open,
  onClose,
  onSave,
  onSwitchToForm,
}: ChatTransactionSheetProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setMessages([{ id: 'welcome', role: 'bot', text: WELCOME }]);
    setInput('');
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const userMsgId = `u-${Date.now()}`;
    setMessages(m => [...m, { id: userMsgId, role: 'user', text }]);
    setInput('');
    setBusy(true);

    try {
      const r = await fetch('/api/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setMessages(m => [...m, { id: `b-${Date.now()}`, role: 'bot', text: j.error ? `שגיאה: ${j.error}` : 'משהו השתבש. נסה שוב.' }]);
        setBusy(false);
        return;
      }
      const result = await r.json();

      if (result.needsClarification) {
        setMessages(m => [...m, { id: `b-${Date.now()}`, role: 'bot', text: result.question || 'אפשר עוד פרט?' }]);
        setBusy(false);
        return;
      }

      const tx: Omit<Transaction, 'id'> = {
        type: result.type,
        amount: Number(result.amount),
        categoryId: result.categoryId,
        note: result.note || undefined,
        date: todayStr(),
        isRecurring: false,
        accountType: 'private',
      };
      const saved = await onSave(tx);
      const display: Transaction = saved && (saved as Transaction).id
        ? (saved as Transaction)
        : { ...tx, id: `local-${Date.now()}` };
      setMessages(m => [...m, { id: `s-${Date.now()}`, role: 'saved', tx: display }]);
    } catch (err) {
      setMessages(m => [...m, { id: `b-${Date.now()}`, role: 'bot', text: 'תקלה ברשת. נסה שוב.' }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        dir="rtl"
        className="max-w-md p-0 gap-0 h-[80vh] sm:h-[600px] flex flex-col bg-background border-border"
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(244,63,94,0.12)' }}>
              <Bot className="w-4 h-4" style={{ color: '#f43f5e' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold">הזנה חכמה</h2>
              <p className="text-[10px] text-muted-foreground">תאר עסקה ואני אקטלג אותה</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSwitchToForm}
            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            טופס מלא
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5 scrollbar-thin">
          {messages.map(m => (
            <ChatBubble key={m.id} msg={m} />
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="bg-secondary px-3 py-2 rounded-2xl rounded-tr-sm">
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={submit} className="border-t border-border/60 p-3 flex gap-2 shrink-0">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="לדוגמה: קניתי קפה ב-22 ש״ח"
            disabled={busy}
            className="flex-1 text-right"
            autoFocus
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="px-3 rounded-lg flex items-center justify-center text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #be123c, #f43f5e)' }}
            aria-label="שלח"
          >
            <Send className="w-4 h-4 rotate-180" />
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ChatBubble({ msg }: { msg: ChatMsg }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-rose-500/15 text-foreground px-3 py-2 rounded-2xl rounded-tl-sm text-sm">
          {msg.text}
        </div>
      </div>
    );
  }
  if (msg.role === 'bot') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] bg-secondary px-3 py-2 rounded-2xl rounded-tr-sm text-sm text-foreground/90">
          {msg.text}
        </div>
      </div>
    );
  }
  // saved
  const cat = ALL_CATEGORIES.find(c => c.id === msg.tx.categoryId);
  const Icon = cat ? CATEGORY_ICON_MAP[cat.id] : null;
  const isExpense = msg.tx.type === 'expense';
  return (
    <div className="flex justify-start">
      <div
        className="max-w-[85%] px-3 py-2.5 rounded-2xl rounded-tr-sm text-sm flex items-center gap-2.5 border"
        style={{
          background: isExpense ? 'rgba(244,63,94,0.06)' : 'rgba(34,197,94,0.06)',
          borderColor: isExpense ? 'rgba(244,63,94,0.2)' : 'rgba(34,197,94,0.2)',
        }}
      >
        <Sparkles className="w-4 h-4 shrink-0" style={{ color: isExpense ? '#f43f5e' : '#22c55e' }} />
        <div className="flex-1 leading-tight">
          <p className="text-xs text-muted-foreground">נרשם {isExpense ? 'הוצאה' : 'הכנסה'}:</p>
          <p className="font-semibold flex items-center gap-1.5">
            {Icon && <Icon className="w-3.5 h-3.5" />}
            <span>{cat?.name || msg.tx.categoryId}</span>
            <span className="text-foreground/50">·</span>
            <span style={{ color: isExpense ? '#f43f5e' : '#22c55e' }}>{formatCurrency(msg.tx.amount)}</span>
          </p>
          {msg.tx.note && <p className="text-[11px] text-muted-foreground mt-0.5">{msg.tx.note}</p>}
        </div>
      </div>
    </div>
  );
}
