import { describe, it, expect } from 'vitest';
import {
  calculateEqualSplit,
  validateSplit,
  formatCurrency,
  toPaise,
  fromPaise,
} from '../src/utils/currency';
import {
  calculatePersonBalance,
  calculateDashboardSummary,
  CalculationDataset,
} from '../src/utils/balance';
import { Person, Expense, ExpenseParticipant, Payment } from '../src/types/database';

describe('Financial Arithmetic & Currency Tests', () => {
  it('converts between rupees and paise without IEEE 754 precision issues', () => {
    expect(toPaise(100.0)).toBe(10000);
    expect(toPaise(33.33)).toBe(3333);
    expect(fromPaise(3333)).toBe(33.33);
    expect(toPaise(0.1) + toPaise(0.2)).toBe(30);
    expect(fromPaise(toPaise(0.1) + toPaise(0.2))).toBe(0.3);
  });

  it('calculates exact equal splits preserving total down to 1 paise', () => {
    // 100 / 3
    const split3 = calculateEqualSplit(100, 3);
    expect(split3).toHaveLength(3);
    const sum3 = split3.reduce((a, b) => a + b, 0);
    expect(Math.round(sum3 * 100) / 100).toBe(100);
    expect(split3).toEqual([33.34, 33.33, 33.33]);

    // 500 / 3
    const split500 = calculateEqualSplit(500, 3);
    const sum500 = split500.reduce((a, b) => a + b, 0);
    expect(Math.round(sum500 * 100) / 100).toBe(500);

    // 999 / 7
    const split999 = calculateEqualSplit(999, 7);
    const sum999 = split999.reduce((a, b) => a + b, 0);
    expect(Math.round(sum999 * 100) / 100).toBe(999);

    // 100 / 2
    const split2 = calculateEqualSplit(100, 2);
    expect(split2).toEqual([50, 50]);
  });

  it('validates custom split totals correctly', () => {
    // Exact match
    const valid = validateSplit(600, [300, 200, 100]);
    expect(valid.isValid).toBe(true);
    expect(valid.difference).toBe(0);

    // Remaining deficit
    const under = validateSplit(600, [300, 200]);
    expect(under.isValid).toBe(false);
    expect(under.difference).toBe(100);
    expect(under.message).toContain('₹100 remaining');

    // Over budget
    const over = validateSplit(600, [300, 400]);
    expect(over.isValid).toBe(false);
    expect(over.difference).toBe(-100);
    expect(over.message).toContain('exceeds total by ₹100');
  });

  it('formats Indian currency properly with and without fractions', () => {
    // Whole numbers without trailing .00
    expect(formatCurrency(50)).toBe('₹50');
    expect(formatCurrency(500)).toBe('₹500');
    expect(formatCurrency(1250)).toBe('₹1,250');
    expect(formatCurrency(125000)).toBe('₹1,25,000');

    // Fractional numbers
    expect(formatCurrency(33.33)).toBe('₹33.33');
  });
});

describe('Section 50 Complete Test Scenario & Balance Engine', () => {
  const ashutoshId = 'user-ashutosh';
  const priya: Person = {
    id: 'person-priya',
    owner_id: ashutoshId,
    name: 'Priya',
    email: 'priya@example.com',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const swayam: Person = {
    id: 'person-swayam',
    owner_id: ashutoshId,
    name: 'Swayam',
    email: 'swayam@example.com',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('runs complete Section 50 lifecycle step by step', () => {
    // 1. Initial State: Ashutosh pays ₹600 for Dinner split equally among Ashutosh, Priya, Swayam
    const expenseDinner: Expense = {
      id: 'exp-dinner',
      owner_id: ashutoshId,
      description: 'Dinner',
      total_amount: 600,
      currency: 'INR',
      paid_by: null, // Ashutosh (You) paid
      expense_date: '2026-09-17',
      created_at: '2026-09-17T12:00:00Z',
      updated_at: '2026-09-17T12:00:00Z',
    };

    const participants: ExpenseParticipant[] = [
      { id: 'part-ash', expense_id: 'exp-dinner', person_id: null, share_amount: 200, created_at: '2026-09-17T12:00:00Z' },
      { id: 'part-priya', expense_id: 'exp-dinner', person_id: priya.id, share_amount: 200, created_at: '2026-09-17T12:00:00Z' },
      { id: 'part-swayam', expense_id: 'exp-dinner', person_id: swayam.id, share_amount: 200, created_at: '2026-09-17T12:00:00Z' },
    ];

    const payments: Payment[] = [];

    const dataset: CalculationDataset = {
      people: [priya, swayam],
      expenses: [expenseDinner],
      participants,
      payments,
    };

    // Step 1 check: Dashboard should receive ₹400
    let summary = calculateDashboardSummary(dataset);
    expect(summary.totalReceivable).toBe(400);
    expect(summary.totalPayable).toBe(0);
    expect(summary.netBalance).toBe(400);

    let priyaBal = calculatePersonBalance(priya, dataset.expenses, dataset.participants, dataset.payments);
    expect(priyaBal.netBalance).toBe(200);
    expect(priyaBal.isSettled).toBe(false);

    let swayamBal = calculatePersonBalance(swayam, dataset.expenses, dataset.participants, dataset.payments);
    expect(swayamBal.netBalance).toBe(200);
    expect(swayamBal.isSettled).toBe(false);

    // Step 2: Priya pays ₹100
    const paymentPriya1: Payment = {
      id: 'pay-priya-1',
      owner_id: ashutoshId,
      expense_id: expenseDinner.id,
      from_person_id: priya.id,
      to_person_id: null, // to Ashutosh
      amount: 100,
      payment_method: 'UPI',
      payment_date: '2026-09-17',
      created_at: '2026-09-17T13:00:00Z',
    };
    dataset.payments.push(paymentPriya1);

    summary = calculateDashboardSummary(dataset);
    // Dashboard should receive ₹300
    expect(summary.totalReceivable).toBe(300);
    expect(summary.netBalance).toBe(300);

    priyaBal = calculatePersonBalance(priya, dataset.expenses, dataset.participants, dataset.payments);
    // Priya balance: ₹100
    expect(priyaBal.netBalance).toBe(100);
    expect(priyaBal.isSettled).toBe(false);

    // Step 3: Priya pays ₹100
    const paymentPriya2: Payment = {
      id: 'pay-priya-2',
      owner_id: ashutoshId,
      expense_id: expenseDinner.id,
      from_person_id: priya.id,
      to_person_id: null,
      amount: 100,
      payment_method: 'UPI',
      payment_date: '2026-09-17',
      created_at: '2026-09-17T14:00:00Z',
    };
    dataset.payments.push(paymentPriya2);

    priyaBal = calculatePersonBalance(priya, dataset.expenses, dataset.participants, dataset.payments);
    // Priya settled, ₹0
    expect(priyaBal.netBalance).toBe(0);
    expect(priyaBal.isSettled).toBe(true);

    summary = calculateDashboardSummary(dataset);
    expect(summary.totalReceivable).toBe(200); // Only Swayam remains

    // Step 4: Swayam pays ₹200
    const paymentSwayam: Payment = {
      id: 'pay-swayam-1',
      owner_id: ashutoshId,
      expense_id: expenseDinner.id,
      from_person_id: swayam.id,
      to_person_id: null,
      amount: 200,
      payment_method: 'UPI',
      payment_date: '2026-09-17',
      created_at: '2026-09-17T15:00:00Z',
    };
    dataset.payments.push(paymentSwayam);

    swayamBal = calculatePersonBalance(swayam, dataset.expenses, dataset.participants, dataset.payments);
    // Swayam settled, ₹0
    expect(swayamBal.netBalance).toBe(0);
    expect(swayamBal.isSettled).toBe(true);

    // Final Dashboard Check: You should receive ₹0, You owe ₹0, Net balance ₹0
    summary = calculateDashboardSummary(dataset);
    expect(summary.totalReceivable).toBe(0);
    expect(summary.totalPayable).toBe(0);
    expect(summary.netBalance).toBe(0);

    // Verify history remains intact
    expect(dataset.expenses).toHaveLength(1);
    expect(dataset.payments).toHaveLength(3);
    expect(dataset.participants).toHaveLength(3);
  });

  it('detects and flags overpayment correctly without hiding amount', () => {
    const expense: Expense = {
      id: 'exp-1',
      owner_id: ashutoshId,
      description: 'Trip',
      total_amount: 500,
      currency: 'INR',
      paid_by: null,
      expense_date: '2026-09-17',
      created_at: '2026-09-17T12:00:00Z',
      updated_at: '2026-09-17T12:00:00Z',
    };

    const participants: ExpenseParticipant[] = [
      { id: 'p1', expense_id: 'exp-1', person_id: priya.id, share_amount: 500, created_at: '2026-09-17T12:00:00Z' },
    ];

    // Priya pays ₹600 (overpays ₹100)
    const payment: Payment = {
      id: 'pay-over',
      owner_id: ashutoshId,
      expense_id: 'exp-1',
      from_person_id: priya.id,
      to_person_id: null,
      amount: 600,
      payment_method: 'UPI',
      payment_date: '2026-09-17',
      created_at: '2026-09-17T13:00:00Z',
    };

    const bal = calculatePersonBalance(priya, [expense], participants, [payment]);
    expect(bal.isOverpaid).toBe(true);
    expect(bal.overpaidAmount).toBe(100);
    expect(bal.netBalance).toBe(-100);
  });

  it('handles scenario when a friend paid and You owe them', () => {
    // Swayam paid ₹400, split between Swayam and Ashutosh (₹200 each)
    const expense: Expense = {
      id: 'exp-cab',
      owner_id: ashutoshId,
      description: 'Cab',
      total_amount: 400,
      currency: 'INR',
      paid_by: swayam.id, // Swayam paid
      expense_date: '2026-09-17',
      created_at: '2026-09-17T12:00:00Z',
      updated_at: '2026-09-17T12:00:00Z',
    };

    const participants: ExpenseParticipant[] = [
      { id: 'part-1', expense_id: 'exp-cab', person_id: null, share_amount: 200, created_at: '2026-09-17T12:00:00Z' }, // You owe 200
      { id: 'part-2', expense_id: 'exp-cab', person_id: swayam.id, share_amount: 200, created_at: '2026-09-17T12:00:00Z' },
    ];

    const dataset: CalculationDataset = {
      people: [swayam],
      expenses: [expense],
      participants,
      payments: [],
    };

    const bal = calculatePersonBalance(swayam, [expense], participants, []);
    expect(bal.youOweThem).toBe(200);
    expect(bal.netBalance).toBe(-200);

    const summary = calculateDashboardSummary(dataset);
    expect(summary.totalReceivable).toBe(0);
    expect(summary.totalPayable).toBe(200);
    expect(summary.netBalance).toBe(-200);

    // You pay Swayam ₹200
    const payment: Payment = {
      id: 'pay-to-swayam',
      owner_id: ashutoshId,
      expense_id: 'exp-cab',
      from_person_id: null, // From You
      to_person_id: swayam.id, // To Swayam
      amount: 200,
      payment_method: 'UPI',
      payment_date: '2026-09-17',
      created_at: '2026-09-17T13:00:00Z',
    };
    dataset.payments.push(payment);

    const settledBal = calculatePersonBalance(swayam, [expense], participants, dataset.payments);
    expect(settledBal.netBalance).toBe(0);
    expect(settledBal.isSettled).toBe(true);

    const settledSummary = calculateDashboardSummary(dataset);
    expect(settledSummary.totalPayable).toBe(0);
    expect(settledSummary.netBalance).toBe(0);
  });
});
