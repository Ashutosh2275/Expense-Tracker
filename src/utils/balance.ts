import {
  Expense,
  ExpenseParticipant,
  Payment,
  Person,
  PersonBalance,
  DashboardSummary,
} from '@/types/database';
import { toPaise, fromPaise } from './currency';

export interface CalculationDataset {
  people: Person[];
  expenses: Expense[];
  participants: ExpenseParticipant[];
  payments: Payment[];
}

/**
 * Computes individual balance for a single person from source transactions.
 */
export function calculatePersonBalance(
  person: Person,
  expenses: Expense[],
  participants: ExpenseParticipant[],
  payments: Payment[]
): PersonBalance {
  const personId = person.id;

  // 1. Calculate how much they owe you (expenses paid by You where person has a share)
  let theyOwePaise = 0;
  // 2. Calculate how much you owe them (expenses paid by Person where You have a share)
  let youOwePaise = 0;
  // 3. Track total spent together on shared expenses
  let totalSpentTogetherPaise = 0;
  let pendingExpensesCount = 0;

  // Map participants by expense_id for quick lookup
  const participantsByExpense = new Map<string, ExpenseParticipant[]>();
  for (const part of participants) {
    const list = participantsByExpense.get(part.expense_id) || [];
    list.push(part);
    participantsByExpense.set(part.expense_id, list);
  }

  for (const expense of expenses) {
    const parts = participantsByExpense.get(expense.id) || [];
    const personPart = parts.find((p) => p.person_id === personId);
    const ownerPart = parts.find((p) => p.person_id === null);

    const isExpenseShared = personPart !== undefined;

    if (isExpenseShared) {
      totalSpentTogetherPaise += toPaise(expense.total_amount);

      // Case A: You paid (expense.paid_by is null or 'you')
      if (expense.paid_by === null) {
        if (personPart) {
          theyOwePaise += toPaise(personPart.share_amount);
        }
      } 
      // Case B: Person paid (expense.paid_by === personId)
      else if (expense.paid_by === personId) {
        if (ownerPart) {
          youOwePaise += toPaise(ownerPart.share_amount);
        }
      }
    }
  }

  // 4. Calculate payments between You and Person
  let theyPaidYouPaise = 0;
  let youPaidThemPaise = 0;

  for (const payment of payments) {
    // Payment from Person to You
    if (payment.from_person_id === personId && (payment.to_person_id === null || !payment.to_person_id)) {
      theyPaidYouPaise += toPaise(payment.amount);
    }
    // Payment from You to Person
    else if ((payment.from_person_id === null || !payment.from_person_id) && payment.to_person_id === personId) {
      youPaidThemPaise += toPaise(payment.amount);
    }
  }

  // Net balance from Your perspective (Paise):
  // Positive = They owe you. Negative = You owe them.
  // Net = (They Owe - They Paid) - (You Owe - You Paid)
  const netPaise = (theyOwePaise - theyPaidYouPaise) - (youOwePaise - youPaidThemPaise);
  const netBalance = fromPaise(netPaise);

  const theyOweYou = fromPaise(theyOwePaise);
  const youOweThem = fromPaise(youOwePaise);
  const theyPaidYou = fromPaise(theyPaidYouPaise);
  const youPaidThem = fromPaise(youPaidThemPaise);

  // Overpayment check:
  // If they paid more than their gross debt to you, and you don't owe them anything
  const isOverpaid = (theyPaidYouPaise > theyOwePaise && youOwePaise === 0) || (netPaise < 0 && youOwePaise === 0 && theyPaidYouPaise > 0);
  const overpaidAmount = isOverpaid ? fromPaise(Math.abs(netPaise)) : 0;

  const isSettled = netPaise === 0;

  if (!isSettled) {
    // Count pending expenses involving this person
    for (const expense of expenses) {
      const parts = participantsByExpense.get(expense.id) || [];
      if (parts.some((p) => p.person_id === personId)) {
        pendingExpensesCount++;
      }
    }
  }

  return {
    personId,
    name: person.name,
    email: person.email,
    phone: person.phone,
    note: person.note,
    netBalance,
    theyOweYou,
    youOweThem,
    theyPaidYou,
    youPaidThem,
    isSettled,
    isOverpaid,
    overpaidAmount,
    totalSpentTogether: fromPaise(totalSpentTogetherPaise),
    pendingExpensesCount,
  };
}

/**
 * Calculates dashboard summary aggregation across all people.
 */
export function calculateDashboardSummary(data: CalculationDataset): DashboardSummary {
  const pendingPeople: PersonBalance[] = [];
  let totalReceivablePaise = 0;
  let totalPayablePaise = 0;

  for (const person of data.people) {
    const balance = calculatePersonBalance(person, data.expenses, data.participants, data.payments);
    
    // We track people with non-zero balances or pending transactions
    pendingPeople.push(balance);

    if (balance.netBalance > 0) {
      totalReceivablePaise += toPaise(balance.netBalance);
    } else if (balance.netBalance < 0 && !balance.isOverpaid) {
      totalPayablePaise += toPaise(Math.abs(balance.netBalance));
    }
  }

  // Sort: people with outstanding balances first, then settled
  pendingPeople.sort((a, b) => {
    if (a.isSettled !== b.isSettled) return a.isSettled ? 1 : -1;
    return Math.abs(b.netBalance) - Math.abs(a.netBalance);
  });

  const totalReceivable = fromPaise(totalReceivablePaise);
  const totalPayable = fromPaise(totalPayablePaise);
  const netBalance = fromPaise(totalReceivablePaise - totalPayablePaise);

  return {
    totalReceivable,
    totalPayable,
    netBalance,
    pendingPeople,
  };
}
