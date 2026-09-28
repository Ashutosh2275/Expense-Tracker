import React from 'react';
import { Plus } from 'lucide-react';

interface FABProps {
  onClick: () => void;
  label?: string;
}

export const FloatingActionButton: React.FC<FABProps> = ({
  onClick,
  label = 'Expense',
}) => {
  return (
    <button
      onClick={onClick}
      className="fixed right-4 bottom-20 sm:bottom-8 z-40 flex items-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-full shadow-lg hover:bg-slate-800 active:scale-95 transition-all select-none focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 min-h-[48px]"
      aria-label={label}
    >
      <Plus className="w-5 h-5 stroke-[2.5]" />
      <span className="text-sm font-semibold tracking-wide pr-0.5">{label}</span>
    </button>
  );
};
