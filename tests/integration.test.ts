import { describe, it, expect, beforeEach } from 'vitest';
import {
  peopleService,
  expensesService,
  paymentsService,
  clearAllLocalData,
  loadDemoScenario,
} from '../src/services/api';
import { calculateDashboardSummary, calculatePersonBalance } from '../src/utils/balance';
import { calculateEqualSplit, validateSplit } from '../src/utils/currency';

describe('End-to-End Service & State Integration Tests', () => {
  beforeEach(() => {
    clearAllLocalData();
  });

  it('verifies complete lifecycle: Add People -> Add Expense -> Partial Payment -> Settlement', async () => {
    // 1. Add Ashutosh (Implicit owner), Priya, Swayam
    const priya = await peopleService.addPerson({
      name: 'Priya',
      email: 'priya@example.com',
      phone: '+91 9876543210',
      note: 'Friend',
    });
    expect(priya.name).toBe('Priya');

    const swayam = await peopleService.addPerson({
      name: 'Swayam',
      email: 'swayam@example.com',
      note: 'Flatmate',
    });
    expect(swayam.name).toBe('Swayam');

    // 2. Create ₹600 Dinner expense paid by You, split equally among You, Priya, Swayam (3 people)
    const splitShares = calculateEqualSplit(600, 3);
    expect(splitShares).toEqual([200, 200, 200]);

    const dinner = await expensesService.addExpense({
      description: 'Dinner',
      total_amount: 600,
      paid_by: null, // You paid
      expense_date: '2026-09-17',
      split_type: 'equal',
      participants: [
        { person_id: null, share_amount: splitShares[0] },      // You
        { person_id: priya.id, share_amount: splitShares[1] },  // Priya
        { person_id: swayam.id, share_amount: splitShares[2] }, // Swayam
      ],
    });
    expect(dinner.total_amount).toBe(600);

    // Verify initial balance
    let people = await peopleService.getPeople();
    let expenses = await expensesService.getExpenses();
    let participants = await expensesService.getParticipants();
    let payments = await paymentsService.getPayments();

    let summary = calculateDashboardSummary({ people, expenses, participants, payments });
    expect(summary.totalReceivable).toBe(400); // 200 from Priya + 200 from Swayam
    expect(summary.totalPayable).toBe(0);
    expect(summary.netBalance).toBe(400);

    let priyaBalance = calculatePersonBalance(priya, expenses, participants, payments);
    expect(priyaBalance.netBalance).toBe(200);
    expect(priyaBalance.isSettled).toBe(false);

    // 3. Priya pays ₹100 partial payment
    await paymentsService.recordPayment({
      expense_id: dinner.id,
      from_person_id: priya.id,
      to_person_id: null,
      amount: 100,
      payment_method: 'UPI',
      payment_date: '2026-09-17',
      note: 'First partial payment',
    });

    payments = await paymentsService.getPayments();
    summary = calculateDashboardSummary({ people, expenses, participants, payments });
    expect(summary.totalReceivable).toBe(300); // 100 from Priya + 200 from Swayam
    expect(summary.netBalance).toBe(300);

    priyaBalance = calculatePersonBalance(priya, expenses, participants, payments);
    expect(priyaBalance.netBalance).toBe(100);
    expect(priyaBalance.isSettled).toBe(false);

    // 4. Priya pays remaining ₹100
    await paymentsService.recordPayment({
      expense_id: dinner.id,
      from_person_id: priya.id,
      to_person_id: null,
      amount: 100,
      payment_method: 'UPI',
      payment_date: '2026-09-17',
      note: 'Final settlement',
    });

    payments = await paymentsService.getPayments();
    summary = calculateDashboardSummary({ people, expenses, participants, payments });
    expect(summary.totalReceivable).toBe(200); // Only Swayam owes 200

    priyaBalance = calculatePersonBalance(priya, expenses, participants, payments);
    expect(priyaBalance.netBalance).toBe(0);
    expect(priyaBalance.isSettled).toBe(true);

    // 5. Swayam pays full ₹200
    await paymentsService.recordPayment({
      expense_id: dinner.id,
      from_person_id: swayam.id,
      to_person_id: null,
      amount: 200,
      payment_method: 'UPI',
      payment_date: '2026-09-17',
      note: 'Full settlement',
    });

    payments = await paymentsService.getPayments();
    summary = calculateDashboardSummary({ people, expenses, participants, payments });
    expect(summary.totalReceivable).toBe(0);
    expect(summary.totalPayable).toBe(0);
    expect(summary.netBalance).toBe(0);

    const swayamBalance = calculatePersonBalance(swayam, expenses, participants, payments);
    expect(swayamBalance.netBalance).toBe(0);
    expect(swayamBalance.isSettled).toBe(true);

    // 6. Complete History Audit
    expect(expenses).toHaveLength(1);
    expect(payments).toHaveLength(3);
    expect(participants).toHaveLength(3);
  });

  it('validates demo seed data loading and reset', async () => {
    await loadDemoScenario();
    const people = await peopleService.getPeople();
    const expenses = await expensesService.getExpenses();
    const payments = await paymentsService.getPayments();

    expect(people.length).toBe(3); // Priya, Swayam, Anurag
    expect(expenses.length).toBe(2);
    expect(payments.length).toBe(1);

    clearAllLocalData();
    const clearedPeople = await peopleService.getPeople();
    expect(clearedPeople.length).toBe(0);
  });

  it('validates custom split rules and error messages', () => {
    const valid = validateSplit(600, [300, 200, 100]);
    expect(valid.isValid).toBe(true);

    const deficit = validateSplit(600, [300, 200]);
    expect(deficit.isValid).toBe(false);
    expect(deficit.message).toContain('₹100 remaining');

    const excess = validateSplit(600, [300, 400]);
    expect(excess.isValid).toBe(false);
    expect(excess.message).toContain('exceeds total by ₹100');
  });
});
