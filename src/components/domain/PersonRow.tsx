import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Check } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { formatCurrency } from '@/utils/currency';
import { PersonBalance } from '@/types/database';

interface PersonRowProps {
  person: PersonBalance;
}

export const PersonRow: React.FC<PersonRowProps> = ({ person }) => {
  const navigate = useNavigate();

  const isOwedToYou = person.netBalance > 0;
  const isYouOwe = person.netBalance < 0 && !person.isOverpaid;
  const isSettled = person.isSettled;

  return (
    <div
      onClick={() => navigate(`/people/${person.personId}`)}
      className="flex items-center justify-between p-3.5 sm:p-4 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl cursor-pointer active:scale-[0.99] transition-all select-none min-h-[56px]"
    >
      <div className="flex items-center gap-3 min-w-0 pr-2">
        <Avatar name={person.name} size="md" />
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-slate-900 truncate">{person.name}</h4>
          {person.note && (
            <p className="text-xs text-slate-500 truncate">{person.note}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          {isSettled ? (
            <div className="flex items-center justify-end gap-1 text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
              <span>Settled</span>
            </div>
          ) : person.isOverpaid ? (
            <div>
              <p className="text-xs font-semibold text-amber-600">
                Overpaid {formatCurrency(person.overpaidAmount)}
              </p>
            </div>
          ) : isOwedToYou ? (
            <div>
              <p className="text-xs text-slate-500 font-medium">Owes you</p>
              <p className="text-sm font-bold text-emerald-600">
                {formatCurrency(person.netBalance)}
              </p>
            </div>
          ) : isYouOwe ? (
            <div>
              <p className="text-xs text-slate-500 font-medium">You owe</p>
              <p className="text-sm font-bold text-rose-600">
                {formatCurrency(Math.abs(person.netBalance))}
              </p>
            </div>
          ) : null}
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400" />
      </div>
    </div>
  );
};
