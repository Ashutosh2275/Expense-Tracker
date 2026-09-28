import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Users, History, User } from 'lucide-react';
import { clsx } from 'clsx';

export const BottomNavigation: React.FC = () => {
  const navItems = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/people', label: 'People', icon: Users },
    { to: '/activity', label: 'Activity', icon: History },
    { to: '/profile', label: 'Profile', icon: User },
  ];

  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200/80 z-30 pb-safe">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] font-medium transition-colors select-none min-h-[44px]',
                isActive ? 'text-slate-950 font-semibold' : 'text-slate-500 hover:text-slate-700'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={clsx(
                    'w-5 h-5 mb-1 transition-transform',
                    isActive ? 'stroke-[2.25] scale-105' : 'stroke-[1.75]'
                  )}
                />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
