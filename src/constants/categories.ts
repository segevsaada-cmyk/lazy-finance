import type { Category } from '@/types/budget';
import {
  Home, Car, ShoppingCart, Utensils, Tv, Activity,
  Smartphone, Laptop, Plane, GraduationCap, Shirt,
  Dumbbell, Sparkles, Gift, Zap, MoreHorizontal,
  Briefcase, PenTool, TrendingUp, Banknote,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  rent: Home,
  car: Car,
  groceries: ShoppingCart,
  food: Utensils,
  entertainment: Tv,
  health: Activity,
  phone: Smartphone,
  tech: Laptop,
  travel: Plane,
  education: GraduationCap,
  clothing: Shirt,
  sport: Dumbbell,
  beauty: Sparkles,
  gifts: Gift,
  utilities: Zap,
  other_expense: MoreHorizontal,
  salary: Briefcase,
  freelance: PenTool,
  investments: TrendingUp,
  gift_income: Gift,
  other_income: Banknote,
};

export const EXPENSE_CATEGORIES: Category[] = [
  { id: 'rent', name: 'שכירות', emoji: 'Home', type: 'expense' },
  { id: 'car', name: 'רכב', emoji: 'Car', type: 'expense' },
  { id: 'groceries', name: 'קניות', emoji: 'ShoppingCart', type: 'expense' },
  { id: 'food', name: 'מסעדות', emoji: 'Utensils', type: 'expense' },
  { id: 'entertainment', name: 'בידור', emoji: 'Tv', type: 'expense' },
  { id: 'health', name: 'בריאות', emoji: 'Activity', type: 'expense' },
  { id: 'phone', name: 'סלולר', emoji: 'Smartphone', type: 'expense' },
  { id: 'tech', name: 'טכנולוגיה', emoji: 'Laptop', type: 'expense' },
  { id: 'travel', name: 'נסיעות', emoji: 'Plane', type: 'expense' },
  { id: 'education', name: 'חינוך', emoji: 'GraduationCap', type: 'expense' },
  { id: 'clothing', name: 'ביגוד', emoji: 'Shirt', type: 'expense' },
  { id: 'sport', name: 'ספורט', emoji: 'Dumbbell', type: 'expense' },
  { id: 'beauty', name: 'יופי', emoji: 'Sparkles', type: 'expense' },
  { id: 'gifts', name: 'מתנות', emoji: 'Gift', type: 'expense' },
  { id: 'utilities', name: 'חשבונות', emoji: 'Zap', type: 'expense' },
  { id: 'other_expense', name: 'אחר', emoji: 'MoreHorizontal', type: 'expense' },
];

export const INCOME_CATEGORIES: Category[] = [
  { id: 'salary', name: 'משכורת', emoji: 'Briefcase', type: 'income' },
  { id: 'freelance', name: 'פרילנס', emoji: 'PenTool', type: 'income' },
  { id: 'investments', name: 'השקעות', emoji: 'TrendingUp', type: 'income' },
  { id: 'gift_income', name: 'מתנה', emoji: 'Gift', type: 'income' },
  { id: 'other_income', name: 'אחר', emoji: 'Banknote', type: 'income' },
];

export const ALL_CATEGORIES: Category[] = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export function getCategoryById(id: string): Category | undefined {
  return ALL_CATEGORIES.find(c => c.id === id);
}

export function getCategoriesByType(type: 'income' | 'expense'): Category[] {
  return type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
}
