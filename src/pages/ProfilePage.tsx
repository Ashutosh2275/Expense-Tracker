import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck,
  LogOut,
  Trash2,
  Sparkles,
  Smartphone,
} from 'lucide-react';
import { useCurrentUser } from '@/hooks/useData';
import { authService, loadDemoScenario, clearAllLocalData } from '@/services/api';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const [seedStatus, setSeedStatus] = useState<string>('');

  const handleSignOut = async () => {
    await authService.signOut();
    queryClient.clear();
    navigate('/auth');
  };

  const handleLoadSeed = async () => {
    await loadDemoScenario();
    queryClient.invalidateQueries();
    setSeedStatus('Sample data loaded successfully!');
    setTimeout(() => setSeedStatus(''), 3000);
  };

  const handleClearData = () => {
    if (window.confirm('Clear all local transactions and people?')) {
      clearAllLocalData();
      queryClient.invalidateQueries();
      setSeedStatus('Local data cleared.');
      setTimeout(() => setSeedStatus(''), 3000);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-16">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Profile & Settings</h2>
        <p className="text-xs text-slate-500">Account and application preferences</p>
      </div>

      {/* User Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm flex items-center gap-4">
        <Avatar name={user?.name || 'User'} size="lg" />
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-slate-900 truncate">
            {user?.name || 'Ashutosh'}
          </h3>
          <p className="text-xs text-slate-500 truncate">{user?.email || 'ashutosh@example.com'}</p>
        </div>
      </div>

      {/* Infrastructure & Zero Cost Guarantee */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Architecture & Cost (₹0/mo)
          </h4>
        </div>

        <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
          <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
            <span className="font-medium text-slate-500">Database & Auth</span>
            <span className="font-semibold text-slate-900">
              {isSupabaseConfigured ? 'Supabase Free Tier (PostgreSQL + RLS)' : 'Local Storage Mode'}
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
            <span className="font-medium text-slate-500">Monthly Operating Cost</span>
            <span className="font-bold text-emerald-600">₹0.00 / month</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
            <span className="font-medium text-slate-500">PWA Offline Mode</span>
            <span className="font-semibold text-emerald-700">Supported (Service Worker Cached)</span>
          </div>
        </div>

        {!isSupabaseConfigured && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-800">
            Currently operating in local client mode. To connect to your own permanent Supabase database, supply <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in your environment.
          </div>
        )}
      </div>

      {/* iPhone PWA Installation Instructions */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-slate-700" />
          <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Install on iPhone
          </h4>
        </div>
        <ol className="text-xs text-slate-600 list-decimal list-inside space-y-1.5 leading-normal">
          <li>Open this web application in <strong>Safari</strong> on your iPhone.</li>
          <li>Tap the <strong>Share</strong> button (box with an upward arrow) at the bottom.</li>
          <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
          <li>Tap <strong>Add</strong> at the top right.</li>
        </ol>
      </div>

      {/* Development & Testing Tools */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-3">
        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Testing & Data Management
        </h4>

        {seedStatus && (
          <div className="p-2.5 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-xl border border-emerald-200">
            {seedStatus}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadSeed}
            className="gap-2 text-xs justify-start"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Load Sample Friends (Priya, Swayam)</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleClearData}
            className="gap-2 text-xs justify-start text-rose-600 hover:text-rose-700"
          >
            <Trash2 className="w-4 h-4" />
            <span>Reset / Clear All Data</span>
          </Button>
        </div>
      </div>

      {/* Sign Out Button */}
      <div className="pt-2">
        <Button
          variant="outline"
          onClick={handleSignOut}
          className="w-full text-rose-600 hover:bg-rose-50 hover:text-rose-700 border-rose-200 gap-2"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </Button>
      </div>
    </div>
  );
};
