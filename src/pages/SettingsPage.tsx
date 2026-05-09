import { useState } from 'react';
import { Settings, Save, Trash2, Download, LogOut, Phone, Building2, Users, Check, ArrowUpRight, Link2, AlertTriangle, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BottomNav } from '@/components/budget/BottomNav';
import { BankConnectionCard } from '@/components/budget/BankConnectionCard';
import { useStorage } from '@/hooks/useStorage';
import { useAuth } from '@/hooks/useAuth';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function SettingsPage() {
  useDocumentTitle('הגדרות');
  const { settings, updateSettings, transactions } = useStorage();
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [income, setIncome] = useState(settings.expectedMonthlyIncome.toString());
  const [threshold, setThreshold] = useState(settings.warningThreshold.toString());
  const [whatsapp, setWhatsapp] = useState('');
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    await updateSettings({
      expectedMonthlyIncome: parseFloat(income) || 0,
      warningThreshold: parseFloat(threshold) || 0,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Full server-side export: hits /api/export-my-data which returns
  // every per-user row from Supabase (not just the cached client state).
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const r = await fetch('/api/export-my-data', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) {
        toast.error('הייצוא נכשל. נסה שוב.');
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lazy-finance-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('הקובץ ירד');
    } catch (e) {
      toast.error('הייצוא נכשל');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const r = await fetch('/api/delete-my-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ confirm: 'DELETE' }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(j.message || 'מחיקה נכשלה');
        return;
      }
      toast.success('החשבון נמחק. להתראות 👋');
      setDeleteOpen(false);
      await supabase.auth.signOut();
      navigate('/auth');
    } catch (e) {
      toast.error('מחיקה נכשלה');
    } finally {
      setDeleting(false);
    }
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

        {/* Bank connection — gated to admin until owner finishes validating his own account */}
        {isAdmin ? (
          <BankConnectionCard />
        ) : (
          <div
            className="rounded-2xl border p-5 space-y-2"
            style={{ borderColor: 'rgba(244,63,94,0.2)', background: 'rgba(244,63,94,0.03)' }}
          >
            <h2 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Link2 className="w-4 h-4" style={{ color: '#f43f5e' }} />
              בקרוב — חיבור לחשבון הבנק
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              בקרוב תוכל לחבר את חשבון הבנק וכרטיסי האשראי — כל העסקאות יסתנכרנו אוטומטית כל בוקר, ללא הזנה ידנית.
            </p>
          </div>
        )}

        {/* WhatsApp bot — admin only for now */}
        {isAdmin ? (
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
        ) : (
          <div className={`${cardClass} space-y-2`}>
            <h2 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              בקרוב — בוט גם בוואטסאפ
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              בקרוב תוכל לרשום תנועות ולשאול שאלות פיננסיות ישירות בהודעה בוואטסאפ.
              עד אז ההזנה דרך הצ׳אט באפליקציה זהה לחלוטין.
            </p>
          </div>
        )}

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
          <Button variant="outline" className="w-full" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? 'מייצא…' : 'ייצא את כל הנתונים שלי (JSON)'}
          </Button>
          <p className="text-[11px] text-muted-foreground/70 px-1 leading-relaxed">
            כל הנתונים שלך — תנועות, מטרות, חיבורי בנק, היסטוריה — בקובץ אחד. בהתאם לחוק הגנת הפרטיות.
          </p>
          <Separator />
          <Button
            variant="outline"
            className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => { setDeleteConfirm(''); setDeleteOpen(true); }}
          >
            <Trash2 className="w-4 h-4" />
            מחק את החשבון לצמיתות
          </Button>
          <Separator />
          <Button variant="outline" className="w-full" onClick={signOut}>
            <LogOut className="w-4 h-4" />
            התנתק
          </Button>
        </div>

        <p className="text-center text-[11px] text-muted-foreground/30 pb-4 font-mono">LAZY FINANCE v1.0</p>
      </div>

      {/* Account-deletion confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={(o) => { if (!deleting) setDeleteOpen(o); }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              מחיקת חשבון לצמיתות
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm leading-relaxed space-y-2 text-right text-muted-foreground">
            <p>פעולה זו אינה ניתנת לביטול. תימחק כל המידע שלך:</p>
            <p className="text-foreground/80 text-xs leading-relaxed">
              • כל התנועות וההוצאות הקבועות<br />
              • המטרות הפיננסיות<br />
              • חיבורי הבנק (כולל מפתחות מוצפנים)<br />
              • הקישור לוואטסאפ<br />
              • הפרופיל וחשבון ההתחברות
            </p>
            <p className="pt-2 text-foreground">להמשך, הקלד <b>מחק</b> בתיבה למטה:</p>
          </div>
          <Input
            type="text"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="מחק"
            className="text-right font-bold"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              ביטול
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteConfirm.trim() !== 'מחק' || deleting}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              מחק לצמיתות
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
