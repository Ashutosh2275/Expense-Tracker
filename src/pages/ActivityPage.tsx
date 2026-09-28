import React from 'react';
import { Search, Receipt, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useExpenses, useParticipants, usePeople, usePayments } from '@/hooks/useData';
import { useUIStore, ActivityFilter } from '@/stores/uiStore';
import { formatCurrency } from '@/utils/currency';
import { formatDisplayDate } from '@/utils/date';
import { Skeleton } from '@/components/ui/Skeleton';

interface UnifiedActivityItem {
  id: string;
  type: 'expense' | 'payment';
  date: string;
  timestamp: number;
  title: string;
  subtitle: string;
  amount: number;
  direction: 'lent' | 'borrowed' | 'received' | 'sent';
  expenseId?: string;
}

export const ActivityPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: expenses = [], isLoading: loadingExp } = useExpenses();
  const { data: participants = [], isLoading: loadingParts } = useParticipants();
  const { data: people = [], isLoading: loadingPeople } = usePeople();
  const { data: payments = [], isLoading: loadingPayments } = usePayments();

  const {
    activityFilter,
    setActivityFilter,
    activitySearchQuery,
    setActivitySearchQuery,
  } = useUIStore();

  const isLoading = loadingExp || loadingParts || loadingPeople || loadingPayments;

  // Build unified items
  const activityItems: UnifiedActivityItem[] = [];

  // 1. Process Expenses
  for (const exp of expenses) {
    const isPaidByYou = exp.paid_by === null;
    const payer = people.find((p) => p.id === exp.paid_by);
    const payerName = isPaidByYou ? 'You' : payer?.name || 'Friend';

    const parts = participants.filter((p) => p.expense_id === exp.id);
    const yourPart = parts.find((p) => p.person_id === null);
    const yourShare = yourPart ? yourPart.share_amount : 0;
    const othersShare = parts
      .filter((p) => p.person_id !== null)
      .reduce((s, p) => s + p.share_amount, 0);

    const involvedNames = parts
      .map((p) => (p.person_id === null ? 'You' : people.find((per) => per.id === p.person_id)?.name || 'Friend'))
      .join(', ');

    activityItems.push({
      id: 'exp-' + exp.id,
      type: 'expense',
      date: exp.expense_date,
      timestamp: new Date(exp.created_at || exp.expense_date).getTime(),
      title: exp.description,
      subtitle: `${payerName} paid • with ${involvedNames}`,
      amount: isPaidByYou ? othersShare : yourShare,
      direction: isPaidByYou ? 'lent' : 'borrowed',
      expenseId: exp.id,
    });
  }

  // 2. Process Payments
  for (const pay of payments) {
    const isFromFriend = pay.from_person_id !== null;
    const friend = people.find((p) => p.id === (isFromFriend ? pay.from_person_id : pay.to_person_id));
    const friendName = friend?.name || 'Friend';

    activityItems.push({
      id: 'pay-' + pay.id,
      type: 'payment',
      date: pay.payment_date,
      timestamp: new Date(pay.created_at || pay.payment_date).getTime(),
      title: isFromFriend ? `${friendName} paid you` : `You paid ${friendName}`,
      subtitle: `${pay.payment_method}${pay.note ? ` • ${pay.note}` : ''}`,
      amount: pay.amount,
      direction: isFromFriend ? 'received' : 'sent',
    });
  }

  // Sort chronologically descending
  activityItems.sort((a, b) => b.timestamp - a.timestamp);

  // Apply search query
  const query = activitySearchQuery.toLowerCase().trim();
  const filteredBySearch = activityItems.filter((item) =>
    query === ''
      ? true
      : item.title.toLowerCase().includes(query) ||
        item.subtitle.toLowerCase().includes(query)
  );

  // Apply tab filters: All, Owed to me (lent), I owe (borrowed), Settled (payments)
  const filteredItems = filteredBySearch.filter((item) => {
    if (activityFilter === 'all') return true;
    if (activityFilter === 'owed_to_me') return item.direction === 'lent';
    if (activityFilter === 'i_owe') return item.direction === 'borrowed';
    if (activityFilter === 'settled') return item.type === 'payment';
    return true;
  });

  const filterTabs: { id: ActivityFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'owed_to_me', label: 'Owed to me' },
    { id: 'i_owe', label: 'I owe' },
    { id: 'settled', label: 'Settled' },
  ];

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-16">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Activity</h2>
        <p className="text-xs text-slate-500">Timeline of expenses and settlements</p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          placeholder="Search activity by note, expense or friend..."
          value={activitySearchQuery}
          onChange={(e) => setActivitySearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200/90 rounded-2xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent min-h-[44px]"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActivityFilter(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all min-h-[36px] ${
              activityFilter === tab.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Activity Timeline Feed */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="space-y-2.5">
          {filteredItems.map((item) => {
            const isClickable = item.type === 'expense' && item.expenseId;

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (isClickable) navigate(`/expenses/${item.expenseId}`);
                }}
                className={`flex items-center justify-between p-3.5 bg-white border border-slate-200/80 rounded-2xl transition-all ${
                  isClickable ? 'cursor-pointer hover:bg-slate-50 active:scale-[0.99]' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      item.type === 'expense'
                        ? 'bg-slate-100 text-slate-700'
                        : item.direction === 'received'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {item.type === 'expense' ? (
                      <Receipt className="w-5 h-5" />
                    ) : item.direction === 'received' ? (
                      <ArrowDownLeft className="w-5 h-5 stroke-[2.5]" />
                    ) : (
                      <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-slate-900 truncate">
                      {item.title}
                    </h4>
                    <p className="text-xs text-slate-500 truncate">
                      {formatDisplayDate(item.date)} • {item.subtitle}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`text-sm font-bold ${
                      item.direction === 'lent' || item.direction === 'received'
                        ? 'text-emerald-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {item.direction === 'lent' || item.direction === 'received' ? '+' : '-'}
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-500 text-sm">
          No activity matches current filters.
        </div>
      )}
    </div>
  );
};
