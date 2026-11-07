import React from 'react';
import {
  LayoutDashboard,
  Store,
  FileText,
  Users,
  Boxes,
  Wallet,
  BarChart3,
  QrCode,
  Settings,
  ShoppingCart,
  LogOut,
  LogIn,
  User,
  Database,
  UserCog,
} from 'lucide-react';
import { AppUser } from '../types/pos.ts';
import { SappyLogo } from './SappyLogo.tsx';
import { PulseSyncIndicator } from './LoadingAnimation.tsx';

export type TabType =
  | 'dashboard'
  | 'register'
  | 'sales'
  | 'credit'
  | 'inventory'
  | 'expenses'
  | 'reports'
  | 'qrstudio'
  | 'users'
  | 'settings'
  | 'sync';

interface NavbarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  cartItemCount: number;
  onOpenCart?: () => void;
  dbConnected?: boolean;
  currentUser: AppUser | null;
  onSignOut: () => void;
  onOpenAuth: () => void;
  syncStatus?: 'synced' | 'syncing' | 'offline' | 'error';
  isSyncing?: boolean;
  onManualSync?: () => void;
  onOpenCloudSync?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  cartItemCount,
  onOpenCart,
  dbConnected,
  currentUser,
  onSignOut,
  onOpenAuth,
  syncStatus = 'synced',
  isSyncing = false,
  onManualSync,
  onOpenCloudSync,
}) => {
  const navItems: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'register', label: 'POS Register', icon: Store },
    { id: 'sales', label: 'Sales Ledger', icon: FileText },
    { id: 'credit', label: 'Credit & Debt', icon: Users },
    { id: 'inventory', label: 'Inventory', icon: Boxes },
    { id: 'expenses', label: 'Expenses', icon: Wallet },
    { id: 'reports', label: 'General Reports', icon: BarChart3 },
    { id: 'qrstudio', label: 'QR & Barcode', icon: QrCode },
    { id: 'users', label: 'Users & Staff', icon: UserCog },
    { id: 'sync', label: 'Cloud Sync', icon: Database },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="no-print bg-charcoal-900 border-b border-charcoal-800 sticky top-0 z-40 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        
        {/* Zone 1: Brand Wordmark (Gold Luxury SAPPY Logo) */}
        <button
          onClick={() => onTabChange('dashboard')}
          className="flex items-center gap-2 text-left cursor-pointer group shrink-0 active:scale-95 transition-transform"
          aria-label="SAPPY Dashboard"
        >
          <SappyLogo variant="wordmark" size="md" showSubtitle={true} />
        </button>

        {/* Zone 2: Icon Navigation Bar (Labels hidden by default, revealed on hover) */}
        <nav className="hidden md:flex items-center gap-1.5 p-1 bg-charcoal-950/80 rounded-2xl border border-charcoal-800/80 shadow-inner">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <div key={item.id} className="relative group">
                <button
                  onClick={() => onTabChange(item.id)}
                  aria-label={item.label}
                  className={`w-10 h-10 rounded-xl transition-all duration-150 cursor-pointer flex items-center justify-center ${
                    isActive
                      ? 'bg-forest-700 text-white shadow-md shadow-forest-950/60 border border-forest-500/80'
                      : 'text-charcoal-400 hover:text-white hover:bg-charcoal-800/80 border border-transparent hover:border-charcoal-700'
                  }`}
                >
                  <Icon
                    className={`w-4.5 h-4.5 transition-transform duration-150 group-hover:scale-110 ${
                      isActive ? 'text-white' : 'text-charcoal-300 group-hover:text-forest-400'
                    }`}
                  />
                </button>

                {/* Floating Tooltip Pill (Revealed on Hover) */}
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 translate-y-1 transition-all duration-150 z-50 flex flex-col items-center">
                  <div className="w-2 h-2 bg-charcoal-950 border-t border-l border-charcoal-700 rotate-45 -mb-1" />
                  <span className="px-2.5 py-1 bg-charcoal-950 text-white border border-charcoal-700 rounded-lg text-xs font-semibold whitespace-nowrap shadow-2xl tracking-wide">
                    {item.label}
                  </span>
                </div>
              </div>
            );
          })}
        </nav>

        {/* Zone 3: User Profile, Sync Status & Primary Action */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          
          {/* Live Cross-Device Cloud Sync Indicator */}
          <div className="hidden sm:block">
            <PulseSyncIndicator
              status={syncStatus}
              isSyncing={isSyncing}
              onClick={onOpenCloudSync || onManualSync}
            />
          </div>

          {/* Quick Register Cart Button */}
          <button
            onClick={() => onTabChange('register')}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-forest-700 text-white hover:bg-forest-600 transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95 border border-forest-500/80 shadow-md shadow-forest-950/40"
            aria-label="Open POS Register"
          >
            <ShoppingCart className="w-4 h-4 text-forest-200" />
            <span className="hidden sm:inline text-xs font-bold">POS</span>
            {cartItemCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-4.5 px-1 bg-forest-400 text-charcoal-950 text-[10px] font-mono font-black rounded-full">
                {cartItemCount}
              </span>
            )}
          </button>

          {/* User Auth Profile Badge / Sign Out */}
          {currentUser ? (
            <div className="flex items-center gap-1.5 bg-charcoal-950 p-1 pl-2 rounded-xl border border-charcoal-800">
              <button
                type="button"
                onClick={() => onTabChange('users')}
                className="flex items-center gap-1.5 text-left cursor-pointer group hover:opacity-90"
                title={`Signed in as ${currentUser.fullName} (${currentUser.role}). Click to manage staff accounts.`}
              >
                <div className="w-6 h-6 rounded-lg bg-forest-800 text-forest-200 flex items-center justify-center font-bold text-[11px] font-mono border border-forest-600/50 group-hover:border-forest-400">
                  {currentUser.fullName.charAt(0).toUpperCase()}
                </div>

                <div className="hidden lg:block text-left pr-1.5">
                  <p className="text-[11px] font-bold text-white leading-tight truncate max-w-[110px] group-hover:text-forest-300">
                    {currentUser.fullName}
                  </p>
                  <p className="text-[9px] font-mono text-forest-400 uppercase leading-none">
                    {currentUser.role}
                  </p>
                </div>
              </button>

              <button
                onClick={onSignOut}
                className="p-1.5 text-charcoal-400 hover:text-rose-400 hover:bg-charcoal-800 rounded-lg transition-colors cursor-pointer"
                title={`Signed in as ${currentUser.fullName} (${currentUser.role}). Click to switch user or sign out.`}
                aria-label="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-3 py-2 rounded-xl bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-200 hover:text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 border border-charcoal-700 active:scale-95"
            >
              <LogIn className="w-3.5 h-3.5 text-forest-400" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar (Icons with Hover/Tap Tooltips) */}
      <div className="md:hidden flex items-center justify-around px-2 py-1.5 bg-charcoal-950 border-t border-charcoal-800 overflow-x-auto no-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <div key={item.id} className="relative group">
              <button
                onClick={() => onTabChange(item.id)}
                aria-label={item.label}
                className={`w-9 h-9 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                  isActive
                    ? 'bg-forest-700 text-white shadow-xs border border-forest-500'
                    : 'text-charcoal-400 hover:text-white hover:bg-charcoal-800'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>

              {/* Mobile Tooltip */}
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-150 z-50 flex flex-col items-center">
                <span className="px-2 py-0.5 bg-charcoal-950 text-white border border-charcoal-700 rounded text-[10px] font-semibold whitespace-nowrap shadow-xl">
                  {item.label}
                </span>
                <div className="w-1.5 h-1.5 bg-charcoal-950 border-b border-r border-charcoal-700 rotate-45 -mt-1" />
              </div>
            </div>
          );
        })}
      </div>
    </header>
  );
};

