import { describe, it, expect, beforeEach } from 'vitest';

// Polyfill localStorage for Node test runner
const memoryStore = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => memoryStore.get(key) || null,
  setItem: (key: string, val: string) => memoryStore.set(key, String(val)),
  removeItem: (key: string) => memoryStore.delete(key),
  clear: () => memoryStore.clear(),
};
// @ts-expect-error polyfill for node test environment
globalThis.localStorage = localStorageMock;

import { localTracker } from '../src/services/localTracker';
import { localAuth } from '../src/services/localAuth';

describe('Local Single-Page Tracker & Auth Tests', () => {
  const testUserId = 'test_user_ashutosh';

  beforeEach(() => {
    localStorage.clear();
  });

  it('authenticates user and formats username with first letter capital and rest small', () => {
    // 1. User ASHUTOSH with numeric password 1234 -> formatted to Ashutosh
    const ashutosh = localAuth.authenticate('ASHUTOSH', '1234');
    expect(ashutosh.username).toBe('Ashutosh');

    // 2. Reject incorrect password strictly
    expect(() => localAuth.authenticate('ASHUTOSH', '9999')).toThrow('Incorrect password');

    // 3. Register new unique user with custom casing and numeric password
    const priya = localAuth.authenticate('priya', '5678');
    expect(priya.username).toBe('Priya');

    // 4. Case-insensitive lookup preserves unique user and verifies numeric password
    const reAshu = localAuth.authenticate('ashutosh', '1234');
    expect(reAshu.username).toBe('Ashutosh');
    const reMixed = localAuth.authenticate('aSHUTOSH', '1234');
    expect(reMixed.username).toBe('Ashutosh');

    // 5. Reject wrong password on mixed case
    expect(() => localAuth.authenticate('ashutosh', '0000')).toThrow('Incorrect password');
  });

  it('strictly rejects non-existent users on login without auto-creating accounts', () => {
    // Attempting to log in with an un-registered name must fail
    expect(() => localAuth.login('random_unknown_user', '123456')).toThrow(
      'User not found. Please register first.'
    );

    // Register user
    const user = localAuth.register('Leonid_op', 'leonidop@attendance.com', 'password123');
    expect(user.username).toBe('Leonid_op');

    // Login with correct username succeeds
    const logged = localAuth.login('Leonid_op', 'password123');
    expect(logged.username).toBe('Leonid_op');

    // Login with wrong password fails
    expect(() => localAuth.login('Leonid_op', 'wrongpassword')).toThrow('Incorrect password');
  });

  it('adds friend with name only and manages balances with direct 1-tap + and -', () => {
    // 1. Initial State: No friends, default balances ₹0
    let friends = localTracker.getFriends(testUserId);
    expect(friends).toHaveLength(0);

    let summary = localTracker.getSummary(friends);
    expect(summary.totalReceivable).toBe(0);
    expect(summary.totalPayable).toBe(0);
    expect(summary.netBalance).toBe(0);

    // 2. Add Person with Name only
    const priya = localTracker.addFriend(testUserId, 'Priya', 0);
    expect(priya.name).toBe('Priya');
    expect(priya.balance).toBe(0);

    // 3. Direct (+) adjustment: Priya owes ₹250
    localTracker.adjustBalance(testUserId, priya.id, 250);
    friends = localTracker.getFriends(testUserId);
    expect(friends[0].balance).toBe(250);

    summary = localTracker.getSummary(friends);
    expect(summary.totalReceivable).toBe(250);
    expect(summary.netBalance).toBe(250);

    // 4. Direct (−) adjustment: Priya pays back ₹100
    localTracker.adjustBalance(testUserId, priya.id, -100);
    friends = localTracker.getFriends(testUserId);
    expect(friends[0].balance).toBe(150);

    summary = localTracker.getSummary(friends);
    expect(summary.totalReceivable).toBe(150);

    // 5. Direct (−) adjustment: Priya pays remaining ₹150 -> Settled (₹0)
    localTracker.adjustBalance(testUserId, priya.id, -150);
    friends = localTracker.getFriends(testUserId);
    expect(friends[0].balance).toBe(0);

    summary = localTracker.getSummary(friends);
    expect(summary.totalReceivable).toBe(0);
    expect(summary.netBalance).toBe(0);
  });

  it('supports multi-person shared expense splitting', () => {
    const priya = localTracker.addFriend(testUserId, 'Priya', 0);
    const swayam = localTracker.addFriend(testUserId, 'Swayam', 0);

    // Shared dinner: ₹600 split 3 ways (Ashutosh paid, so Priya owes 200, Swayam owes 200)
    localTracker.addSharedExpense(testUserId, [
      { friendId: priya.id, amount: 200 },
      { friendId: swayam.id, amount: 200 },
    ]);

    const friends = localTracker.getFriends(testUserId);
    const p = friends.find((f) => f.id === priya.id);
    const s = friends.find((f) => f.id === swayam.id);

    expect(p?.balance).toBe(200);
    expect(s?.balance).toBe(200);

    const summary = localTracker.getSummary(friends);
    expect(summary.totalReceivable).toBe(400);
    expect(summary.netBalance).toBe(400);
  });

  it('handles Aryan FIFO debt clearing with Purpose and auto-vanishing cleared items', () => {
    // Scenario from user:
    // 1. Add Aryan
    const aryan = localTracker.addFriend(testUserId, 'Aryan', 0);
    expect(aryan.balance).toBe(0);

    // 2. Aryan owes 80 (Dinner), 60 (Cab), 20 (Tea)
    localTracker.addDebt(testUserId, aryan.id, 80, 'Dinner');
    localTracker.addDebt(testUserId, aryan.id, 60, 'Cab');
    localTracker.addDebt(testUserId, aryan.id, 20, 'Tea');

    let friends = localTracker.getFriends(testUserId);
    let a = friends.find((f) => f.id === aryan.id)!;
    expect(a.balance).toBe(160);
    expect(a.pendingEntries).toHaveLength(3);
    expect(a.pendingEntries[0].purpose).toBe('Dinner');
    expect(a.pendingEntries[0].remainingAmount).toBe(80);
    expect(a.pendingEntries[1].purpose).toBe('Cab');
    expect(a.pendingEntries[1].remainingAmount).toBe(60);
    expect(a.pendingEntries[2].purpose).toBe('Tea');
    expect(a.pendingEntries[2].remainingAmount).toBe(20);

    // 3. Aryan pays 40: deducted from first item (Dinner 80 -> 40 remaining)
    localTracker.deductPayment(testUserId, aryan.id, 40);
    friends = localTracker.getFriends(testUserId);
    a = friends.find((f) => f.id === aryan.id)!;

    expect(a.balance).toBe(120);
    expect(a.pendingEntries).toHaveLength(3); // Still 3 entries, none has reached 0
    expect(a.pendingEntries[0].purpose).toBe('Dinner');
    expect(a.pendingEntries[0].originalAmount).toBe(80);
    expect(a.pendingEntries[0].remainingAmount).toBe(40);
    expect(a.pendingEntries[1].remainingAmount).toBe(60);
    expect(a.pendingEntries[2].remainingAmount).toBe(20);

    // 4. Aryan pays 60:
    // Dinner (40 remaining) gets paid off completely and VANISHES!
    // Remaining 20 of the 60 is deducted from Cab (60 -> 40 remaining).
    // Tea (20) remains untouched.
    localTracker.deductPayment(testUserId, aryan.id, 60);
    friends = localTracker.getFriends(testUserId);
    a = friends.find((f) => f.id === aryan.id)!;

    expect(a.balance).toBe(60); // 40 (Cab) + 20 (Tea)
    expect(a.pendingEntries).toHaveLength(2); // Dinner vanished completely!
    expect(a.pendingEntries[0].purpose).toBe('Cab');
    expect(a.pendingEntries[0].originalAmount).toBe(60);
    expect(a.pendingEntries[0].remainingAmount).toBe(40);
    expect(a.pendingEntries[1].purpose).toBe('Tea');
    expect(a.pendingEntries[1].originalAmount).toBe(20);
    expect(a.pendingEntries[1].remainingAmount).toBe(20);

    // 5. Aryan pays 60:
    // Cab (40 remaining) is paid off and vanishes!
    // Tea (20 remaining) is paid off and vanishes!
    // All entries vanish, balance is 0.
    localTracker.deductPayment(testUserId, aryan.id, 60);
    friends = localTracker.getFriends(testUserId);
    a = friends.find((f) => f.id === aryan.id)!;

    expect(a.balance).toBe(0);
    expect(a.pendingEntries).toHaveLength(0); // All vanished!
  });

  it('handles Aryan 100/200 debt with 120 payment clearing 100 and logging 120, plus edit/delete', () => {
    // 1. Aryan owes 100 (Snacks) then 200 (Dinner)
    const aryan = localTracker.addFriend(testUserId, 'Aryan', 0);
    localTracker.addDebt(testUserId, aryan.id, 100, 'Snacks');
    localTracker.addDebt(testUserId, aryan.id, 200, 'Dinner');

    let friends = localTracker.getFriends(testUserId);
    let a = friends.find((f) => f.id === aryan.id)!;
    expect(a.balance).toBe(300);
    expect(a.pendingEntries).toHaveLength(2);

    // 2. Aryan clears 120:
    // Oldest (100 Snacks) is cleared out completely!
    // Dinner (200) has 180 remaining.
    // 120 is stored in payment logs. Total balance is 180.
    localTracker.deductPayment(testUserId, aryan.id, 120);
    friends = localTracker.getFriends(testUserId);
    a = friends.find((f) => f.id === aryan.id)!;

    expect(a.balance).toBe(180);
    expect(a.pendingEntries).toHaveLength(1); // 100 cleared out completely!
    expect(a.pendingEntries[0].purpose).toBe('Dinner');
    expect(a.pendingEntries[0].remainingAmount).toBe(180);
    expect(a.paymentLogs).toBeDefined();
    expect(a.paymentLogs![0].amount).toBe(120);

    // 3. Edit remaining entry: change Dinner from 200 to 250 (remaining becomes 230)
    const dinnerId = a.pendingEntries[0].id;
    localTracker.editPendingEntry(testUserId, aryan.id, dinnerId, 250, 'Grand Dinner');
    friends = localTracker.getFriends(testUserId);
    a = friends.find((f) => f.id === aryan.id)!;

    expect(a.pendingEntries[0].purpose).toBe('Grand Dinner');
    expect(a.pendingEntries[0].originalAmount).toBe(250);
    expect(a.pendingEntries[0].remainingAmount).toBe(230);
    expect(a.balance).toBe(230);

    // 4. Delete entry
    localTracker.deletePendingEntry(testUserId, aryan.id, dinnerId);
    friends = localTracker.getFriends(testUserId);
    a = friends.find((f) => f.id === aryan.id)!;
    expect(a.pendingEntries).toHaveLength(0);
    expect(a.balance).toBe(0);
  });

  it('guarantees 100% data preservation across app updates and reloads without data loss', () => {
    // 1. Create a user and add friends with debts and payments
    const user = localAuth.authenticate('Ashutosh', '9876');
    const friend1 = localTracker.addFriend(user.id, 'Aryan', 0);
    const friend2 = localTracker.addFriend(user.id, 'Swayam', 0);

    localTracker.addDebt(user.id, friend1.id, 500, 'Project Work');
    localTracker.addDebt(user.id, friend2.id, 250, 'Groceries');
    localTracker.deductPayment(user.id, friend1.id, 200); // Aryan pays 200, 300 remaining

    // 2. Simulate app update / reload: re-read everything from storage
    const reloadedFriends = localTracker.getFriends(user.id);
    expect(reloadedFriends).toHaveLength(2);

    const reAryan = reloadedFriends.find((f) => f.id === friend1.id)!;
    const reSwayam = reloadedFriends.find((f) => f.id === friend2.id)!;

    // Names preserved
    expect(reAryan.name).toBe('Aryan');
    expect(reSwayam.name).toBe('Swayam');

    // Balances preserved
    expect(reAryan.balance).toBe(300);
    expect(reSwayam.balance).toBe(250);

    // Purpose and pending items preserved
    expect(reAryan.pendingEntries[0].purpose).toBe('Project Work');
    expect(reAryan.pendingEntries[0].remainingAmount).toBe(300);
    expect(reSwayam.pendingEntries[0].purpose).toBe('Groceries');
    expect(reSwayam.pendingEntries[0].remainingAmount).toBe(250);

    // Payment history preserved
    expect(reAryan.paymentLogs).toBeDefined();
    expect(reAryan.paymentLogs![0].amount).toBe(200);

    // User credentials preserved
    const reloadedUser = localAuth.authenticate('ashutosh', '9876');
    expect(reloadedUser.id).toBe(user.id);
    expect(reloadedUser.username).toBe('Ashutosh');
  });

  it('records child deductions under pendingEntry and vanishes entire completed cycle when fully paid', () => {
    // Scenario: Debt ₹80, deductions ₹40, ₹30, then ₹10
    const friend = localTracker.addFriend(testUserId, 'Aryan', 0);
    localTracker.addDebt(testUserId, friend.id, 80, 'Dinner');

    let friends = localTracker.getFriends(testUserId);
    let a = friends.find((f) => f.id === friend.id)!;
    expect(a.pendingEntries).toHaveLength(1);
    expect(a.pendingEntries[0].remainingAmount).toBe(80);

    // Step 1: Deduct 40
    localTracker.deductPayment(testUserId, friend.id, 40);
    friends = localTracker.getFriends(testUserId);
    a = friends.find((f) => f.id === friend.id)!;
    expect(a.pendingEntries).toHaveLength(1);
    expect(a.pendingEntries[0].remainingAmount).toBe(40);
    expect(a.pendingEntries[0].deductions).toHaveLength(1);
    expect(a.pendingEntries[0].deductions![0].amount).toBe(40);

    // Step 2: Deduct 30
    localTracker.deductPayment(testUserId, friend.id, 30);
    friends = localTracker.getFriends(testUserId);
    a = friends.find((f) => f.id === friend.id)!;
    expect(a.pendingEntries).toHaveLength(1);
    expect(a.pendingEntries[0].remainingAmount).toBe(10);
    expect(a.pendingEntries[0].deductions).toHaveLength(2);
    expect(a.pendingEntries[0].deductions![1].amount).toBe(30);

    // Step 3: Deduct remaining 10 -> Entire completed cycle vanishes!
    localTracker.deductPayment(testUserId, friend.id, 10);
    friends = localTracker.getFriends(testUserId);
    a = friends.find((f) => f.id === friend.id)!;
    expect(a.pendingEntries).toHaveLength(0); // Vanished!
    expect(a.balance).toBe(0);
  });

  it('strictly enforces unique username AND unique email address tied 1-to-1', () => {
    // 1. First user registers as 'Ashutosh' with 'ashutosh@example.com'
    const u1 = localAuth.register('Ashutosh', 'ashutosh@example.com', 'pass111');
    expect(u1.username).toBe('Ashutosh');
    expect(u1.email).toBe('ashutosh@example.com');

    // 2. Reject duplicate username even with different email
    expect(() => localAuth.register('Ashutosh', 'different@example.com', 'pass222')).toThrow(
      'This username is already taken'
    );
    expect(() => localAuth.register('ashutosh', 'another@example.com', 'pass222')).toThrow(
      'This username is already taken'
    );

    // 3. Reject duplicate email even with different username
    expect(() => localAuth.register('NewUser', 'ashutosh@example.com', 'pass333')).toThrow(
      'This email address is already registered'
    );

    // 4. Successful registration with unique username and unique email
    const u2 = localAuth.register('Aryan', 'aryan@example.com', 'pass444');
    expect(u2.username).toBe('Aryan');
    expect(u2.email).toBe('aryan@example.com');

    // 5. Login by username or unique email
    const loginByName = localAuth.login('Ashutosh', 'pass111');
    expect(loginByName.username).toBe('Ashutosh');
    const loginByEmail = localAuth.login('aryan@example.com', 'pass444');
    expect(loginByEmail.email).toBe('aryan@example.com');
  });
});
