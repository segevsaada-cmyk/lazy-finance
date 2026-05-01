import { useState } from 'react';
import { Settings, Save, Trash2, Download, LogOut, Phone, Building2, Users, Link2, Check, ArrowUpRight } from 'lucide-react';
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
import { useNavigate } from 'react-router-dom';

export default function SettingsPage() {
  const { settings, updateSettings, transactions } = useStorage();
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
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
    const blob = new Blob([JSON.stringify({ transactions, settings }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lazy-finance-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearAll = async () => {
    if (!confirm('בטוח? פעולה זו לא ניתנת לביטול.')) return;
    if (!user) return;
    await supabase.from('transactions').delete().eq('user_id', user.id);
    await supabase.from('user_settings').delete().eq('user_id', user.id);
    window.location.reload();
  };

  const handleLinkWhatsapp = async () => {
    if (!user || !whatsapp.trim()) return;
    const normalized = whatsapp.replace(/\D/g, '');
    const phone = normalized.startsWith('0') ? '972' + normalized.slice(1) : normalized;
    const { error } = await supabase.from('whatsapp_users').upsert({ user_id: user.id, phone_number: phone });
    if (error) { toast.error('שגיאה בשמירה'); } else { toast.success('מספר נשמר'); setWhatsapp(''); }
  };

  const totalTransactions = transactions.filter(t => !t.isRecurring).length;
  const recurringCount = transactions.filter(t => t.isRecurring).length;

  const cardClass = 'bg-card rounded-2xl border border-border p-5';

  return (
    <div dir="rtl" className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto px-4 pt-5 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-muted-foreground" />
          <h1 className="text-xl font-bold text-foreground">הגדרות</h1>
          {user && (
            <span className="text-xs text-muted-foreground/60 mr-auto truncate max-w-[160px] font-mono">{user.email}</span>
          )}
        </div>

        {/* Admin panel — only for admins */}
        {isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            className="w-full flex items-center justify-between p-4 rounded-2xl border transition-all hover:bg-accent"
            style={{ borderColor: 'rgba(244,63,94,0.25)', background: 'rgba(244,63,94,0.04)' }}
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" style={{ color: '#f43f5e' }} />
              <span className="font-semibold text-sm text-foreground">ניהול משתמשים</span>
            </div>
            <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
          </button>
        )}

        {/* Business type toggle */}
        <div className={cardClass}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="font-semibold text-sm">עוסק מורשה / עסק</p>
                <p className="text-xs text-muted-foreground">מציג חישוב מע״מ 18%</p>
              </div>
            </div>
            <Switch checked={settings.isOsekMurshe} onCheckedChange={v => updateSettings({ isOsekMurshe: v })} />
          </div>
        </div>

        {/* Budget settings */}
        <div className={`${cardClass} space-y-4`}>
          <h2 className="font-bold text-foreground text-sm">תקציב חודשי</h2>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">הכנסה חודשית צפויה (₪)</Label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="12000"
              value={income}
              onChange={e => setIncome(e.target.value)}
              className="text-right font-mono text-lg font-bold"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">סף אזהרה — יתרה מינימלית (₪)</Label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="1000"
              value={threshold}
              onChange={e => setThreshold(e.target.value)}
              className="text-right font-mono text-lg font-bold"
            />
          </div>
          <Button className="w-full" onClick={handleSave}>
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'נשמר' : 'שמור'}
          </Button>
        </div>

        {/* Coming soon: bank connection */}
        <div
          className="rounded-2xl border p-5 space-y-3"
          style={{ borderColor: 'rgba(244,63,94,0.2)', background: 'rgba(244,63,94,0.03)' }}
        >
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4" style={{ color: '#f43f5e' }} />
            <h2 className="font-bold text-sm text-foreground">חיבור לחשבון הבנק</h2>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full mr-auto" style={{ background: 'rgba(244,63,94,0.15)', color: '#f43f5e' }}>
              בקרוב
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            בקרוב תוכל לחבר את חשבון הבנק וכרטיס האשראי — כל העסקאות יסתנכרנו אוטומטית, ללא הזנה ידנית.
          </p>
        </div>

        {/* WhatsApp bot */}
        <div className={`${cardClass} space-y-3`}>
          <h2 className="font-bold text-sm text-foreground flex items-center gap-2">
            <Phone className="w-4 h-4 text-green-400" />
            בוט WhatsApp
          </h2>
          <p className="text-xs text-muted-foreground">חבר את המספר שלך לרישום תנועות בהודעה</p>
          <div className="flex gap-2">
            <Input type="tel" placeholder="050-0000000" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className="text-right font-mono" />
            <Button variant="outline" onClick={handleLinkWhatsapp} disabled={!whatsapp.trim()}>חבר</Button>
          </div>
          <div className="text-xs text-muted-foreground bg-secondary/50 rounded-xl p-3 space-y-1.5 font-mono">
            <p className="font-sans font-semibold text-foreground/70 mb-2 not-italic">דוגמאות:</p>
            <p><span className="text-muted-foreground/50">›</span> <span className="bg-secondary px-1.5 py-0.5 rounded">קפה 25</span></p>
            <p><span className="text-muted-foreground/50">›</span> <span className="bg-secondary px-1.5 py-0.5 rounded">קיבלתי 5000 לקוח</span></p>
            <p><span className="text-muted-foreground/50">›</span> <span className="bg-secondary px-1.5 py-0.5 rounded">יתרה</span></p>
          </div>
        </div>

        {/* Stats */}
        <div className={`${cardClass} space-y-3`}>
          <h2 className="font-bold text-sm text-foreground">סטטיסטיקות</h2>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">תנועות</span>
            <span className="font-mono font-semibold">{totalTransactions}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">תשלומים קבועים</span>
            <span className="font-mono font-semibold">{recurringCount}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">הכנסה חודשית מוגדרת</span>
            <span className="font-mono font-semibold" style={{ color: '#4ade80' }}>
              {formatCurrency(settings.expectedMonthlyIncome)}
            </span>
          </div>
        </div>

        {/* Account actions */}
        <div className={`${cardClass} space-y-2`}>
          <h2 className="font-bold text-sm text-foreground mb-3">חשבון</h2>
          <Button variant="outline" className="w-full" onClick={handleExport}>
            <Download className="w-4 h-4" />
            ייצא גיבוי (JSON)
          </Button>
          <Button variant="outline" className="w-full text-destructive border-destructive/30 hover:bg-destructive/10" onClick={handleClearAll}>
            <Trash2 className="w-4 h-4" />
            מחק את כל הנתונים
          </Button>
          <Separator />
          <Button variant="outline" className="w-full" onClick={signOut}>
            <LogOut className="w-4 h-4" />
            התנתק
          </Button>
        </div>

        <p className="text-center text-[11px] text-muted-foreground/30 pb-4 font-mono">LAZY FINANCE v1.0</p>
      </div>
      <BottomNav />
    </div>
  );
}
