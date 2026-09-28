import React from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { formatCurrency } from '@/utils/currency';
import { formatDisplayDate } from '@/utils/date';
import { Payment, Person } from '@/types/database';

interface PaymentRowProps {
  payment: Payment;
  people: Person[];
  currentPersonId?: string; // Optional context
  onDelete?: (id: string) => void;
}

export const PaymentRow: React.FC<PaymentRowProps> = ({
  payment,
  people,
  onDelete,
}) => {
  // Check direction: Did friend pay you, or did you pay friend?
  const isFromFriendToYou = payment.from_person_id !== null && (!payment.to_person_id || payment.to_person_id === null);
  const friend = people.find(
    (p) => p.id === (isFromFriendToYou ? payment.from_person_id : payment.to_person_id)
  );
  const friendName = friend?.name || 'Friend';

  return (
    <div className="flex items-center justify-between p-3.5 sm:p-4 bg-white border border-slate-200/80 rounded-2xl min-h-[56px]">
      <div className="flex items-center gap-3 min-w-0 pr-2">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            isFromFriendToYou
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-blue-100 text-blue-700'
          }`}
        >
          {isFromFriendToYou ? (
            <ArrowDownLeft className="w-5 h-5 stroke-[2.5]" />
          ) : (
            <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
          )}
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-slate-900 truncate">
            {isFromFriendToYou
              ? `${friendName} paid you`
              : `You paid ${friendName}`}
          </h4>
          <p className="text-xs text-slate-500 truncate">
            {formatDisplayDate(payment.payment_date)} • {payment.payment_method}
            {payment.note ? ` • ${payment.note}` : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span
          className={`text-sm font-bold ${
            isFromFriendToYou ? 'text-emerald-600' : 'text-slate-800'
          }`}
        >
          {formatCurrency(payment.amount)}
        </span>
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm('Delete this payment record?')) {
                onDelete(payment.id);
              }
            }}
            className="text-xs text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            title="Delete payment"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};
