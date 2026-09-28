import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  peopleService,
  expensesService,
  paymentsService,
  authService,
} from '@/services/api';
import {
  calculateDashboardSummary,
  calculatePersonBalance,
} from '@/utils/balance';
import {
  CreateExpenseInput,
  RecordPaymentInput,
  Person,
} from '@/types/database';

export const QUERY_KEYS = {
  user: ['user'] as const,
  people: ['people'] as const,
  expenses: ['expenses'] as const,
  participants: ['participants'] as const,
  payments: ['payments'] as const,
};

export function useCurrentUser() {
  return useQuery({
    queryKey: QUERY_KEYS.user,
    queryFn: () => authService.getCurrentUser(),
  });
}

export function usePeople() {
  return useQuery({
    queryKey: QUERY_KEYS.people,
    queryFn: () => peopleService.getPeople(),
  });
}

export function useExpenses() {
  return useQuery({
    queryKey: QUERY_KEYS.expenses,
    queryFn: () => expensesService.getExpenses(),
  });
}

export function useParticipants() {
  return useQuery({
    queryKey: QUERY_KEYS.participants,
    queryFn: () => expensesService.getParticipants(),
  });
}

export function usePayments() {
  return useQuery({
    queryKey: QUERY_KEYS.payments,
    queryFn: () => paymentsService.getPayments(),
  });
}

/**
 * React Query hook computing dynamic balances from the four source tables.
 * Follows principle: balances are strictly computed, never stored as source of truth.
 */
export function useBalances() {
  const peopleQuery = usePeople();
  const expensesQuery = useExpenses();
  const participantsQuery = useParticipants();
  const paymentsQuery = usePayments();

  const isLoading =
    peopleQuery.isLoading ||
    expensesQuery.isLoading ||
    participantsQuery.isLoading ||
    paymentsQuery.isLoading;

  const isError =
    peopleQuery.isError ||
    expensesQuery.isError ||
    participantsQuery.isError ||
    paymentsQuery.isError;

  const people = peopleQuery.data || [];
  const expenses = expensesQuery.data || [];
  const participants = participantsQuery.data || [];
  const payments = paymentsQuery.data || [];

  const summary = calculateDashboardSummary({
    people,
    expenses,
    participants,
    payments,
  });

  return {
    isLoading,
    isError,
    summary,
    people,
    expenses,
    participants,
    payments,
  };
}

/**
 * Returns deep-dive details for a specific person
 */
export function usePersonDetail(personId: string) {
  const { people, expenses, participants, payments, isLoading, isError } = useBalances();

  const person = people.find((p) => p.id === personId);

  if (!person) {
    return {
      isLoading,
      isError,
      person: null,
      balance: null,
      sharedExpenses: [],
      paymentHistory: [],
    };
  }

  const balance = calculatePersonBalance(person, expenses, participants, payments);

  // Find all expenses where this person is a participant OR this person paid
  const sharedExpenses = expenses
    .filter((e) => {
      const parts = participants.filter((part) => part.expense_id === e.id);
      const isParticipant = parts.some((p) => p.person_id === personId);
      const isPayer = e.paid_by === personId;
      return isParticipant || isPayer;
    })
    .map((e) => {
      const parts = participants.filter((part) => part.expense_id === e.id);
      const personShare = parts.find((part) => part.person_id === personId)?.share_amount || 0;
      const yourShare = parts.find((part) => part.person_id === null)?.share_amount || 0;
      return {
        ...e,
        personShare,
        yourShare,
        isPayer: e.paid_by === personId,
      };
    });

  // Find all payments between You and this person
  const paymentHistory = payments
    .filter(
      (p) =>
        (p.from_person_id === personId && (!p.to_person_id || p.to_person_id === null)) ||
        ((!p.from_person_id || p.from_person_id === null) && p.to_person_id === personId)
    )
    .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());

  return {
    isLoading,
    isError,
    person,
    balance,
    sharedExpenses,
    paymentHistory,
  };
}

// ================= MUTATION HOOKS ================= //

export function useAddPerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; email?: string; phone?: string; note?: string }) =>
      peopleService.addPerson(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.people });
    },
  });
}

export function useUpdatePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Person> }) =>
      peopleService.updatePerson(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.people });
    },
  });
}

export function useDeletePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => peopleService.deletePerson(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.people });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.expenses });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.participants });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.payments });
    },
  });
}

export function useAddExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateExpenseInput) => expensesService.addExpense(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.expenses });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.participants });
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateExpenseInput }) =>
      expensesService.updateExpense(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.expenses });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.participants });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => expensesService.deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.expenses });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.participants });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.payments });
    },
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordPaymentInput) => paymentsService.recordPayment(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.payments });
    },
  });
}

export function useDeletePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => paymentsService.deletePayment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.payments });
    },
  });
}
