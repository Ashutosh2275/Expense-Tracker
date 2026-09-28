import React from 'react';
import { ArrowDownLeft, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/utils/currency';

interface BalanceCardProps {
  userName: string;
  totalReceivable: number;
  totalPayable: number;
  netBalance: number;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  userName,
  totalReceivable,
  totalPayable,
  netBalance,
}) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const isNetPositive = netBalance > 0;
  const isNetZero = netBalance === 0;

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm">
      {/* Top User Greeting */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            {getGreeting()}
          </p>
          <h2 className="text-xl font-bold text-slate-900 mt-0.5">{userName}</h2>
        </div>
      </div>

      {/* Main Balance Metrics */}
      <div className="grid grid-cols-2 gap-4 py-5 border-b border-slate-100">
        {/* You should receive */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
              <ArrowDownLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
            <span>You should receive</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-600 tracking-tight">
            {formatCurrency(totalReceivable)}
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
          <p className="text-2xl sm:text-3xl font-bold text-rose-600 tracking-tight">
            {formatCurrency(totalPayable)}
          </p>
        </div>
      </div>

      {/* Net Balance Footer */}
      <div className="pt-4 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Net balance
        </span>
        <div className="flex items-center gap-1.5">
          {isNetZero ? (
            <div className="flex items-center gap-1 text-slate-700 font-semibold text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Settled</span>
            </div>
          ) : (
            <span
              className={`text-lg font-bold ${
                isNetPositive ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {isNetPositive ? '+' : ''}
              {formatCurrency(netBalance)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
