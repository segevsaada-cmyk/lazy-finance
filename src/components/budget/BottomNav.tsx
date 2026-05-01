import { Link, useLocation } from 'react-router-dom';
import { Home, Settings, Target, Compass, BarChart3, List } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'בית' },
  { to: '/reports', icon: BarChart3, label: 'דוחות' },
  { to: '/goals', icon: Target, label: 'מטרות' },
  { to: '/liberation', icon: Compass, label: 'שחרור' },
  { to: '/history', icon: List, label: 'תנועות' },
  { to: '/settings', icon: Settings, label: 'הגדרות' },
];

export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border safe-area-pb">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex flex-col items-center gap-1 py-3 px-3 transition-all',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn('w-5 h-5', active && 'scale-110')} />
              <span className="text-xs font-medium">{label}</span>
              {active && <div className="w-1 h-1 rounded-full bg-primary" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
