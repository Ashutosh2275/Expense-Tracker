import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/utils/currency';
import { formatDisplayDate } from '@/utils/date';
import { Expense, ExpenseParticipant, Person } from '@/types/database';

interface ExpenseRowProps {
  expense: Expense;
  participants: ExpenseParticipant[];
  people: Person[];
}

export const ExpenseRow: React.FC<ExpenseRowProps> = ({
  expense,
  participants,
  people,
}) => {
  const navigate = useNavigate();

  // Determine who paid
  const isPaidByYou = expense.paid_by === null;
  const payerPerson = people.find((p) => p.id === expense.paid_by);
  const payerName = isPaidByYou ? 'You' : payerPerson?.name || 'Friend';

  // Find your share in this expense
  const parts = participants.filter((p) => p.expense_id === expense.id);
  const yourSharePart = parts.find((p) => p.person_id === null);
  const yourShare = yourSharePart ? yourSharePart.share_amount : 0;

  // If you paid, calculate how much others owe you for this expense
  const othersOwed = parts
    .filter((p) => p.person_id !== null)
    .reduce((sum, p) => sum + p.share_amount, 0);

  return (
    <div
      onClick={() => navigate(`/expenses/${expense.id}`)}
      className="flex items-center justify-between p-3.5 sm:p-4 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl cursor-pointer active:scale-[0.99] transition-all select-none min-h-[56px]"
    >
      <div className="flex items-center gap-3 min-w-0 pr-2">
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
          <Receipt className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-slate-900 truncate">
            {expense.description}
          </h4>
          <p className="text-xs text-slate-500 truncate">
            {formatDisplayDate(expense.expense_date)} • {payerName} paid {formatCurrency(expense.total_amount)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          {isPaidByYou ? (
            <div>
              <p className="text-xs text-slate-500 font-medium">You lent</p>
              <p className="text-sm font-bold text-emerald-600">
                +{formatCurrency(othersOwed)}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-slate-500 font-medium">You borrowed</p>
              <p className="text-sm font-bold text-rose-600">
                -{formatCurrency(yourShare)}
              </p>
            </div>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400" />
      </div>
    </div>
  );
};
