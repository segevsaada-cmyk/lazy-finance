import { ChevronRight, ChevronLeft } from 'lucide-react';
import { getMonthLabel } from '@/lib/utils';

interface MonthNavigatorProps {
  year: number;
  month: number; // 1-indexed
  onChange: (year: number, month: number) => void;
}

export function MonthNavigator({ year, month, onChange }: MonthNavigatorProps) {
  const goNext = () => {
    if (month === 12) {
      onChange(year + 1, 1);
    } else {
      onChange(year, month + 1);
    }
  };

  const goPrev = () => {
    if (month === 1) {
      onChange(year - 1, 12);
    } else {
      onChange(year, month - 1);
    }
  };

  return (
    <div className="flex items-center justify-between">
      <button
        onClick={goNext}
        className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
        aria-label="חודש קדימה"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      <h1 className="text-lg font-bold text-foreground">
        {getMonthLabel(year, month)}
      </h1>

      <button
        onClick={goPrev}
        className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
        aria-label="חודש אחורה"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
    </div>
  );
}
