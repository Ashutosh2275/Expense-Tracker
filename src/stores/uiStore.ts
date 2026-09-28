import { create } from 'zustand';

export type ActivityFilter = 'all' | 'owed_to_me' | 'i_owe' | 'settled';

interface UIState {
  // Navigation & Bottom sheets
  isAddExpenseOpen: boolean;
  isAddPersonOpen: boolean;
  isRecordPaymentOpen: boolean;
  paymentPreselectedPersonId: string | null;
  paymentPreselectedExpenseId: string | null;
  
  // Activity Filters & Search
  activityFilter: ActivityFilter;
  activitySearchQuery: string;
  peopleSearchQuery: string;

  // Actions
  setAddExpenseOpen: (open: boolean) => void;
  setAddPersonOpen: (open: boolean) => void;
  openRecordPayment: (personId?: string | null, expenseId?: string | null) => void;
  closeRecordPayment: () => void;
  setActivityFilter: (filter: ActivityFilter) => void;
  setActivitySearchQuery: (query: string) => void;
  setPeopleSearchQuery: (query: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isAddExpenseOpen: false,
  isAddPersonOpen: false,
  isRecordPaymentOpen: false,
  paymentPreselectedPersonId: null,
  paymentPreselectedExpenseId: null,

  activityFilter: 'all',
  activitySearchQuery: '',
  peopleSearchQuery: '',

  setAddExpenseOpen: (open) => set({ isAddExpenseOpen: open }),
  setAddPersonOpen: (open) => set({ isAddPersonOpen: open }),
  openRecordPayment: (personId = null, expenseId = null) =>
    set({
      isRecordPaymentOpen: true,
      paymentPreselectedPersonId: personId,
      paymentPreselectedExpenseId: expenseId,
    }),
  closeRecordPayment: () =>
    set({
      isRecordPaymentOpen: false,
      paymentPreselectedPersonId: null,
      paymentPreselectedExpenseId: null,
    }),
  setActivityFilter: (filter) => set({ activityFilter: filter }),
  setActivitySearchQuery: (query) => set({ activitySearchQuery: query }),
  setPeopleSearchQuery: (query) => set({ peopleSearchQuery: query }),
}));
