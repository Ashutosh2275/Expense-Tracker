import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Receipt, ArrowRight } from 'lucide-react';
import { useBalances, useCurrentUser } from '@/hooks/useData';
import { useUIStore } from '@/stores/uiStore';
import { BalanceCard } from '@/components/domain/BalanceCard';
import { PersonRow } from '@/components/domain/PersonRow';
import { ExpenseRow } from '@/components/domain/ExpenseRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const { summary, expenses, participants, people, isLoading } = useBalances();
  const setAddExpenseOpen = useUIStore((state) => state.setAddExpenseOpen);
  const setAddPersonOpen = useUIStore((state) => state.setAddPersonOpen);

  const userName = user?.name || 'Ashutosh';

  // Filter pending people (people who owe you or you owe)
  const pendingPeople = summary.pendingPeople.filter((p) => !p.isSettled);

  // Recent expenses (top 5)
  const recentExpenses = expenses.slice(0, 5);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto py-2">
        <Skeleton className="h-48 w-full rounded-3xl" />
        <div className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-8">
      {/* Hero Balance Summary */}
      <BalanceCard
        userName={userName}
        totalReceivable={summary.totalReceivable}
        totalPayable={summary.totalPayable}
        netBalance={summary.netBalance}
      />

      {/* Pending Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Pending
          </h3>
          {people.length > 0 && (
            <button
              onClick={() => navigate('/people')}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
            >
              <span>View all ({people.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {pendingPeople.length > 0 ? (
          <div className="space-y-2.5">
            {pendingPeople.map((person) => (
              <PersonRow key={person.personId} person={person} />
            ))}
          </div>
        ) : people.length === 0 ? (
          <EmptyState
            icon={<Users className="w-8 h-8" />}
            title="No friends added yet"
            description="Add your friends to start splitting expenses and tracking balances."
            actionLabel="+ Add Person"
            onAction={() => setAddPersonOpen(true)}
          />
        ) : (
          <div className="p-4 bg-emerald-50/60 border border-emerald-200/60 rounded-2xl text-center">
            <p className="text-xs font-semibold text-emerald-800">
              All settled up! No pending payments right now.
            </p>
          </div>
        )}
      </div>

      {/* Recent Activity Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Recent Activity
          </h3>
          {expenses.length > 0 && (
            <button
              onClick={() => navigate('/activity')}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {recentExpenses.length > 0 ? (
          <div className="space-y-2.5">
            {recentExpenses.map((expense) => (
              <ExpenseRow
                key={expense.id}
                expense={expense}
                participants={participants}
                people={people}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Receipt className="w-8 h-8" />}
            title="No pending expenses"
            description="Add your first expense to start tracking shared payments."
            actionLabel="+ Add Expense"
            onAction={() => setAddExpenseOpen(true)}
          />
        )}
      </div>

      {/* Quick Action Button for Desktop */}
      <div className="hidden sm:flex justify-center pt-4">
        <Button
          size="lg"
          onClick={() => setAddExpenseOpen(true)}
          className="shadow-md gap-2"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span>Add New Expense</span>
        </Button>
      </div>
    </div>
  );
};
