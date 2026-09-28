import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, CreditCard, Calendar, UserCheck } from 'lucide-react';
import { useExpenses, useParticipants, usePeople, usePayments, useDeleteExpense } from '@/hooks/useData';
import { useUIStore } from '@/stores/uiStore';
import { formatCurrency } from '@/utils/currency';
import { formatDisplayDate } from '@/utils/date';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

export const ExpenseDetailPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: expenses = [], isLoading: loadingExp } = useExpenses();
  const { data: participants = [], isLoading: loadingParts } = useParticipants();
  const { data: people = [] } = usePeople();
  const { data: payments = [] } = usePayments();
  const deleteExpenseMutation = useDeleteExpense();
  const openRecordPayment = useUIStore((state) => state.openRecordPayment);

  const expense = expenses.find((e) => e.id === id);
  const expenseParts = participants.filter((p) => p.expense_id === id);
  const expensePayments = payments.filter((p) => p.expense_id === id);

  if (loadingExp || loadingParts) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto py-2">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-44 w-full rounded-3xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600 font-medium">Expense not found.</p>
        <Button className="mt-4" onClick={() => navigate('/')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const isPaidByYou = expense.paid_by === null;
  const payer = people.find((p) => p.id === expense.paid_by);
  const payerName = isPaidByYou ? 'You' : payer?.name || 'Friend';

  const handleDelete = async () => {
    if (window.confirm(`Delete expense "${expense.description}"?`)) {
      await deleteExpenseMutation.mutateAsync(expense.id);
      navigate('/');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-16">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-700 hover:text-slate-950 font-semibold text-sm p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 transition-colors min-h-[44px]"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <button
          onClick={handleDelete}
          className="text-slate-400 hover:text-rose-600 p-2 rounded-lg hover:bg-slate-100 transition-colors"
          title="Delete expense"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Hero Expense Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {expense.description}
          </h2>
          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1.5">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatDisplayDate(expense.expense_date)}</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Paid by {payerName}</span>
            </span>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Amount
          </span>
          <span className="text-3xl font-extrabold text-slate-900">
            {formatCurrency(expense.total_amount)}
          </span>
        </div>
      </div>

      {/* Split Breakdown */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Split Details ({expenseParts.length} people)
        </h3>

        <div className="divide-y divide-slate-100">
          {expenseParts.map((part) => {
            const isYou = part.person_id === null;
            const person = people.find((p) => p.id === part.person_id);
            const name = isYou ? 'You' : person?.name || 'Friend';

            return (
              <div key={part.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{name}</p>
                  <p className="text-xs text-slate-500">
                    {isYou && isPaidByYou
                      ? 'Your personal share'
                      : isPaidByYou
                      ? `${name} owes you`
                      : isYou
                      ? `You owe ${payerName}`
                      : `${name}'s share`}
                  </p>
                </div>
                <span className="text-sm font-bold text-slate-900">
                  {formatCurrency(part.share_amount)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Linked Payments */}
      {expensePayments.length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Payments Received for This Expense
          </h3>
          <div className="divide-y divide-slate-100">
            {expensePayments.map((p) => {
              const fromPerson = people.find((person) => person.id === p.from_person_id);
              return (
                <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-900">
                      {fromPerson?.name || 'Friend'} paid
                    </span>
                    <span className="text-slate-500 ml-1.5">
                      on {formatDisplayDate(p.payment_date)} via {p.payment_method}
                    </span>
                  </div>
                  <span className="font-bold text-emerald-600">
                    {formatCurrency(p.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex justify-center pt-2">
        <Button
          onClick={() => openRecordPayment(null, expense.id)}
          className="gap-2 px-6 shadow-sm"
        >
          <CreditCard className="w-4 h-4" />
          <span>Record Payment for this Expense</span>
        </Button>
      </div>
    </div>
  );
};
