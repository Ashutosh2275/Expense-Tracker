export type PaymentMethod = 'UPI' | 'Cash' | 'Bank Transfer' | 'Other';

export interface Profile {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Person {
  id: string;
  owner_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  owner_id: string;
  description: string;
  total_amount: number;
  currency: string;
  paid_by: string | null; // null = You (Owner), otherwise person_id
  expense_date: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseParticipant {
  id: string;
  expense_id: string;
  person_id: string | null; // null = You (Owner), otherwise person_id
  share_amount: number;
  created_at: string;
}

export interface Payment {
  id: string;
  owner_id: string;
  expense_id: string | null;
  from_person_id: string | null; // null = You (Owner), otherwise person_id
  to_person_id: string | null;   // null = You (Owner), otherwise person_id
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  note?: string | null;
  created_at: string;
}

export interface ParticipantShareInput {
  person_id: string | null; // null = You
  share_amount: number;
}

export interface CreateExpenseInput {
  description: string;
  total_amount: number;
  paid_by: string | null;
  expense_date: string;
  split_type: 'equal' | 'custom';
  participants: ParticipantShareInput[];
}

export interface RecordPaymentInput {
  expense_id?: string | null;
  from_person_id: string | null;
  to_person_id: string | null;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  note?: string | null;
}

export interface PersonBalance {
  personId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  note?: string | null;
  // Positive means they owe you money; Negative means you owe them money; 0 = settled
  netBalance: number;
  theyOweYou: number;
  youOweThem: number;
  theyPaidYou: number;
  youPaidThem: number;
  isSettled: boolean;
  isOverpaid: boolean;
  overpaidAmount: number;
  totalSpentTogether: number;
  pendingExpensesCount: number;
}

export interface DashboardSummary {
  totalReceivable: number; // Sum of positive net balances
  totalPayable: number;    // Sum of absolute negative net balances
  netBalance: number;      // totalReceivable - totalPayable
  pendingPeople: PersonBalance[];
}
