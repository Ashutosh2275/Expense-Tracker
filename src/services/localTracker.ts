import { toPaise, fromPaise } from '@/utils/currency';
import { firebaseService } from './firebase';
import { localAuth } from './localAuth';

export interface DeductRecord {
  id: string;
  amount: number;
  date: string;
}

export interface PendingEntry {
  id: string;
  purpose: string;
  originalAmount: number; // e.g. 80
  remainingAmount: number; // e.g. 40, vanishes when 0
  createdAt: string;
  deductions?: DeductRecord[]; // Child deductions displayed in unified tray
}

export interface PaymentLog {
  id: string;
  amount: number;
  date: string;
}

export interface Friend {
  id: string;
  name: string;
  balance: number;
  pendingEntries: PendingEntry[];
  paymentLogs?: PaymentLog[];
  updatedAt: string;
}

export interface SummaryTotals {
  totalReceivable: number;
  totalPayable: number;
  netBalance: number;
}

function getStorageKey(userId: string): string {
  return `tracker_friends_${userId.toLowerCase()}`;
}

export const localTracker = {
  getFriends(userId: string): Friend[] {
    try {
      const raw = localStorage.getItem(getStorageKey(userId));
      if (!raw) return [];
      const list: Friend[] = JSON.parse(raw);
      // Guarantee backward-compatibility & zero data loss across updates
      const normalized = list.map((f) => {
        let entries = (f.pendingEntries || []).filter((e) => toPaise(e.remainingAmount) > 0);
        // If a friend had an existing balance from an older version, preserve it as an entry
        if (entries.length === 0 && f.balance > 0) {
          entries = [
            {
              id: 'ent_' + f.id,
              purpose: 'Initial Balance',
              originalAmount: f.balance,
              remainingAmount: f.balance,
              createdAt: f.updatedAt || new Date().toISOString(),
            },
          ];
        }
        return {
          ...f,
          pendingEntries: entries,
          paymentLogs: f.paymentLogs || [],
        };
      });

      // Sort: non-settled first, then alphabetical
      return normalized.sort((a, b) => {
        const aSettled = a.balance === 0;
        const bSettled = b.balance === 0;
        if (aSettled !== bSettled) return aSettled ? 1 : -1;
        return Math.abs(b.balance) - Math.abs(a.balance);
      });
    } catch {
      return [];
    }
  },

  saveFriendsLocalOnly(userId: string, friends: Friend[]): void {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(friends));
  },

  saveFriends(userId: string, friends: Friend[], username?: string): void {
    this.saveFriendsLocalOnly(userId, friends);
    const resolvedUsername =
      username ||
      (userId.startsWith('usr_') ? userId.replace(/^usr_/, '') : undefined) ||
      localAuth.getCurrentUser()?.username;
    firebaseService.syncFriends(userId, friends, resolvedUsername).catch(() => {});
  },

  addFriend(userId: string, name: string, initialBalance: number = 0, initialPurpose?: string): Friend {
    const friends = this.getFriends(userId);
    const entries: PendingEntry[] = [];

    if (initialBalance > 0) {
      entries.push({
        id: 'ent_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        purpose: initialPurpose?.trim() || 'Initial balance',
        originalAmount: initialBalance,
        remainingAmount: initialBalance,
        createdAt: new Date().toISOString(),
      });
    }

    const newFriend: Friend = {
      id: 'fr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: name.trim(),
      balance: fromPaise(toPaise(initialBalance)),
      pendingEntries: entries,
      updatedAt: new Date().toISOString(),
    };

    friends.push(newFriend);
    this.saveFriends(userId, friends);
    return newFriend;
  },

  /**
   * Add a debt / expense item with Purpose.
   * e.g. Aryan owes 80 for "Dinner".
   */
  addDebt(userId: string, friendId: string, amount: number, purpose: string): Friend {
    const friends = this.getFriends(userId);
    const index = friends.findIndex((f) => f.id === friendId);
    if (index === -1) throw new Error('Friend not found');

    const entry: PendingEntry = {
      id: 'ent_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      purpose: purpose.trim() || 'Expense',
      originalAmount: amount,
      remainingAmount: amount,
      createdAt: new Date().toISOString(),
    };

    friends[index].pendingEntries = friends[index].pendingEntries || [];
    friends[index].pendingEntries.push(entry);

    // Recalculate balance
    const totalRemainingPaise = friends[index].pendingEntries.reduce(
      (sum, e) => sum + toPaise(e.remainingAmount),
      0
    );
    friends[index].balance = fromPaise(totalRemainingPaise);
    friends[index].updatedAt = new Date().toISOString();

    this.saveFriends(userId, friends);
    return friends[index];
  },

  /**
   * Deduct payment from pending entries in FIFO order.
   * When an entry's remainingAmount reaches 0, it vanishes completely from the log.
   */
  deductPayment(userId: string, friendId: string, paymentAmount: number): Friend {
    const friends = this.getFriends(userId);
    const index = friends.findIndex((f) => f.id === friendId);
    if (index === -1) throw new Error('Friend not found');

    let paymentLeftPaise = toPaise(paymentAmount);
    friends[index].pendingEntries = friends[index].pendingEntries || [];

    // Fallback: If friend already has a positive balance but no pendingEntries, create a pending entry
    if (friends[index].pendingEntries.length === 0 && friends[index].balance > 0) {
      friends[index].pendingEntries.push({
        id: 'ent_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        purpose: 'Pending Balance',
        originalAmount: friends[index].balance,
        remainingAmount: friends[index].balance,
        createdAt: friends[index].updatedAt || new Date().toISOString(),
      });
    }

    const nowIso = new Date().toISOString();
    for (const entry of friends[index].pendingEntries) {
      if (paymentLeftPaise <= 0) break;
      const remPaise = toPaise(entry.remainingAmount);

      entry.deductions = entry.deductions || [];

      if (paymentLeftPaise >= remPaise) {
        const deductedPaise = remPaise;
        paymentLeftPaise -= remPaise;
        entry.deductions.push({
          id: 'ded_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          amount: fromPaise(deductedPaise),
          date: nowIso,
        });
        entry.remainingAmount = 0; // Cleared completely!
      } else {
        const deductedPaise = paymentLeftPaise;
        entry.remainingAmount = fromPaise(remPaise - paymentLeftPaise);
        paymentLeftPaise = 0;
        entry.deductions.push({
          id: 'ded_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          amount: fromPaise(deductedPaise),
          date: nowIso,
        });
      }
    }

    // Vanish fully cleared entries (remainingAmount === 0).
    // Once all deductions equal the debt, that entire cycle clears and vanishes completely!
    friends[index].pendingEntries = friends[index].pendingEntries.filter(
      (e) => toPaise(e.remainingAmount) > 0
    );

    // Recalculate balance
    const totalRemainingPaise = friends[index].pendingEntries.reduce(
      (sum, e) => sum + toPaise(e.remainingAmount),
      0
    );

    // If overpayment remains
    if (paymentLeftPaise > 0) {
      friends[index].balance = fromPaise(-paymentLeftPaise);
    } else {
      friends[index].balance = fromPaise(totalRemainingPaise);
    }

    // Record payment log
    friends[index].paymentLogs = friends[index].paymentLogs || [];
    friends[index].paymentLogs.unshift({
      id: 'pay_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      amount: paymentAmount,
      date: new Date().toISOString(),
    });

    friends[index].updatedAt = new Date().toISOString();
    this.saveFriends(userId, friends);
    return friends[index];
  },

  /**
   * Edit an existing pending entry (purpose and amount)
   */
  editPendingEntry(
    userId: string,
    friendId: string,
    entryId: string,
    newAmount: number,
    newPurpose: string
  ): Friend {
    const friends = this.getFriends(userId);
    const friendIdx = friends.findIndex((f) => f.id === friendId);
    if (friendIdx === -1) throw new Error('Friend not found');

    const entry = (friends[friendIdx].pendingEntries || []).find((e) => e.id === entryId);
    if (!entry) throw new Error('Entry not found');

    entry.purpose = newPurpose.trim() || 'Expense';
    const diff = newAmount - entry.originalAmount;
    entry.originalAmount = newAmount;
    entry.remainingAmount = Math.max(0, fromPaise(toPaise(entry.remainingAmount) + toPaise(diff)));

    friends[friendIdx].pendingEntries = friends[friendIdx].pendingEntries.filter(
      (e) => toPaise(e.remainingAmount) > 0
    );

    const totalRemainingPaise = friends[friendIdx].pendingEntries.reduce(
      (sum, e) => sum + toPaise(e.remainingAmount),
      0
    );
    friends[friendIdx].balance = fromPaise(totalRemainingPaise);
    friends[friendIdx].updatedAt = new Date().toISOString();
    this.saveFriends(userId, friends);
    return friends[friendIdx];
  },

  /**
   * Delete a specific pending entry
   */
  deletePendingEntry(userId: string, friendId: string, entryId: string): Friend {
    const friends = this.getFriends(userId);
    const friendIdx = friends.findIndex((f) => f.id === friendId);
    if (friendIdx === -1) throw new Error('Friend not found');

    friends[friendIdx].pendingEntries = (friends[friendIdx].pendingEntries || []).filter(
      (e) => e.id !== entryId
    );

    const totalRemainingPaise = friends[friendIdx].pendingEntries.reduce(
      (sum, e) => sum + toPaise(e.remainingAmount),
      0
    );
    friends[friendIdx].balance = fromPaise(totalRemainingPaise);
    friends[friendIdx].updatedAt = new Date().toISOString();
    this.saveFriends(userId, friends);
    return friends[friendIdx];
  },

  /**
   * Adjusts balance directly (fallback/compatibility).
   */
  adjustBalance(userId: string, friendId: string, delta: number, purpose: string = 'Adjustment'): Friend {
    if (delta > 0) {
      return this.addDebt(userId, friendId, delta, purpose);
    } else if (delta < 0) {
      return this.deductPayment(userId, friendId, Math.abs(delta));
    }
    return this.getFriends(userId).find((f) => f.id === friendId)!;
  },

  /**
   * Add a shared expense with purpose where multiple friends owe their respective shares.
   */
  addSharedExpense(
    userId: string,
    descriptionOrSplits: string | { friendId: string; amount: number }[],
    splits?: { friendId: string; amount: number }[]
  ): void {
    let purpose = 'Shared Expense';
    let splitsList: { friendId: string; amount: number }[] = [];

    if (typeof descriptionOrSplits === 'string') {
      purpose = descriptionOrSplits.trim() || 'Shared Expense';
      splitsList = splits || [];
    } else {
      splitsList = descriptionOrSplits || [];
    }

    const friends = this.getFriends(userId);

    for (const split of splitsList) {
      const idx = friends.findIndex((f) => f.id === split.friendId);
      if (idx !== -1) {
        friends[idx].pendingEntries = friends[idx].pendingEntries || [];
        friends[idx].pendingEntries.push({
          id: 'ent_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          purpose,
          originalAmount: split.amount,
          remainingAmount: split.amount,
          createdAt: new Date().toISOString(),
        });

        const totalRemPaise = friends[idx].pendingEntries.reduce(
          (sum, e) => sum + toPaise(e.remainingAmount),
          0
        );
        friends[idx].balance = fromPaise(totalRemPaise);
        friends[idx].updatedAt = new Date().toISOString();
      }
    }

    this.saveFriends(userId, friends);
  },

  deleteFriend(userId: string, friendId: string): void {
    let friends = this.getFriends(userId);
    friends = friends.filter((f) => f.id !== friendId);
    this.saveFriends(userId, friends);
  },

  getSummary(friends: Friend[]): SummaryTotals {
    let receivablePaise = 0;
    let payablePaise = 0;

    for (const friend of friends) {
      const bPaise = toPaise(friend.balance);
      if (bPaise > 0) {
        receivablePaise += bPaise;
      } else if (bPaise < 0) {
        payablePaise += Math.abs(bPaise);
      }
    }

    const totalReceivable = fromPaise(receivablePaise);
    const totalPayable = fromPaise(payablePaise);
    const netBalance = fromPaise(receivablePaise - payablePaise);

    return {
      totalReceivable,
      totalPayable,
      netBalance,
    };
  },
};
