import { useEffect, useState } from 'react';
import { Link2, Loader2, Plus, Trash2, CheckCircle2, AlertCircle, Pause, Play } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SUPPORTED_BANKS, BANKS_BY_ID, type BankDef } from '@/constants/banks';
import { toast } from 'sonner';

interface ConnectionRow {
  id: string;
  bank_id: string;
  display_name: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_error: string | null;
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'עדיין לא רץ';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'לפני רגע';
  if (mins < 60) return `לפני ${mins} ד׳`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} ש׳`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
}

export function BankConnectionCard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ConnectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selectedBank, setSelectedBank] = useState<BankDef | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('bank_connections')
      .select('id, bank_id, display_name, is_active, last_sync_at, last_sync_status, last_error')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error && data) setRows(data as ConnectionRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const handleSelectBank = (bank: BankDef) => {
    setSelectedBank(bank);
    setFieldValues(Object.fromEntries(bank.fields.map((f) => [f.key, ''])));
  };

  const handleSubmit = async () => {
    if (!selectedBank) return;
    for (const f of selectedBank.fields) {
      if (!fieldValues[f.key]?.trim()) {
        toast.error(`חסר שדה: ${f.label}`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('connect-bank', {
        body: { bank_id: selectedBank.id, credentials: fieldValues },
      });
      if (error || (data as any)?.error) {
        toast.error((data as any)?.error || error?.message || 'שגיאה בחיבור');
      } else {
        toast.success(`${selectedBank.name} חובר בהצלחה`);
        setAdding(false);
        setSelectedBank(null);
        setFieldValues({});
        await load();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row: ConnectionRow) => {
    const bank = BANKS_BY_ID[row.bank_id];
    if (!confirm(`לנתק את ${bank?.name ?? row.bank_id}? הסיסמה תימחק.`)) return;
    const { error } = await supabase.from('bank_connections').delete().eq('id', row.id);
    if (error) toast.error('שגיאה במחיקה');
    else {
      toast.success('נותק');
      await load();
    }
  };

  const handleToggle = async (row: ConnectionRow) => {
    const { error } = await supabase
      .from('bank_connections')
      .update({ is_active: !row.is_active })
      .eq('id', row.id);
    if (error) toast.error('שגיאה');
    else await load();
  };

  return (
    <div
      className="rounded-2xl border p-5 space-y-4"
      style={{ borderColor: 'rgba(244,63,94,0.2)', background: 'rgba(244,63,94,0.03)' }}
    >
      <div className="flex items-center gap-2">
        <Link2 className="w-4 h-4" style={{ color: '#f43f5e' }} />
        <h2 className="font-bold text-sm text-foreground">חיבור לחשבון הבנק</h2>
        {!adding && (
          <Button
            size="sm"
            variant="outline"
            className="mr-auto h-7 text-xs"
            onClick={() => setAdding(true)}
          >
            <Plus className="w-3 h-3" />
            חבר בנק
          </Button>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && rows.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          חבר את חשבון הבנק או כרטיסי האשראי — כל העסקאות יסתנכרנו אוטומטית כל בוקר, ללא הזנה ידנית.
          הסיסמאות מוצפנות (AES-256) ולא נשמרות בטקסט גלוי בשום מקום.
        </p>
      )}

      {/* Existing connections */}
      {rows.map((row) => {
        const bank = BANKS_BY_ID[row.bank_id];
        const failed = row.last_sync_status === 'error';
        return (
          <div
            key={row.id}
            className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{bank?.name ?? row.bank_id}</span>
                {row.is_active ? (
                  failed ? (
                    <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  )
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                    מושהה
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                סנכרון אחרון: {formatRelative(row.last_sync_at)}
              </p>
              {failed && row.last_error && (
                <p className="text-[11px] text-destructive mt-1 truncate">{row.last_error}</p>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => handleToggle(row)}
              title={row.is_active ? 'השהה סנכרון' : 'חדש סנכרון'}
            >
              {row.is_active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive"
              onClick={() => handleDelete(row)}
              title="נתק ומחק סיסמה"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        );
      })}

      {/* Add new connection form */}
      {adding && (
        <div className="space-y-3 pt-2 border-t border-border">
          {!selectedBank && (
            <div className="space-y-2">
              <Label className="text-xs">בחר בנק או חברת אשראי</Label>
              <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto">
                {SUPPORTED_BANKS.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => handleSelectBank(b)}
                    className="text-right px-3 py-2 rounded-lg bg-secondary/40 hover:bg-secondary text-xs font-medium transition-colors"
                  >
                    {b.name}
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setAdding(false)}>
                ביטול
              </Button>
            </div>
          )}

          {selectedBank && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{selectedBank.name}</span>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedBank(null)}>
                  שנה בנק
                </Button>
              </div>
              {selectedBank.fields.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{f.label}</Label>
                  <Input
                    type={f.type === 'password' ? 'password' : 'text'}
                    value={fieldValues[f.key] ?? ''}
                    onChange={(e) =>
                      setFieldValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                    }
                    autoComplete="off"
                    className="text-right font-mono"
                  />
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground leading-relaxed bg-secondary/40 rounded-lg p-2.5">
                🔒 הפרטים נשלחים לשרת מוצפן ונשמרים מוצפנים בלבד. הסקרייפר היחיד שמפענח אותם רץ
                פעם ביום על שרת מבודד.
              </p>
              <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'חבר ושמור'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
