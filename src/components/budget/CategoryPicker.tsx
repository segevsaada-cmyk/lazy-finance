import { cn } from '@/lib/utils';
import { getCategoriesByType, CATEGORY_ICON_MAP } from '@/constants/categories';
import { MoreHorizontal } from 'lucide-react';
import type { TransactionType } from '@/types/budget';

interface CategoryPickerProps {
  type: TransactionType;
  selected: string;
  onSelect: (id: string) => void;
}

export function CategoryPicker({ type, selected, onSelect }: CategoryPickerProps) {
  const categories = getCategoriesByType(type);
  const activeColor = type === 'income' ? '#4ade80' : '#fb7185';
  const activeBg = type === 'income' ? 'rgba(74,222,128,0.10)' : 'rgba(251,113,133,0.10)';

  return (
    <div className="grid grid-cols-4 gap-2">
      {categories.map(cat => {
        const Icon = CATEGORY_ICON_MAP[cat.id] ?? MoreHorizontal;
        const isSelected = selected === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.id)}
            className={cn(
              'flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all duration-150 active:scale-95',
              isSelected ? 'border-current' : 'border-border bg-secondary hover:bg-accent'
            )}
            style={isSelected ? { borderColor: activeColor, background: activeBg } : {}}
          >
            <Icon
              className="w-5 h-5"
              style={{ color: isSelected ? activeColor : undefined }}
            />
            <span
              className="text-[10px] font-medium leading-tight text-center"
              style={{ color: isSelected ? activeColor : undefined }}
            >
              {cat.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
