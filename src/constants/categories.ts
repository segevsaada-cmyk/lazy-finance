import type { Category } from '@/types/budget';

export const EXPENSE_CATEGORIES: Category[] = [
  { id: 'rent', name: 'שכירות', emoji: '🏠', type: 'expense' },
  { id: 'car', name: 'רכב', emoji: '🚗', type: 'expense' },
  { id: 'groceries', name: 'קניות', emoji: '🛒', type: 'expense' },
  { id: 'food', name: 'מסעדות', emoji: '🍕', type: 'expense' },
  { id: 'entertainment', name: 'בידור', emoji: '🎮', type: 'expense' },
  { id: 'health', name: 'בריאות', emoji: '💊', type: 'expense' },
  { id: 'phone', name: 'סלולר', emoji: '📱', type: 'expense' },
  { id: 'tech', name: 'טכנולוגיה', emoji: '💻', type: 'expense' },
  { id: 'travel', name: 'נסיעות', emoji: '✈️', type: 'expense' },
  { id: 'education', name: 'חינוך', emoji: '📚', type: 'expense' },
  { id: 'clothing', name: 'ביגוד', emoji: '👗', type: 'expense' },
  { id: 'sport', name: 'ספורט', emoji: '🏋️', type: 'expense' },
  { id: 'beauty', name: 'יופי', emoji: '💈', type: 'expense' },
  { id: 'gifts', name: 'מתנות', emoji: '🎁', type: 'expense' },
  { id: 'utilities', name: 'חשבונות', emoji: '⚡', type: 'expense' },
  { id: 'other_expense', name: 'אחר', emoji: '📎', type: 'expense' },
];

export const INCOME_CATEGORIES: Category[] = [
  { id: 'salary', name: 'משכורת', emoji: '💼', type: 'income' },
  { id: 'freelance', name: 'פרילנס', emoji: '💰', type: 'income' },
  { id: 'investments', name: 'השקעות', emoji: '📈', type: 'income' },
  { id: 'gift_income', name: 'מתנה', emoji: '🎁', type: 'income' },
  { id: 'other_income', name: 'אחר', emoji: '💵', type: 'income' },
];

export const ALL_CATEGORIES: Category[] = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export function getCategoryById(id: string): Category | undefined {
  return ALL_CATEGORIES.find(c => c.id === id);
}

export function getCategoriesByType(type: 'income' | 'expense'): Category[] {
  return type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
}
