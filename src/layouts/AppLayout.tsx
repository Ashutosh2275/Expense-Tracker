import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SidebarNavigation } from '@/components/navigation/SidebarNavigation';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { FloatingActionButton } from '@/components/ui/FloatingActionButton';
import { RecordPaymentModal } from '@/components/modals/RecordPaymentModal';
import { AddPersonModal } from '@/components/modals/AddPersonModal';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useUIStore } from '@/stores/uiStore';

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const setAddExpenseOpen = useUIStore((state) => state.setAddExpenseOpen);

  const isAddExpenseRoute = location.pathname === '/add-expense';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col sm:flex-row font-sans antialiased text-slate-900">
      {/* Desktop Sidebar Navigation */}
      <SidebarNavigation />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Offline connectivity banner */}
        <OfflineBanner />

        {/* Mobile Header */}
        <header className="sm:hidden flex items-center justify-between px-4 py-3 bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-sm">
              ₹
            </div>
            <span className="font-bold text-slate-900 text-sm">Expense Tracker</span>
          </div>
        </header>

        {/* Dynamic Page Outlet with safe area padding */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-4xl w-full mx-auto pb-24 sm:pb-8">
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation */}
        <BottomNavigation />

        {/* Floating Action Button (+ Expense) on Mobile if not already on add-expense screen */}
        {!isAddExpenseRoute && (
          <div className="sm:hidden">
            <FloatingActionButton
              onClick={() => {
                setAddExpenseOpen(true);
                navigate('/add-expense');
              }}
              label="Expense"
            />
          </div>
        )}
      </div>

      {/* Global Shared Modals */}
      <RecordPaymentModal />
      <AddPersonModal />
    </div>
  );
};
