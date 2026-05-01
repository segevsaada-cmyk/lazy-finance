import { useState, useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { CategoryPicker } from '@/components/budget/CategoryPicker';
import { todayStr } from '@/lib/utils';
import type { AccountType, Transaction, TransactionType } from '@/types/budget';

interface AddTransactionSheetProps {
  open: boolean;
  onClose: () => void;
  onSave: (tx: Omit<Transaction, 'id'>) => void;
  defaultType?: TransactionType;
  editTemplate?: Transaction | null; // for editing recurring
}

export function AddTransactionSheet({
  open,
  onClose,
  onSave,
  defaultType = 'expense',
  editTemplate,
}: AddTransactionSheetProps) {
  const [type, setType] = useState<TransactionType>(defaultType);
  const [accountType, setAccountType] = useState<AccountType>('private');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayStr());
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringDay, setRecurringDay] = useState('1');
  const amountRef = useRef<HTMLInputElement>(null);

  // Reset form when opened
  useEffect(() => {
    if (open) {
      if (editTemplate) {
        setType(editTemplate.type);
        setAccountType(editTemplate.accountType);
        setAmount(editTemplate.amount.toString());
        setCategoryId(editTemplate.categoryId);
        setNote(editTemplate.note ?? '');
        setDate(editTemplate.date);
        setIsRecurring(true);
        setRecurringDay(editTemplate.recurringDayOfMonth?.toString() ?? '1');
      } else {
        setType(defaultType);
        setAccountType('private');
        setAmount('');
        setCategoryId('');
        setNote('');
        setDate(todayStr());
        setIsRecurring(false);
        setRecurringDay('1');
      }
      setTimeout(() => amountRef.current?.focus(), 200);
    }
  }, [open, defaultType, editTemplate]);

  // Reset category when type changes
  useEffect(() => {
    setCategoryId('');
  }, [type]);

  const canSubmit = amount !== '' && parseFloat(amount) > 0 && categoryId !== '';

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSave({
      type,
      accountType,
      amount: parseFloat(amount),
      categoryId,
      note: note.trim() || undefined,
      date,
      isRecurring,
      recurringDayOfMonth: isRecurring ? parseInt(recurringDay) : undefined,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="pb-6 max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editTemplate ? 'עריכת תשלום קבוע' : 'הוספת תנועה'}</DialogTitle>
        </DialogHeader>

        <div className="px-5 space-y-5">
          {/* Type toggle */}
          <div className="flex rounded-xl overflow-hidden border border-border">
            <button
              type="button"
              className={`flex-1 py-3 text-sm font-bold transition-all ${
                type === 'expense'
                  ? 'bg-[rgba(251,113,133,0.2)] text-[#fb7185]'
                  : 'bg-transparent text-muted-foreground hover:bg-accent'
              }`}
              onClick={() => setType('expense')}
            >
              💸 הוצאה
            </button>
            <button
              type="button"
              className={`flex-1 py-3 text-sm font-bold transition-all ${
                type === 'income'
                  ? 'bg-[rgba(74,222,128,0.2)] text-[#4ade80]'
                  : 'bg-transparent text-muted-foreground hover:bg-accent'
              }`}
              onClick={() => setType('income')}
            >
              💰 הכנסה
            </button>
          </div>

          {/* Account toggle */}
          <div className="flex rounded-xl overflow-hidden border border-border">
            <button
              type="button"
              className={`flex-1 py-2.5 text-xs font-bold transition-all ${
                accountType === 'private'
                  ? 'bg-secondary text-foreground'
                  : 'bg-transparent text-muted-foreground hover:bg-accent'
              }`}
              onClick={() => setAccountType('private')}
            >
              🏠 פרטי
            </button>
            <button
              type="button"
              className={`flex-1 py-2.5 text-xs font-bold transition-all ${
                accountType === 'business'
                  ? 'bg-secondary text-foreground'
                  : 'bg-transparent text-muted-foreground hover:bg-accent'
              }`}
              onClick={() => setAccountType('business')}
            >
              💼 עסקי
            </button>
          </div>

          {/* Amount input */}
          <div className="space-y-1.5">
            <Label>סכום (₪)</Label>
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-2xl font-black text-muted-foreground select-none">
                ₪
              </span>
              <Input
                ref={amountRef}
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="text-right text-3xl font-black h-16 pr-10 pl-3"
                style={{ fontSize: '2rem' }}
              />
            </div>
          </div>

          {/* Category picker */}
          <div className="space-y-2">
            <Label>קטגוריה</Label>
            <CategoryPicker type={type} selected={categoryId} onSelect={setCategoryId} />
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label>הערה (אופציונלי)</Label>
            <Input
              placeholder="לדוגמה: אמזון, קופיקס..."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label>תאריך</Label>
            <Input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="text-right"
            />
          </div>

          {/* Recurring toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <div className="font-semibold text-sm">תשלום קבוע חודשי</div>
              <div className="text-xs text-muted-foreground">יופיע כל חודש לאישור</div>
            </div>
            <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
          </div>

          {/* Recurring day */}
          {isRecurring && (
            <div className="space-y-1.5">
              <Label>יום בחודש</Label>
              <Input
                type="number"
                inputMode="numeric"
                min="1"
                max="31"
                value={recurringDay}
                onChange={e => setRecurringDay(e.target.value)}
                className="w-24 text-center"
              />
            </div>
          )}

          {/* Submit button */}
          <Button
            className="w-full"
            size="lg"
            disabled={!canSubmit}
            onClick={handleSubmit}
            style={
              canSubmit
                ? {
                    background:
                      type === 'income'
                        ? 'linear-gradient(135deg, #16a34a, #22c55e)'
                        : 'linear-gradient(135deg, #e11d48, #f43f5e)',
                  }
                : {}
            }
          >
            <Check className="w-5 h-5" />
            {editTemplate ? 'שמור שינויים' : type === 'income' ? 'הוסף הכנסה' : 'הוסף הוצאה'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
