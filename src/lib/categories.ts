export interface Category {
  id: string;
  label: string;
  emoji: string;
}

export const CATEGORIES: Category[] = [
  { id: 'general', label: 'General', emoji: '🧾' },
  { id: 'food', label: 'Food & drink', emoji: '🍽️' },
  { id: 'groceries', label: 'Groceries', emoji: '🛒' },
  { id: 'rent', label: 'Rent', emoji: '🏠' },
  { id: 'utilities', label: 'Utilities', emoji: '💡' },
  { id: 'transport', label: 'Transport', emoji: '🚕' },
  { id: 'fuel', label: 'Fuel', emoji: '⛽' },
  { id: 'travel', label: 'Travel & stay', emoji: '✈️' },
  { id: 'entertainment', label: 'Entertainment', emoji: '🎬' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { id: 'health', label: 'Health', emoji: '💊' },
  { id: 'gifts', label: 'Gifts', emoji: '🎁' },
  { id: 'other', label: 'Other', emoji: '📦' },
];

export const PAYMENT_CATEGORY: Category = { id: 'payment', label: 'Payment', emoji: '💸' };

export const categoryOf = (id: string): Category =>
  id === 'payment' ? PAYMENT_CATEGORY : CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];

export const GROUP_TYPES = [
  { id: 'trip', label: 'Trip', emoji: '🧳' },
  { id: 'home', label: 'Home', emoji: '🏠' },
  { id: 'couple', label: 'Couple', emoji: '💞' },
  { id: 'friends', label: 'Friends', emoji: '🍻' },
  { id: 'other', label: 'Other', emoji: '📁' },
] as const;

export const groupEmoji = (type: string): string => GROUP_TYPES.find((g) => g.id === type)?.emoji ?? '📁';
