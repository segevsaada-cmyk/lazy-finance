import { cn } from '@/lib/utils';
import { getCategoriesByType } from '@/constants/categories';
import type { TransactionType } from '@/types/budget';

interface CategoryPickerProps {
  type: TransactionType;
  selected: string;
  onSelect: (id: string) => void;
}

export function CategoryPicker({ type, selected, onSelect }: CategoryPickerProps) {
  const categories = getCategoriesByType(type);

  return (
    <div className="grid grid-cols-4 gap-2">
      {categories.map(cat => (
        <button
          key={cat.id}
          type="button"
          onClick={() => onSelect(cat.id)}
          className={cn(
            'flex flex-col items-center gap-1 py-3 rounded-xl border transition-all duration-150 active:scale-95',
            selected === cat.id
              ? type === 'income'
                ? 'border-[#4ade80] bg-[rgba(74,222,128,0.15)]'
                : 'border-[#fb7185] bg-[rgba(251,113,133,0.15)]'
              : 'border-border bg-secondary hover:bg-accent'
          )}
        >
          <span className="text-2xl">{cat.emoji}</span>
          <span className="text-xs text-foreground font-medium leading-tight text-center">{cat.name}</span>
        </button>
      ))}
    </div>
  );
}
