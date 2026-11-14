export type ID = string;

export interface Person {
  id: ID;
  name: string;
  createdAt: number;
}

export type GroupType = 'trip' | 'home' | 'couple' | 'friends' | 'other';

export interface Group {
  id: ID;
  name: string;
  type: GroupType;
  currency: string; // ISO code
  memberIds: ID[];
  simplify: boolean;
  createdAt: number;
}

export type SplitType = 'equal' | 'exact' | 'percent' | 'shares' | 'adjust';

/** Amount in minor units (e.g. paise/cents). */
export interface Portion {
  personId: ID;
  amount: number;
}

export interface Expense {
  id: ID;
  /** null = non-group expense between people */
  groupId: ID | null;
  kind: 'expense' | 'payment';
  description: string;
  /** minor units */
  amount: number;
  currency: string;
  /** ISO date yyyy-mm-dd */
  date: string;
  category: string;
  payers: Portion[];
  /** what each person owes (sums to amount) */
  owed: Portion[];
  splitType: SplitType;
  /** raw inputs used to re-open the split editor (percent/shares/adjust/exact values) */
  splitInputs?: Record<ID, number>;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export type ActivityKind =
  | 'expense_added'
  | 'expense_edited'
  | 'expense_deleted'
  | 'payment_added'
  | 'payment_deleted'
  | 'group_created'
  | 'group_deleted'
  | 'member_added'
  | 'member_removed';

export interface Activity {
  id: ID;
  kind: ActivityKind;
  at: number;
  groupId?: ID | null;
  text: string;
}

export interface Settings {
  meId: ID | null;
  defaultCurrency: string;
  theme: 'system' | 'light' | 'dark';
}

export interface AppData {
  version: 1;
  people: Person[];
  groups: Group[];
  expenses: Expense[];
  activity: Activity[];
  settings: Settings;
}
