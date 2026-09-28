import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut,
  UserPlus,
  Plus,
  Minus,
  Check,
  Trash2,
  Receipt,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  Pencil,
} from 'lucide-react';
import { localAuth, UserAccount, toTitleCase } from '@/services/localAuth';
import { localTracker, Friend } from '@/services/localTracker';
import { firebaseService } from '@/services/firebase';
import { formatCurrency, calculateEqualSplit, toPaise, fromPaise } from '@/utils/currency';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';

export const SinglePageApp: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);

  // Expanded friend card for viewing purpose logs
  const [expandedFriendId, setExpandedFriendId] = useState<string | null>(null);

  // Modals state
  const [isAddPersonOpen, setIsAddPersonOpen] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonBalance, setNewPersonBalance] = useState<number>(0);
  const [newPersonPurpose, setNewPersonPurpose] = useState('');
  const [addPersonError, setAddPersonError] = useState('');

  // Edit Entry Modal
  const [editEntryModal, setEditEntryModal] = useState<{
    isOpen: boolean;
    friendId: string;
    entryId: string;
    purpose: string;
    amount: number;
  }>({
    isOpen: false,
    friendId: '',
    entryId: '',
    purpose: '',
    amount: 0,
  });

  // Quick Adjust Modal (+ or - on specific friend)
  const [adjustModal, setAdjustModal] = useState<{
    isOpen: boolean;
    friend: Friend | null;
    type: 'add' | 'minus'; // 'add' = they owe more (+), 'minus' = they paid back (-)
    amount: number;
    purpose: string;
  }>({
    isOpen: false,
    friend: null,
    type: 'add',
    amount: 0,
    purpose: '',
  });

  // Shared Group Expense Modal
  const [isSharedExpenseOpen, setIsSharedExpenseOpen] = useState(false);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseTotal, setExpenseTotal] = useState<number>(0);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [sharedExpenseSplitType, setSharedExpenseSplitType] = useState<'equal' | 'custom'>('equal');
  const [customFriendShares, setCustomFriendShares] = useState<Record<string, number>>({});
  const [expenseError, setExpenseError] = useState('');

  // 1. Check Authentication on Mount & Subscribe to Real-time Updates
  useEffect(() => {
    const user = localAuth.getCurrentUser();
    if (!user) {
      navigate('/auth');
      return;
    }
    setCurrentUser(user);
    loadFriends(user.id);

    // Real-time synchronization from cloud Realtime Database
    const unsubscribe = firebaseService.subscribeFriends(user.id, (cloudFriends) => {
      if (cloudFriends && cloudFriends.length > 0) {
        localTracker.saveFriendsLocalOnly(user.id, cloudFriends);
        setFriends(cloudFriends);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [navigate]);

  const loadFriends = async (userId: string) => {
    // 1. Instant local render from persistent storage (0ms)
    const list = localTracker.getFriends(userId);
    setFriends(list);

    // 2. Fetch fresh cloud state without risking data loss
    try {
      const cloudFriends = await firebaseService.loadFriendsFromCloud(userId);
      if (cloudFriends && cloudFriends.length > 0) {
        localTracker.saveFriendsLocalOnly(userId, cloudFriends);
        setFriends(cloudFriends);
      } else if ((!cloudFriends || cloudFriends.length === 0) && list.length > 0) {
        // Cloud node is empty but local device has existing data: automatically sync local data to cloud to preserve it
        await firebaseService.syncFriends(userId, list);
      }
    } catch {
      // offline fallback
    }
  };

  const handleSignOut = async () => {
    await firebaseService.signOut();
    localAuth.signOut();
    navigate('/auth');
  };

  // Dynamic greeting based on current device clock
  const [greeting, setGreeting] = useState<string>('Good afternoon');

  useEffect(() => {
    const computeGreeting = () => {
      const hour = new Date().getHours();
      if (hour >= 4 && hour < 12) {
        return 'Good morning';
      } else if (hour >= 12 && hour < 17) {
        return 'Good afternoon';
      } else {
        return 'Good evening';
      }
    };

    setGreeting(computeGreeting());
    const timer = setInterval(() => {
      setGreeting(computeGreeting());
    }, 60000); // Re-check every minute

    return () => clearInterval(timer);
  }, []);

  const summary = localTracker.getSummary(friends);

  // 2. Add Person (Name + Initial Balance with Purpose if any)
  const handleAddPersonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonName.trim()) {
      setAddPersonError('Please enter a name');
      return;
    }
    if (!currentUser) return;

    localTracker.addFriend(
      currentUser.id,
      newPersonName.trim(),
      newPersonBalance,
      newPersonPurpose
    );
    loadFriends(currentUser.id);

    setNewPersonName('');
    setNewPersonBalance(0);
    setNewPersonPurpose('');
    setAddPersonError('');
    setIsAddPersonOpen(false);
  };

  // 3. Quick 1-Tap Adjust (+ or -) with Purpose and FIFO Deductions
  const handleQuickAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !adjustModal.friend) return;
    if (adjustModal.amount <= 0) return;

    if (adjustModal.type === 'add') {
      localTracker.addDebt(
        currentUser.id,
        adjustModal.friend.id,
        adjustModal.amount,
        adjustModal.purpose
      );
    } else {
      localTracker.deductPayment(
        currentUser.id,
        adjustModal.friend.id,
        adjustModal.amount
      );
    }
    loadFriends(currentUser.id);

    setAdjustModal({ isOpen: false, friend: null, type: 'add', amount: 0, purpose: '' });
  };

  // 4. Delete Friend
  const handleDeleteFriend = (friendId: string, name: string) => {
    if (!currentUser) return;
    if (window.confirm(`Remove ${name} from your list?`)) {
      localTracker.deleteFriend(currentUser.id, friendId);
      loadFriends(currentUser.id);
    }
  };

  // 5. Edit and Delete Individual Expense Entries
  const handleEditEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !editEntryModal.friendId || !editEntryModal.entryId) return;
    if (editEntryModal.amount <= 0) return;

    localTracker.editPendingEntry(
      currentUser.id,
      editEntryModal.friendId,
      editEntryModal.entryId,
      editEntryModal.amount,
      editEntryModal.purpose
    );
    loadFriends(currentUser.id);
    setEditEntryModal({ isOpen: false, friendId: '', entryId: '', purpose: '', amount: 0 });
  };

  const handleDeleteEntry = (friendId: string, entryId: string) => {
    if (!currentUser) return;
    if (window.confirm('Delete this expense entry?')) {
      localTracker.deletePendingEntry(currentUser.id, friendId, entryId);
      loadFriends(currentUser.id);
    }
  };

  // 5. Shared Multi-Person Expense
  const handleOpenSharedExpense = () => {
    if (friends.length === 0) {
      setIsAddPersonOpen(true);
      return;
    }
    setExpenseDesc('');
    setExpenseTotal(0);
    setSelectedFriendIds([]); // unselect all members by default
    setSharedExpenseSplitType('equal');
    setCustomFriendShares({});
    setExpenseError('');
    setIsSharedExpenseOpen(true);
  };

  const toggleExpenseFriend = (id: string) => {
    if (selectedFriendIds.includes(id)) {
      setSelectedFriendIds(selectedFriendIds.filter((fid) => fid !== id));
    } else {
      setSelectedFriendIds([...selectedFriendIds, id]);
    }
  };

  // Real-time custom split calculations & mathematical validation
  const totalCustomSharesPaise = selectedFriendIds.reduce(
    (sum, fId) => sum + toPaise(customFriendShares[fId] || 0),
    0
  );
  const expenseTotalPaise = toPaise(expenseTotal);
  const yourSharePaise = expenseTotalPaise - totalCustomSharesPaise;
  const isCustomOverallocated = totalCustomSharesPaise > expenseTotalPaise;
  const customDifference = fromPaise(Math.abs(totalCustomSharesPaise - expenseTotalPaise));

  const handleSharedExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (expenseTotal <= 0) {
      setExpenseError('Please enter an amount');
      return;
    }
    if (selectedFriendIds.length === 0) {
      setExpenseError('Select at least one person');
      return;
    }

    let splits: { friendId: string; amount: number }[] = [];

    if (sharedExpenseSplitType === 'equal') {
      // Total split equally among: You + Selected Friends
      const totalParticipants = selectedFriendIds.length + 1; // You + friends
      const shares = calculateEqualSplit(expenseTotal, totalParticipants);
      // Each selected friend owes 1 share
      splits = selectedFriendIds.map((fId, index) => ({
        friendId: fId,
        amount: shares[index + 1] || 0,
      }));
    } else {
      // Custom split: Validate exact math
      if (totalCustomSharesPaise > expenseTotalPaise) {
        setExpenseError(
          `Friends' shares (${formatCurrency(fromPaise(totalCustomSharesPaise))}) exceed the total bill of ${formatCurrency(expenseTotal)} by ${formatCurrency(customDifference)}.`
        );
        return;
      }
      if (totalCustomSharesPaise <= 0) {
        setExpenseError("Please enter an amount for at least one person.");
        return;
      }

      splits = selectedFriendIds
        .filter((fId) => (customFriendShares[fId] || 0) > 0)
        .map((fId) => ({
          friendId: fId,
          amount: customFriendShares[fId] || 0,
        }));
    }

    localTracker.addSharedExpense(currentUser.id, expenseDesc, splits);
    loadFriends(currentUser.id);
    setIsSharedExpenseOpen(false);
  };

  return (
    <div
      className="min-h-screen bg-slate-50 antialiased text-slate-900 select-none"
      style={{
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)',
      }}
    >
      {/* Top Header with iOS Dynamic Island & Status Bar safe padding */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 px-4 sm:px-6 pb-3.5 shadow-xs transition-all pt-ios-header">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-black text-xl shadow-xs">
              ₹
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                {greeting},
              </p>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-wide leading-tight">
                {toTitleCase(currentUser?.username || 'Ashutosh')}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Single-Screen Content */}
      <main className="max-w-xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Hero Balance Summary Card */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm">
          <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
            {/* You should receive */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                  <ArrowDownLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <span>You should receive</span>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 tracking-tight">
                {formatCurrency(summary.totalReceivable)}
              </p>
            </div>

            {/* You owe */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-rose-700 text-xs font-semibold">
                <div className="w-5 h-5 rounded-full bg-rose-100 flex items-center justify-center">
                  <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <span>You owe</span>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-rose-600 tracking-tight">
                {formatCurrency(summary.totalPayable)}
              </p>
            </div>
          </div>

          {/* Net balance */}
          <div className="pt-3.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Net balance
            </span>
            <span
              className={`text-lg font-extrabold ${
                summary.netBalance > 0
                  ? 'text-emerald-600'
                  : summary.netBalance < 0
                  ? 'text-rose-600'
                  : 'text-slate-700'
              }`}
            >
              {summary.netBalance > 0 ? '+' : ''}
              {formatCurrency(summary.netBalance)}
            </span>
          </div>
        </div>

        {/* Action Bar: + Add Person & + Add Expense */}
        <div className="grid grid-cols-2 gap-2.5">
          <Button
            onClick={() => {
              setNewPersonName('');
              setNewPersonBalance(0);
              setAddPersonError('');
              setIsAddPersonOpen(true);
            }}
            variant="outline"
            className="gap-2 font-bold py-3 text-xs sm:text-sm border-slate-300"
          >
            <UserPlus className="w-4 h-4 text-slate-700" />
            <span>+ Add Person</span>
          </Button>

          <Button
            onClick={handleOpenSharedExpense}
            className="gap-2 font-bold py-3 text-xs sm:text-sm shadow-sm"
          >
            <Receipt className="w-4 h-4" />
            <span>+ Add Expense</span>
          </Button>
        </div>

        {/* Pending / Friends Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Pending / Friends ({friends.length})
            </h2>
            {friends.length > 0 && (
              <span className="text-[11px] text-slate-400 font-medium">
                Tap + / − to quickly adjust
              </span>
            )}
          </div>

          {friends.length > 0 ? (
            <div className="space-y-2.5">
              {friends.map((friend) => {
                const isOwedToYou = friend.balance > 0;
                const isYouOwe = friend.balance < 0;
                const isSettled = friend.balance === 0;
                const isExpanded = expandedFriendId === friend.id;
                const validEntries = (friend.pendingEntries || []).filter((e) => toPaise(e.remainingAmount) > 0);
                // Latest one at the first (top), oldest one at the last (bottom)
                const displayEntries = [...validEntries].reverse();

                return (
                  <div
                    key={friend.id}
                    className={`bg-white rounded-2xl border transition-all shadow-xs overflow-hidden ${
                      isExpanded
                        ? 'border-slate-400 ring-2 ring-slate-900/5'
                        : 'border-slate-200/90'
                    }`}
                  >
                    {/* Header Row: Clickable to expand/collapse details */}
                    <div
                      onClick={() =>
                        setExpandedFriendId(isExpanded ? null : friend.id)
                      }
                      className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 transition-colors"
                    >
                      {/* Left: Avatar & Name */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Avatar name={friend.name} size="md" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-bold text-slate-900 truncate">
                              {friend.name}
                            </h3>
                            <ChevronDown
                              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                                isExpanded ? 'rotate-180 text-slate-700' : ''
                              }`}
                            />
                          </div>
                          <p className="text-xs mt-0.5">
                            {isSettled ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-slate-500">
                                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                                <span>Settled (₹0 pending)</span>
                              </span>
                            ) : isOwedToYou ? (
                              <span className="font-semibold text-emerald-600">
                                Owes you {formatCurrency(friend.balance)}
                              </span>
                            ) : isYouOwe ? (
                              <span className="font-semibold text-rose-600">
                                You owe {formatCurrency(Math.abs(friend.balance))}
                              </span>
                            ) : null}
                          </p>
                        </div>
                      </div>

                      {/* Right: Direct 1-Tap Action Buttons (+ and -) */}
                      <div
                        className="flex items-center gap-1.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Minus Button (They paid / deduct) */}
                        <button
                          onClick={() =>
                            setAdjustModal({
                              isOpen: true,
                              friend,
                              type: 'minus',
                              amount: 0,
                              purpose: '',
                            })
                          }
                          className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 flex items-center justify-center font-bold transition-all shadow-xs"
                          title="Deduct payment"
                          aria-label="Deduct payment"
                        >
                          <Minus className="w-4 h-4 stroke-[3]" />
                        </button>

                        {/* Plus Button (They owe more / add) */}
                        <button
                          onClick={() =>
                            setAdjustModal({
                              isOpen: true,
                              friend,
                              type: 'add',
                              amount: 0,
                              purpose: '',
                            })
                          }
                          className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white flex items-center justify-center font-bold transition-all shadow-xs"
                          title="Add amount they owe"
                          aria-label="Add amount"
                        >
                          <Plus className="w-4 h-4 stroke-[3]" />
                        </button>

                        {/* Small Delete Icon */}
                        <button
                          onClick={() => handleDeleteFriend(friend.id, friend.name)}
                          className="p-2 text-slate-300 hover:text-rose-600 rounded-lg transition-colors"
                          title="Delete friend"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Detail View: Unified Tray */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50/50 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                            Expenses & Deductions ({displayEntries.length})
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            Latest first · Deductions clear oldest
                          </span>
                        </div>

                        {displayEntries.length > 0 ? (
                          <>
                            {/* Unified Tray: Green Debt Cards with attached Red Deduction Cards */}
                            <div className="space-y-2">
                              {displayEntries.map((entry) => {
                                const isPartiallyPaid =
                                  entry.remainingAmount < entry.originalAmount;
                                const deductions = entry.deductions || [];

                                return (
                                  <div key={entry.id} className="space-y-1.5">
                                    {/* Green Debt Card */}
                                    <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-300 flex items-center justify-between text-xs shadow-2xs">
                                      {/* Left: Date on top, Purpose below Date */}
                                      <div className="min-w-0 pr-3">
                                        <p className="text-[11px] font-semibold text-emerald-800/80">
                                          {new Date(entry.createdAt).toLocaleDateString(undefined, {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                          })}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                          <p className="text-xs font-bold text-slate-900 truncate">
                                            {entry.purpose}
                                          </p>
                                          {isPartiallyPaid && (
                                            <span className="text-[10px] text-amber-800 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-300">
                                              {formatCurrency(entry.remainingAmount)} left of{' '}
                                              {formatCurrency(entry.originalAmount)}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Right: Amount, Pen Icon, and Delete Icon */}
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className="font-extrabold text-emerald-800 text-sm">
                                          +{formatCurrency(entry.originalAmount)}
                                        </span>

                                        {/* Pen Icon to edit purpose and amount */}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditEntryModal({
                                              isOpen: true,
                                              friendId: friend.id,
                                              entryId: entry.id,
                                              purpose: entry.purpose,
                                              amount: entry.originalAmount,
                                            });
                                          }}
                                          className="p-1.5 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-lg transition-colors border border-emerald-200"
                                          title="Edit purpose and amount"
                                          aria-label="Edit expense"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>

                                        {/* Delete Entry Button */}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteEntry(friend.id, entry.id);
                                          }}
                                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                                          title="Delete this entry"
                                          aria-label="Delete entry"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Red Deduction Cards attached to this Debt */}
                                    {deductions.map((ded) => (
                                      <div
                                        key={ded.id}
                                        className="ml-3 p-2.5 bg-rose-50/80 rounded-xl border border-rose-200 flex items-center justify-between text-xs"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                                          <div>
                                            <p className="text-[10px] text-rose-600/80 font-medium">
                                              {new Date(ded.date).toLocaleDateString(undefined, {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                              })}
                                            </p>
                                            <p className="text-[11px] font-bold text-rose-950">
                                              Deduction / Paid back
                                            </p>
                                          </div>
                                        </div>
                                        <span className="font-extrabold text-rose-700 text-xs">
                                          −{formatCurrency(ded.amount)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        ) : (
                          <div className="p-3 bg-white rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                            {friend.balance === 0
                              ? 'All debts are fully cleared and vanished.'
                              : `Current balance: ${formatCurrency(friend.balance)}`}
                          </div>
                        )}

                        {/* Action buttons inside card */}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              setAdjustModal({
                                isOpen: true,
                                friend,
                                type: 'add',
                                amount: 0,
                                purpose: '',
                              })
                            }
                            className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[3]" />
                            <span>Add</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setAdjustModal({
                                isOpen: true,
                                friend,
                                type: 'minus',
                                amount: 0,
                                purpose: '',
                              })
                            }
                            className="flex-1 py-2 px-3 bg-white hover:bg-slate-100 active:scale-98 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                          >
                            <Minus className="w-3.5 h-3.5 stroke-[3]" />
                            <span>Deduct</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Empty State */
            <div className="text-center p-8 bg-white border border-dashed border-slate-200 rounded-3xl space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                <UserPlus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">No friends added yet</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Add friends to track shared expenses and instant 1-tap pending payments.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setIsAddPersonOpen(true)}
                className="mt-2 text-xs font-semibold"
              >
                + Add Person
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* ================= MODALS ================= */}

      {/* 1. Add Person Modal */}
      <Modal
        isOpen={isAddPersonOpen}
        onClose={() => setIsAddPersonOpen(false)}
        title="Add Person"
      >
        <form onSubmit={handleAddPersonSubmit} className="space-y-4">
          <Input
            label="Name *"
            placeholder="e.g. Ashutosh"
            value={newPersonName}
            onChange={(e) => {
              setNewPersonName(e.target.value);
              setAddPersonError('');
            }}
            autoFocus
          />

          <CurrencyInput
            label="Initial Balance"
            value={newPersonBalance}
            onChange={(val) => setNewPersonBalance(val)}
            placeholder="0"
          />

          {newPersonBalance > 0 && (
            <Input
              label="Purpose"
              placeholder="e.g. Dinner, Snacks, Cab"
              value={newPersonPurpose}
              onChange={(e) => setNewPersonPurpose(e.target.value)}
            />
          )}

          <p className="text-[11px] text-slate-400 -mt-2">
            Leave as 0 if they don't currently owe anything.
          </p>

          {addPersonError && (
            <p className="text-xs text-rose-600 font-medium">{addPersonError}</p>
          )}

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsAddPersonOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!newPersonName.trim()}>
              Add Person
            </Button>
          </div>
        </form>
      </Modal>

      {/* 2. Quick 1-Tap Direct Adjust Modal (+ or -) */}
      <Modal
        isOpen={adjustModal.isOpen}
        onClose={() =>
          setAdjustModal({ isOpen: false, friend: null, type: 'add', amount: 0, purpose: '' })
        }
        title={
          adjustModal.type === 'add'
            ? `Add Amount to ${adjustModal.friend?.name || ''}`
            : `Record Payment from ${adjustModal.friend?.name || ''}`
        }
      >
        <form onSubmit={handleQuickAdjustSubmit} className="space-y-4">
          <p className="text-xs text-slate-500">
            {adjustModal.type === 'add'
              ? `Increase what ${adjustModal.friend?.name} owes you (+)`
              : `Deduct what ${adjustModal.friend?.name} paid you back (−)`}
          </p>

          <CurrencyInput
            label="Amount *"
            value={adjustModal.amount}
            onChange={(val) => setAdjustModal((prev) => ({ ...prev, amount: val }))}
            className={adjustModal.type === 'minus' ? 'border-2 border-black focus:ring-black' : ''}
            autoFocus
          />

          {adjustModal.type === 'add' && (
            <Input
              label="Purpose"
              placeholder="e.g. Dinner, Cab, Snacks, Movie"
              value={adjustModal.purpose}
              onChange={(e) =>
                setAdjustModal((prev) => ({ ...prev, purpose: e.target.value }))
              }
            />
          )}

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                setAdjustModal({ isOpen: false, friend: null, type: 'add', amount: 0, purpose: '' })
              }
            >
              Cancel
            </Button>
            {adjustModal.type === 'add' ? (
              <Button
                type="submit"
                disabled={adjustModal.amount <= 0}
              >
                Add Amount (+)
              </Button>
            ) : (
              <button
                type="submit"
                disabled={adjustModal.amount <= 0}
                className={`py-2 px-5 rounded-xl font-bold text-sm transition-all border-2 border-black bg-white text-black ${
                  adjustModal.amount <= 0
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-slate-100 active:scale-98 shadow-sm cursor-pointer'
                }`}
              >
                Deduct
              </button>
            )}
          </div>
        </form>
      </Modal>

      {/* 3. Multi-Person Shared "+ Add Expense" Modal */}
      <Modal
        isOpen={isSharedExpenseOpen}
        onClose={() => setIsSharedExpenseOpen(false)}
        title="Add Shared Expense"
      >
        <form onSubmit={handleSharedExpenseSubmit} className="space-y-4">
          <Input
            label="Purpose"
            placeholder="e.g. Dinner, Snacks, Cab"
            value={expenseDesc}
            onChange={(e) => setExpenseDesc(e.target.value)}
            autoFocus
          />

          <CurrencyInput
            label="Total Amount *"
            value={expenseTotal}
            onChange={(val) => {
              setExpenseTotal(val);
              setExpenseError('');
            }}
          />

          {/* Split Mode Toggle */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Split Mode
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setSharedExpenseSplitType('equal')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  sharedExpenseSplitType === 'equal'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Equal Split
              </button>
              <button
                type="button"
                onClick={() => setSharedExpenseSplitType('custom')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  sharedExpenseSplitType === 'custom'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Custom Per Person
              </button>
            </div>
          </div>

          {/* People Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Who is splitting with you? ({selectedFriendIds.length})
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {friends.map((f) => {
                const isSelected = selectedFriendIds.includes(f.id);
                return (
                  <div
                    key={f.id}
                    onClick={() => toggleExpenseFriend(f.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer select-none transition-all ${
                      isSelected
                        ? 'border-slate-900 bg-slate-900 text-white font-semibold'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-xs truncate">{f.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom Share Input if custom split */}
          {sharedExpenseSplitType === 'custom' && selectedFriendIds.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <p className="font-bold text-slate-700">Enter each person's share:</p>
                <span className="text-[11px] text-slate-500 font-semibold">
                  Total Bill: {formatCurrency(expenseTotal)}
                </span>
              </div>

              <div className="space-y-2">
                {selectedFriendIds.map((fId) => {
                  const friend = friends.find((f) => f.id === fId);
                  return (
                    <div key={fId} className="flex items-center justify-between text-xs gap-3">
                      <span className="font-semibold text-slate-800 truncate">{friend?.name}</span>
                      <div className="w-28 shrink-0">
                        <CurrencyInput
                          value={customFriendShares[fId] || 0}
                          onChange={(val) => {
                            setCustomFriendShares((prev) => ({ ...prev, [fId]: val }));
                            setExpenseError('');
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Real-time Math Summary Card */}
              <div
                className={`p-3 rounded-2xl border text-xs space-y-1.5 transition-all ${
                  isCustomOverallocated
                    ? 'bg-rose-50/90 border-rose-200 text-rose-800'
                    : 'bg-slate-50 border-slate-200/80 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between font-medium">
                  <span>Friends' shares total:</span>
                  <span
                    className={`font-black ${
                      isCustomOverallocated ? 'text-rose-700 text-sm' : 'text-slate-900'
                    }`}
                  >
                    {formatCurrency(fromPaise(totalCustomSharesPaise))}
                  </span>
                </div>

                {isCustomOverallocated ? (
                  <div className="pt-1.5 border-t border-rose-200 font-bold text-rose-700 flex items-center justify-between">
                    <span>⚠️ Exceeds total bill by:</span>
                    <span>+{formatCurrency(customDifference)}</span>
                  </div>
                ) : (
                  <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Your share remaining:</span>
                    <span className="font-bold text-emerald-700">
                      {formatCurrency(fromPaise(Math.max(0, yourSharePaise)))}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {expenseError && (
            <p className="text-xs text-rose-600 font-semibold">{expenseError}</p>
          )}

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsSharedExpenseOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                expenseTotal <= 0 ||
                selectedFriendIds.length === 0 ||
                (sharedExpenseSplitType === 'custom' &&
                  (isCustomOverallocated || totalCustomSharesPaise <= 0))
              }
            >
              Apply Expense
            </Button>
          </div>
        </form>
      </Modal>

      {/* 4. Edit Expense Entry Modal */}
      <Modal
        isOpen={editEntryModal.isOpen}
        onClose={() =>
          setEditEntryModal({ isOpen: false, friendId: '', entryId: '', purpose: '', amount: 0 })
        }
        title="Edit Expense"
      >
        <form onSubmit={handleEditEntrySubmit} className="space-y-4">
          <Input
            label="Purpose"
            placeholder="e.g. Dinner, Snacks, Cab"
            value={editEntryModal.purpose}
            onChange={(e) =>
              setEditEntryModal((prev) => ({ ...prev, purpose: e.target.value }))
            }
            autoFocus
          />

          <CurrencyInput
            label="Amount *"
            value={editEntryModal.amount}
            onChange={(val) =>
              setEditEntryModal((prev) => ({ ...prev, amount: val }))
            }
          />

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                setEditEntryModal({ isOpen: false, friendId: '', entryId: '', purpose: '', amount: 0 })
              }
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={editEntryModal.amount <= 0}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
