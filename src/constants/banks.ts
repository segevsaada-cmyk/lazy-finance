// Supported banks and credit-card issuers for the per-user bank scraper.
// Field names mirror israeli-bank-scrapers loginFields exactly — they are
// passed through to scraper.scrape({ ...credentials }) by the scraper.

export type BankFieldType = 'text' | 'password' | 'number';

export interface BankFieldDef {
  key: string;
  label: string;
  type: BankFieldType;
  placeholder?: string;
  hint?: string;
}

export interface BankDef {
  id: string;
  name: string;
  category: 'bank' | 'card';
  fields: BankFieldDef[];
}

const PWD = (label = 'סיסמה'): BankFieldDef => ({ key: 'password', label, type: 'password' });

export const SUPPORTED_BANKS: BankDef[] = [
  {
    id: 'otsarHahayal',
    name: 'אוצר החייל',
    category: 'bank',
    fields: [
      { key: 'username', label: 'שם משתמש', type: 'text' },
      PWD(),
    ],
  },
  {
    id: 'hapoalim',
    name: 'בנק הפועלים',
    category: 'bank',
    fields: [
      { key: 'userCode', label: 'קוד משתמש', type: 'text' },
      PWD(),
    ],
  },
  {
    id: 'leumi',
    name: 'בנק לאומי',
    category: 'bank',
    fields: [
      { key: 'username', label: 'שם משתמש', type: 'text' },
      PWD(),
    ],
  },
  {
    id: 'mizrahi',
    name: 'בנק מזרחי טפחות',
    category: 'bank',
    fields: [
      { key: 'username', label: 'שם משתמש', type: 'text' },
      PWD(),
    ],
  },
  {
    id: 'discount',
    name: 'בנק דיסקונט',
    category: 'bank',
    fields: [
      { key: 'id', label: 'תעודת זהות', type: 'text' },
      PWD(),
      { key: 'num', label: 'מספר משתמש', type: 'text' },
    ],
  },
  {
    id: 'mercantile',
    name: 'בנק מרכנתיל',
    category: 'bank',
    fields: [
      { key: 'id', label: 'תעודת זהות', type: 'text' },
      PWD(),
      { key: 'num', label: 'מספר משתמש', type: 'text' },
    ],
  },
  {
    id: 'beinleumi',
    name: 'הבינלאומי',
    category: 'bank',
    fields: [
      { key: 'username', label: 'שם משתמש', type: 'text' },
      PWD(),
    ],
  },
  {
    id: 'union',
    name: 'בנק איגוד',
    category: 'bank',
    fields: [
      { key: 'username', label: 'שם משתמש', type: 'text' },
      PWD(),
    ],
  },
  {
    id: 'massad',
    name: 'בנק מסד',
    category: 'bank',
    fields: [
      { key: 'username', label: 'שם משתמש', type: 'text' },
      PWD(),
    ],
  },
  {
    id: 'yahav',
    name: 'בנק יהב',
    category: 'bank',
    fields: [
      { key: 'username', label: 'שם משתמש', type: 'text' },
      { key: 'nationalID', label: 'תעודת זהות', type: 'text' },
      PWD(),
    ],
  },
  {
    id: 'pagi',
    name: 'בנק פאג"י',
    category: 'bank',
    fields: [
      { key: 'username', label: 'שם משתמש', type: 'text' },
      PWD(),
    ],
  },
  {
    id: 'beyahadBishvilha',
    name: 'ביחד בשבילך',
    category: 'bank',
    fields: [
      { key: 'id', label: 'תעודת זהות', type: 'text' },
      PWD(),
    ],
  },
  {
    id: 'behatsdaa',
    name: 'בהצדעה',
    category: 'bank',
    fields: [
      { key: 'id', label: 'תעודת זהות', type: 'text' },
      PWD(),
    ],
  },
  {
    id: 'visaCal',
    name: 'ויזה כאל',
    category: 'card',
    fields: [
      { key: 'username', label: 'שם משתמש', type: 'text' },
      PWD(),
    ],
  },
  {
    id: 'max',
    name: 'מאקס (לשעבר לאומי קארד)',
    category: 'card',
    fields: [
      { key: 'username', label: 'שם משתמש', type: 'text' },
      PWD(),
    ],
  },
  {
    id: 'isracard',
    name: 'ישראכרט',
    category: 'card',
    fields: [
      { key: 'id', label: 'תעודת זהות', type: 'text' },
      { key: 'card6Digits', label: '6 ספרות אחרונות של הכרטיס', type: 'text' },
      PWD(),
    ],
  },
  {
    id: 'amex',
    name: 'אמריקן אקספרס',
    category: 'card',
    fields: [
      { key: 'id', label: 'תעודת זהות', type: 'text' },
      { key: 'card6Digits', label: '6 ספרות אחרונות של הכרטיס', type: 'text' },
      PWD(),
    ],
  },
];

export const BANKS_BY_ID: Record<string, BankDef> =
  Object.fromEntries(SUPPORTED_BANKS.map((b) => [b.id, b]));
