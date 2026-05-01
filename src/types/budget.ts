export type TransactionType = 'income' | 'expense';
export type AccountType = 'private' | 'business';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  note?: string;
  date: string; // 'YYYY-MM-DD'
  isRecurring: boolean;
  recurringDayOfMonth?: number; // 1–31, only for recurring templates
  recurringParentId?: string;   // links a logged instance to its recurring template
  accountType: AccountType;     // private / business — defaults to 'private' for legacy rows
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  type: TransactionType;
}

export interface AppSettings {
  expectedMonthlyIncome: number;
  warningThreshold: number; // show warning when balance drops below this
  isOsekMurshe: boolean;    // עוסק מורשה — shows VAT card
}

export interface AppData {
  transactions: Transaction[];
  settings: AppSettings;
}

export type BalanceStatus = 'ok' | 'warning' | 'danger';
