import { useState } from 'react';
import { Settings, Save, Trash2, Download, LogOut, Phone, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { BottomNav } from '@/components/budget/BottomNav';
import { useStorage } from '@/hooks/useStorage';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { settings, updateSettings, transactions } = useStorage();
  const { user, signOut } = useAuth();
  const [income, setIncome] = useState(settings.expectedMonthlyIncome.toString());
  const [threshold, setThreshold] = useState(settings.warningThreshold.toString());
  const [whatsapp, setWhatsapp] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await updateSettings({
      expectedMonthlyIncome: parseFloat(income) || 0,
      warningThreshold: parseFloat(threshold) || 0,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExport = () => {
    const exportData = { transactions, settings };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lazy-finance-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearAll = async () => {
    if (!confirm('בטוח שרוצה למחוק את כל הנתונים? פעולה זו לא ניתנת לביטול.')) return;
    if (!user) return;
    await supabase.from('transactions').delete().eq('user_id', user.id);
    await supabase.from('user_settings').delete().eq('user_id', user.id);
    window.location.reload();
  };

  const handleLinkWhatsapp = async () => {
    if (!user || !whatsapp.trim()) return;
    const normalized = whatsapp.replace(/\D/g, '');
    const phone = normalized.startsWith('0') ? '972' + normalized.slice(1) : normalized;
    const { error } = await supabase
      .from('whatsapp_users')
      .upsert({ user_id: user.id, phone_number: phone });
    if (error) {
      toast.error('שגיאה בשמירת מספר הוואטסאפ');
    } else {
      toast.success(`מספר נשמר! שלח "הי" לבוט כדי להתחיל`);
      setWhatsapp('');
    }
  };

  const totalTransactions = transactions.filter(t => !t.isRecurring).length;
  const recurringCount = transactions.filter(t => t.isRecurring).length;

  return (
    <div dir="rtl" className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-xl font-bold text-foreground">הגדרות</h1>
          {user && (
            <span className="text-xs text-muted-foreground mr-auto truncate max-w-[140px]">{user.email}</span>
          )}
        </div>

        {/* Business type toggle */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="font-semibold text-sm">עוסק מורשה / עסק</p>
                <p className="text-xs text-muted-foreground">מציג חישוב מע״מ 18% בדשבורד</p>
              </div>
            </div>
            <Switch
              checked={settings.isOsekMurshe}
              onCheckedChange={v => updateSettings({ isOsekMurshe: v })}
            />
          </div>
        </div>

        {/* Budget settings */}
        <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <h2 className="font-bold text-foreground">תקציב חודשי</h2>
          <div className="space-y-1.5">
            <Label>הכנסה חודשית צפויה (₪)</Label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="לדוגמה: 12000"
              value={income}
              onChange={e => setIncome(e.target.value)}
              className="text-right text-lg font-bold"
            />
            <p className="text-xs text-muted-foreground">משמש לחישוב אחוז ניצול התקציב</p>
          </div>
          <div className="space-y-1.5">
            <Label>סף אזהרה — יתרה מינימלית (₪)</Label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="לדוגמה: 1000"
              value={threshold}
              onChange={e => setThreshold(e.target.value)}
              className="text-right text-lg font-bold"
            />
            <p className="text-xs text-muted-foreground">כשהיתרה נמוכה מסכום זה — הכרטיסייה תהפוך לכתומה</p>
          </div>
          <Button className="w-full" onClick={handleSave}>
            <Save className="w-4 h-4" />
            {saved ? '✓ נשמר!' : 'שמור הגדרות'}
          </Button>
        </div>

        {/* WhatsApp bot */}
        <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <h2 className="font-bold text-foreground flex items-center gap-2">
            <Phone className="w-4 h-4 text-green-400" />
            בוט WhatsApp
          </h2>
          <p className="text-xs text-muted-foreground">חבר את המספר שלך לרישום תנועות בהודעה</p>
          <div className="flex gap-2">
            <Input
              type="tel"
              placeholder="052-4844686"
              value={whatsapp}
              onChange={e => setWhatsapp(e.target.value)}
              className="text-right"
            />
            <Button variant="outline" onClick={handleLinkWhatsapp} disabled={!whatsapp.trim()}>חבר</Button>
          </div>
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 space-y-1">
            <p className="font-semibold mb-1">דוגמאות:</p>
            <p>💸 <span className="font-mono bg-muted px-1 rounded">קפה 25</span></p>
            <p>💰 <span className="font-mono bg-muted px-1 rounded">קיבלתי 5000 לקוח</span></p>
            <p>📊 <span className="font-mono bg-muted px-1 rounded">יתרה</span></p>
            <p>🧾 <span className="font-mono bg-muted px-1 rounded">מע״מ</span></p>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <h2 className="font-bold text-foreground">סטטיסטיקות</h2>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">תנועות בסך הכל</span>
            <span className="font-semibold">{totalTransactions}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">תשלומים קבועים</span>
            <span className="font-semibold">{recurringCount}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">הכנסה מוגדרת לחודש</span>
            <span className="font-semibold" style={{ color: '#4ade80' }}>
              {formatCurrency(settings.expectedMonthlyIncome)}
            </span>
          </div>
        </div>

        {/* Data + account */}
        <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <h2 className="font-bold text-foreground">חשבון ונתונים</h2>
          <Button variant="outline" className="w-full" onClick={handleExport}>
            <Download className="w-4 h-4" />
            ייצא גיבוי (JSON)
          </Button>
          <Button
            variant="outline"
            className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={handleClearAll}
          >
            <Trash2 className="w-4 h-4" />
            מחק את כל הנתונים
          </Button>
          <Separator />
          <Button variant="outline" className="w-full" onClick={signOut}>
            <LogOut className="w-4 h-4" />
            התנתק
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground pb-4">
          Lazy Finance v0.1 — נתונים מסונכרנים ב-Supabase
        </p>
      </div>
      <BottomNav />
    </div>
  );
}
