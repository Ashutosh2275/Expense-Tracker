/**
 * Financial and Currency Utilities
 * Precision arithmetic handling INR with exact Paise allocation
 */

/**
 * Convert rupee float/number to integer paise (cents) to avoid IEEE 754 float drift.
 */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/**
 * Convert integer paise back to rupee float.
 */
export function fromPaise(paise: number): number {
  return paise / 100;
}

/**
 * Format currency in Indian Numbering System (e.g. ₹50, ₹1,250, ₹1,25,000, ₹33.33)
 * Suppresses trailing .00 for whole numbers per prompt specifications.
 */
export function formatCurrency(amount: number, currency: string = 'INR'): string {
  const absAmount = Math.abs(amount);
  const isWhole = Number.isInteger(Math.round(absAmount * 100) / 100) && Math.round(absAmount * 100) % 100 === 0;

  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  });

  const formatted = formatter.format(absAmount);
  // Ensure ₹ prefix
  const symbol = formatted.includes('₹') ? '' : '₹';
  const prefix = amount < 0 ? '-' : '';

  return `${prefix}${symbol}${formatted}`;
}

/**
 * Calculate exact equal splits among N participants with remainder distribution.
 * e.g., ₹100 / 3 -> [33.34, 33.33, 33.33] or [33.33, 33.33, 33.34] summing to exactly 100.00
 */
export function calculateEqualSplit(totalAmount: number, participantCount: number): number[] {
  if (participantCount <= 0 || totalAmount <= 0) {
    return Array(participantCount).fill(0);
  }

  const totalPaise = toPaise(totalAmount);
  const baseSharePaise = Math.floor(totalPaise / participantCount);
  let remainderPaise = totalPaise - baseSharePaise * participantCount;

  const shares: number[] = [];
  for (let i = 0; i < participantCount; i++) {
    // Distribute 1 paise from remainder to the first `remainderPaise` participants
    const sharePaise = baseSharePaise + (remainderPaise > 0 ? 1 : 0);
    if (remainderPaise > 0) {
      remainderPaise--;
    }
    shares.push(fromPaise(sharePaise));
  }

  return shares;
}

/**
 * Validate whether a list of custom split shares exactly matches the total amount.
 */
export function validateSplit(totalAmount: number, shares: number[]): {
  isValid: boolean;
  difference: number;
  message?: string;
} {
  const totalPaise = toPaise(totalAmount);
  const sumSharesPaise = shares.reduce((acc, s) => acc + toPaise(s), 0);
  const diffPaise = totalPaise - sumSharesPaise;
  const difference = fromPaise(diffPaise);

  if (diffPaise === 0) {
    return { isValid: true, difference: 0 };
  }

  if (diffPaise > 0) {
    return {
      isValid: false,
      difference,
      message: `Split doesn't match total. ${formatCurrency(difference)} remaining.`,
    };
  }

  return {
    isValid: false,
    difference,
    message: `Split exceeds total by ${formatCurrency(Math.abs(difference))}.`,
  };
}
