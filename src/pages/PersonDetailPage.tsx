import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Trash2, CheckCircle, Receipt } from 'lucide-react';
import { usePersonDetail, useDeletePerson, useDeletePayment, useBalances } from '@/hooks/useData';
import { useUIStore } from '@/stores/uiStore';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { PaymentRow } from '@/components/domain/PaymentRow';
import { formatCurrency } from '@/utils/currency';
import { formatDisplayDate } from '@/utils/date';

export const PersonDetailPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { person, balance, sharedExpenses, paymentHistory, isLoading } = usePersonDetail(id);
  const { people } = useBalances();
  const openRecordPayment = useUIStore((state) => state.openRecordPayment);
  const deletePersonMutation = useDeletePerson();
  const deletePaymentMutation = useDeletePayment();

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto py-2">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-44 w-full rounded-3xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (!person || !balance) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600 font-medium">Person not found.</p>
        <Button className="mt-4" onClick={() => navigate('/people')}>
          Back to People
        </Button>
      </div>
    );
  }

  const isReceivable = balance.netBalance > 0;
  const isSettled = balance.isSettled;

  const handleDeletePerson = async () => {
    if (window.confirm(`Are you sure you want to remove ${person.name}? Associated past expenses will remain in history.`)) {
      await deletePersonMutation.mutateAsync(person.id);
      navigate('/people');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-16">
      {/* Top Bar with Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/people')}
          className="flex items-center gap-2 text-slate-700 hover:text-slate-950 font-semibold text-sm p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 transition-colors min-h-[44px]"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>People</span>
        </button>

        <button
          onClick={handleDeletePerson}
          className="text-slate-400 hover:text-rose-600 p-2 rounded-lg hover:bg-slate-100 transition-colors"
          title="Delete person"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Person Hero Status Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm text-center">
        <div className="flex justify-center mb-3">
          <Avatar name={person.name} size="lg" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">{person.name}</h2>
        {person.phone && <p className="text-xs text-slate-500 mt-0.5">{person.phone}</p>}
        {person.note && <p className="text-xs text-slate-500 italic mt-0.5">"{person.note}"</p>}

        <div className="mt-6 pt-5 border-t border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {isSettled
              ? 'Current Status'
              : balance.isOverpaid
              ? 'Overpayment Status'
              : isReceivable
              ? 'You should receive'
              : 'You owe'}
          </p>

          <div className="mt-2">
            {isSettled ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full font-bold text-base">
                <CheckCircle className="w-5 h-5 stroke-[2.5]" />
                <span>Settled (₹0 pending)</span>
              </div>
            ) : balance.isOverpaid ? (
              <div>
                <p className="text-3xl font-extrabold text-amber-600 tracking-tight">
                  {formatCurrency(balance.overpaidAmount)}
                </p>
                <p className="text-xs text-amber-700 mt-1 font-medium">
                  {person.name} has overpaid by {formatCurrency(balance.overpaidAmount)}
                </p>
              </div>
            ) : (
              <p
                className={`text-3xl font-extrabold tracking-tight ${
                  isReceivable ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {formatCurrency(Math.abs(balance.netBalance))}
              </p>
            )}
          </div>

          <div className="mt-6 flex justify-center">
            <Button
              onClick={() => openRecordPayment(person.id)}
              className="gap-2 px-6 shadow-sm"
            >
              <CreditCard className="w-4 h-4" />
              <span>Record Payment</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Shared Expenses Breakdown */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider px-1">
          Shared Expenses ({sharedExpenses.length})
        </h3>

        {sharedExpenses.length > 0 ? (
          <div className="space-y-2.5">
            {sharedExpenses.map((exp) => (
              <div
                key={exp.id}
                onClick={() => navigate(`/expenses/${exp.id}`)}
                className="flex items-center justify-between p-3.5 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-slate-900 truncate">
                      {exp.description}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {formatDisplayDate(exp.expense_date)} • Total: {formatCurrency(exp.total_amount)}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {exp.isPayer ? (
                    <div>
                      <p className="text-xs text-slate-500 font-medium">You owe</p>
                      <p className="text-sm font-bold text-rose-600">
                        {formatCurrency(exp.yourShare)}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-slate-500 font-medium">{person.name}'s share</p>
                      <p className="text-sm font-bold text-emerald-600">
                        {formatCurrency(exp.personShare)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-5 bg-slate-50 border border-slate-200/80 rounded-2xl text-center text-xs text-slate-500">
            No shared expenses recorded with {person.name} yet.
          </div>
        )}
      </div>

      {/* Payment History */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider px-1">
          Payment History ({paymentHistory.length})
        </h3>

        {paymentHistory.length > 0 ? (
          <div className="space-y-2.5">
            {paymentHistory.map((payment) => (
              <PaymentRow
                key={payment.id}
                payment={payment}
                people={people}
                onDelete={(pid) => deletePaymentMutation.mutate(pid)}
              />
            ))}
          </div>
        ) : (
          <div className="p-5 bg-slate-50 border border-slate-200/80 rounded-2xl text-center text-xs text-slate-500">
            No payments recorded yet.
          </div>
        )}
      </div>

      {/* Summary Footer */}
      <div className="bg-slate-100/70 rounded-2xl p-4 flex items-center justify-between text-xs text-slate-600">
        <span className="font-semibold uppercase tracking-wider">Total Spent Together</span>
        <span className="font-bold text-slate-900 text-sm">
          {formatCurrency(balance.totalSpentTogether)}
        </span>
      </div>
    </div>
  );
};
