import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Users, History, User, PlusCircle, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useUIStore } from '@/stores/uiStore';

export const SidebarNavigation: React.FC = () => {
  const setAddExpenseOpen = useUIStore((state) => state.setAddExpenseOpen);

  const navItems = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/people', label: 'People', icon: Users },
    { to: '/activity', label: 'Activity', icon: History },
    { to: '/profile', label: 'Profile', icon: User },
  ];

  return (
    <aside className="hidden sm:flex flex-col w-64 border-r border-slate-200 bg-white min-h-screen p-4 select-none shrink-0">
      {/* Brand Header */}
      <div className="flex items-center gap-2.5 px-3 py-3 mb-6">
        <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-white font-bold text-base shadow-xs">
          ₹
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900 leading-tight">Expense Tracker</h1>
          <p className="text-[11px] text-slate-500 font-medium">Personal & Free</p>
        </div>
      </div>

      {/* Quick Add Expense Action */}
      <button
        onClick={() => setAddExpenseOpen(true)}
        className="w-full mb-6 flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm"
      >
        <PlusCircle className="w-4 h-4" />
        <span>Add Expense</span>
      </button>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1.5">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'bg-slate-100 text-slate-950 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )
            }
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Cloud / Sync Status Footer */}
      <div className="pt-4 border-t border-slate-100">
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500">
          <ShieldCheck className={clsx('w-4 h-4', isSupabaseConfigured ? 'text-emerald-600' : 'text-amber-500')} />
          <span>{isSupabaseConfigured ? 'Supabase Connected' : 'Local / Offline Mode'}</span>
        </div>
      </div>
    </aside>
  );
};
