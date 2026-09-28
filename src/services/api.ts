import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  Person,
  Expense,
  ExpenseParticipant,
  Payment,
  CreateExpenseInput,
  RecordPaymentInput,
} from '@/types/database';

const LOCAL_STORAGE_PREFIX = 'expense_tracker_';
const memoryStore = new Map<string, string>();

function getLocal<T>(key: string, fallback: T): T {
  try {
    const fullKey = LOCAL_STORAGE_PREFIX + key;
    const raw =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem(fullKey)
        : memoryStore.get(fullKey);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setLocal<T>(key: string, data: T): void {
  try {
    const fullKey = LOCAL_STORAGE_PREFIX + key;
    const val = JSON.stringify(data);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(fullKey, val);
    } else {
      memoryStore.set(fullKey, val);
    }
  } catch (err) {
    console.error('Failed to write storage', err);
  }
}

function removeLocal(key: string): void {
  const fullKey = LOCAL_STORAGE_PREFIX + key;
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(fullKey);
  } else {
    memoryStore.delete(fullKey);
  }
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

// ================= AUTH SERVICE ================= //

export const authService = {
  async getCurrentUser(): Promise<AuthUser | null> {
    if (isSupabaseConfigured && supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      return {
        id: user.id,
        email: user.email || '',
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
      };
    }
    // Local / Demo Mode
    return getLocal<AuthUser | null>('demo_user', {
      id: 'd0000000-0000-0000-0000-000000000001',
      email: 'ashutosh@example.com',
      name: 'Ashutosh',
    });
  },

  async signIn(email: string, password?: string): Promise<AuthUser> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: password || '',
      });
      if (error) throw error;
      if (!data.user) throw new Error('No user returned from login');
      return {
        id: data.user.id,
        email: data.user.email || '',
        name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
      };
    }
    // Local / Demo Mode
    const user: AuthUser = {
      id: 'd0000000-0000-0000-0000-000000000001',
      email,
      name: email.split('@')[0] || 'Ashutosh',
    };
    setLocal('demo_user', user);
    return user;
  },

  async signUp(email: string, password?: string, name?: string): Promise<AuthUser> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: password || '',
        options: {
          data: { name: name || email.split('@')[0] },
        },
      });
      if (error) throw error;
      if (!data.user) throw new Error('No user returned from registration');
      return {
        id: data.user.id,
        email: data.user.email || '',
        name: name || data.user.email?.split('@')[0] || 'User',
      };
    }
    // Local / Demo Mode
    const user: AuthUser = {
      id: 'd0000000-0000-0000-0000-000000000001',
      email,
      name: name || email.split('@')[0] || 'Ashutosh',
    };
    setLocal('demo_user', user);
    return user;
  },

  async signOut(): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
      return;
    }
    setLocal('demo_user', null);
  },
};

// ================= PEOPLE SERVICE ================= //

export const peopleService = {
  async getPeople(): Promise<Person[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('people')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as Person[];
    }
    return getLocal<Person[]>('people', []);
  },

  async addPerson(input: { name: string; email?: string; phone?: string; note?: string }): Promise<Person> {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const newPerson: Person = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'p-' + Date.now(),
      owner_id: user.id,
      name: input.name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      note: input.note?.trim() || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('people')
        .insert({
          owner_id: user.id,
          name: newPerson.name,
          email: newPerson.email,
          phone: newPerson.phone,
          note: newPerson.note,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Person;
    }

    const people = getLocal<Person[]>('people', []);
    people.push(newPerson);
    setLocal('people', people);
    return newPerson;
  },

  async updatePerson(id: string, input: Partial<Person>): Promise<Person> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('people')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Person;
    }

    const people = getLocal<Person[]>('people', []);
    const idx = people.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Person not found');
    people[idx] = { ...people[idx], ...input, updated_at: new Date().toISOString() };
    setLocal('people', people);
    return people[idx];
  },

  async deletePerson(id: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('people').delete().eq('id', id);
      if (error) throw error;
      return;
    }

    const people = getLocal<Person[]>('people', []).filter((p) => p.id !== id);
    setLocal('people', people);
  },
};

// ================= EXPENSES & PARTICIPANTS SERVICE ================= //

export const expensesService = {
  async getExpenses(): Promise<Expense[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false });
      if (error) throw error;
      return (data || []) as Expense[];
    }
    return getLocal<Expense[]>('expenses', []);
  },

  async getParticipants(): Promise<ExpenseParticipant[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('expense_participants').select('*');
      if (error) throw error;
      return (data || []) as ExpenseParticipant[];
    }
    return getLocal<ExpenseParticipant[]>('expense_participants', []);
  },

  async addExpense(input: CreateExpenseInput): Promise<Expense> {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const expenseId = crypto.randomUUID ? crypto.randomUUID() : 'exp-' + Date.now();
    const newExpense: Expense = {
      id: expenseId,
      owner_id: user.id,
      description: input.description.trim(),
      total_amount: Number(input.total_amount),
      currency: 'INR',
      paid_by: input.paid_by || null,
      expense_date: input.expense_date,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const participants: ExpenseParticipant[] = input.participants.map((p) => ({
      id: crypto.randomUUID ? crypto.randomUUID() : 'part-' + Math.random().toString(36).slice(2),
      expense_id: expenseId,
      person_id: p.person_id,
      share_amount: Number(p.share_amount),
      created_at: new Date().toISOString(),
    }));

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          owner_id: user.id,
          description: newExpense.description,
          total_amount: newExpense.total_amount,
          currency: 'INR',
          paid_by: newExpense.paid_by,
          expense_date: newExpense.expense_date,
        })
        .select()
        .single();
      if (error) throw error;

      const participantRows = input.participants.map((p) => ({
        expense_id: data.id,
        person_id: p.person_id,
        share_amount: Number(p.share_amount),
      }));

      const { error: partError } = await supabase
        .from('expense_participants')
        .insert(participantRows);
      if (partError) throw partError;

      return data as Expense;
    }

    const expenses = getLocal<Expense[]>('expenses', []);
    expenses.unshift(newExpense);
    setLocal('expenses', expenses);

    const allParts = getLocal<ExpenseParticipant[]>('expense_participants', []);
    allParts.push(...participants);
    setLocal('expense_participants', allParts);

    return newExpense;
  },

  async updateExpense(id: string, input: CreateExpenseInput): Promise<Expense> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('expenses')
        .update({
          description: input.description.trim(),
          total_amount: Number(input.total_amount),
          paid_by: input.paid_by || null,
          expense_date: input.expense_date,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      // Delete old participants and reinsert
      await supabase.from('expense_participants').delete().eq('expense_id', id);
      const participantRows = input.participants.map((p) => ({
        expense_id: id,
        person_id: p.person_id,
        share_amount: Number(p.share_amount),
      }));
      await supabase.from('expense_participants').insert(participantRows);

      return data as Expense;
    }

    const expenses = getLocal<Expense[]>('expenses', []);
    const idx = expenses.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error('Expense not found');

    expenses[idx] = {
      ...expenses[idx],
      description: input.description.trim(),
      total_amount: Number(input.total_amount),
      paid_by: input.paid_by || null,
      expense_date: input.expense_date,
      updated_at: new Date().toISOString(),
    };
    setLocal('expenses', expenses);

    // Update participants
    let allParts = getLocal<ExpenseParticipant[]>('expense_participants', []);
    allParts = allParts.filter((p) => p.expense_id !== id);
    const newParts: ExpenseParticipant[] = input.participants.map((p) => ({
      id: crypto.randomUUID ? crypto.randomUUID() : 'part-' + Math.random().toString(36).slice(2),
      expense_id: id,
      person_id: p.person_id,
      share_amount: Number(p.share_amount),
      created_at: new Date().toISOString(),
    }));
    allParts.push(...newParts);
    setLocal('expense_participants', allParts);

    return expenses[idx];
  },

  async deleteExpense(id: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
      return;
    }

    const expenses = getLocal<Expense[]>('expenses', []).filter((e) => e.id !== id);
    setLocal('expenses', expenses);

    const parts = getLocal<ExpenseParticipant[]>('expense_participants', []).filter(
      (p) => p.expense_id !== id
    );
    setLocal('expense_participants', parts);
  },
};

// ================= PAYMENTS SERVICE ================= //

export const paymentsService = {
  async getPayments(): Promise<Payment[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return (data || []) as Payment[];
    }
    return getLocal<Payment[]>('payments', []);
  },

  async recordPayment(input: RecordPaymentInput): Promise<Payment> {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const newPayment: Payment = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'pay-' + Date.now(),
      owner_id: user.id,
      expense_id: input.expense_id || null,
      from_person_id: input.from_person_id || null,
      to_person_id: input.to_person_id || null,
      amount: Number(input.amount),
      payment_method: input.payment_method,
      payment_date: input.payment_date,
      note: input.note?.trim() || null,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('payments')
        .insert({
          owner_id: user.id,
          expense_id: newPayment.expense_id,
          from_person_id: newPayment.from_person_id,
          to_person_id: newPayment.to_person_id,
          amount: newPayment.amount,
          payment_method: newPayment.payment_method,
          payment_date: newPayment.payment_date,
          note: newPayment.note,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Payment;
    }

    const payments = getLocal<Payment[]>('payments', []);
    payments.unshift(newPayment);
    setLocal('payments', payments);
    return newPayment;
  },

  async deletePayment(id: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('payments').delete().eq('id', id);
      if (error) throw error;
      return;
    }

    const payments = getLocal<Payment[]>('payments', []).filter((p) => p.id !== id);
    setLocal('payments', payments);
  },
};

// ================= DATA SEED & RESET UTILITIES ================= //

export async function loadDemoScenario(): Promise<void> {
  const user = await authService.getCurrentUser();
  const userId = user?.id || 'd0000000-0000-0000-0000-000000000001';

  const priyaId = 'd0000000-0000-0000-0000-000000000002';
  const swayamId = 'd0000000-0000-0000-0000-000000000003';
  const anuragId = 'd0000000-0000-0000-0000-000000000004';

  const people: Person[] = [
    {
      id: priyaId,
      owner_id: userId,
      name: 'Priya',
      email: 'priya@example.com',
      phone: '+91 9876543210',
      note: 'College friend',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: swayamId,
      owner_id: userId,
      name: 'Swayam',
      email: 'swayam@example.com',
      phone: '+91 9876543211',
      note: 'Flatmate',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: anuragId,
      owner_id: userId,
      name: 'Anurag',
      email: 'anurag@example.com',
      phone: '+91 9876543212',
      note: 'Office colleague',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const expDinnerId = 'e0000000-0000-0000-0000-000000000001';
  const expCabId = 'e0000000-0000-0000-0000-000000000002';

  const expenses: Expense[] = [
    {
      id: expDinnerId,
      owner_id: userId,
      description: 'Dinner at Cafe',
      total_amount: 600,
      currency: 'INR',
      paid_by: null, // Ashutosh paid
      expense_date: '2026-09-15',
      created_at: '2026-09-15T19:00:00Z',
      updated_at: '2026-09-15T19:00:00Z',
    },
    {
      id: expCabId,
      owner_id: userId,
      description: 'Airport Cab',
      total_amount: 350,
      currency: 'INR',
      paid_by: anuragId, // Anurag paid
      expense_date: '2026-09-16',
      created_at: '2026-09-16T10:00:00Z',
      updated_at: '2026-09-16T10:00:00Z',
    },
  ];

  const participants: ExpenseParticipant[] = [
    { id: 'part-1', expense_id: expDinnerId, person_id: null, share_amount: 200, created_at: '2026-09-15T19:00:00Z' },
    { id: 'part-2', expense_id: expDinnerId, person_id: priyaId, share_amount: 200, created_at: '2026-09-15T19:00:00Z' },
    { id: 'part-3', expense_id: expDinnerId, person_id: swayamId, share_amount: 200, created_at: '2026-09-15T19:00:00Z' },
    { id: 'part-4', expense_id: expCabId, person_id: null, share_amount: 175, created_at: '2026-09-16T10:00:00Z' },
    { id: 'part-5', expense_id: expCabId, person_id: anuragId, share_amount: 175, created_at: '2026-09-16T10:00:00Z' },
  ];

  const payments: Payment[] = [
    {
      id: 'pay-1',
      owner_id: userId,
      expense_id: expDinnerId,
      from_person_id: priyaId,
      to_person_id: null,
      amount: 100,
      payment_method: 'UPI',
      payment_date: '2026-09-16',
      note: 'Partial payment for dinner',
      created_at: '2026-09-16T12:00:00Z',
    },
  ];

  setLocal('people', people);
  setLocal('expenses', expenses);
  setLocal('expense_participants', participants);
  setLocal('payments', payments);
}

export function clearAllLocalData(): void {
  removeLocal('people');
  removeLocal('expenses');
  removeLocal('expense_participants');
  removeLocal('payments');
}
