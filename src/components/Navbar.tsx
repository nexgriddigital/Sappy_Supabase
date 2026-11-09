import React, { useState } from 'react';
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
  Search,
  Command,
  Monitor,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
  Smartphone,
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
  onOpenCommandPalette?: () => void;
  onOpenCustomerDisplay?: () => void;
  isSoundMuted?: boolean;
  onToggleSound?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
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
  onOpenCommandPalette,
  onOpenCustomerDisplay,
  isSoundMuted = false,
  onToggleSound,
  isFullscreen = false,
  onToggleFullscreen,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  // Mobile Bottom Bar Primary Tabs
  const mobilePrimaryTabs: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'register', label: 'Register', icon: Store },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventory', icon: Boxes },
    { id: 'sales', label: 'Sales', icon: FileText },
  ];

  const handleSelectTab = (tab: TabType) => {
    onTabChange(tab);
    setIsMobileMenuOpen(false);
  };

  const isSecondaryTabActive = !['register', 'dashboard', 'inventory', 'sales'].includes(activeTab);

  return (
    <>
      <header className="no-print bg-charcoal-900 border-b border-charcoal-800 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-15 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Zone 1: Brand Wordmark (Gold Luxury SAPPY Logo) */}
          <button
            onClick={() => handleSelectTab('dashboard')}
            className="flex items-center gap-2 text-left cursor-pointer group shrink-0 active:scale-95 transition-transform"
            aria-label="SAPPY Dashboard"
          >
            <SappyLogo variant="wordmark" size="md" showSubtitle={true} />
          </button>

          {/* Zone 2: Desktop Icon Navigation Bar (Labels revealed on hover) */}
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

          {/* Zone 3: Quick Utilities, Cart, Sync Status & User Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            
            {/* Global Omni-Search Command Palette Trigger */}
            {onOpenCommandPalette && (
              <button
                type="button"
                onClick={onOpenCommandPalette}
                className="hidden sm:flex p-2 sm:px-2.5 sm:py-2 rounded-xl bg-charcoal-950 hover:bg-charcoal-800 text-charcoal-400 hover:text-white border border-charcoal-800 transition-colors cursor-pointer items-center gap-1.5 text-xs"
                title="Global Search & Quick Actions (Ctrl+K or /)"
                aria-label="Open command palette"
              >
                <Search className="w-3.5 h-3.5 text-forest-400" />
                <span className="hidden xl:inline text-[11px] font-mono text-charcoal-400">Search</span>
                <kbd className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-charcoal-900 text-[10px] font-mono text-charcoal-400 border border-charcoal-800">
                  ⌘K
                </kbd>
              </button>
            )}

            {/* Customer Facing Screen Trigger (Desktop) */}
            {onOpenCustomerDisplay && (
              <button
                type="button"
                onClick={onOpenCustomerDisplay}
                className="hidden md:flex p-2 rounded-xl bg-charcoal-950 hover:bg-charcoal-800 text-charcoal-400 hover:text-forest-300 border border-charcoal-800 transition-colors cursor-pointer"
                title="Open Customer Counter Display & Thermal Slip"
                aria-label="Customer Counter Display"
              >
                <Monitor className="w-4 h-4" />
              </button>
            )}

            {/* POS Audio Sound Toggle (Desktop) */}
            {onToggleSound && (
              <button
                type="button"
                onClick={onToggleSound}
                className={`hidden md:flex p-2 rounded-xl border transition-colors cursor-pointer ${
                  isSoundMuted
                    ? 'bg-charcoal-950 text-charcoal-500 border-charcoal-800 hover:text-charcoal-300'
                    : 'bg-charcoal-950 text-forest-400 border-charcoal-800 hover:bg-charcoal-800'
                }`}
                title={isSoundMuted ? 'Sound Muted. Click to enable POS audio feedback' : 'Sound Enabled. Click to mute audio feedback'}
                aria-label="Toggle POS Sound"
              >
                {isSoundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            )}

            {/* Fullscreen Mode Toggle (Desktop) */}
            {onToggleFullscreen && (
              <button
                type="button"
                onClick={onToggleFullscreen}
                className="hidden lg:flex p-2 rounded-xl bg-charcoal-950 hover:bg-charcoal-800 text-charcoal-400 hover:text-white border border-charcoal-800 transition-colors cursor-pointer"
                title={isFullscreen ? 'Exit Fullscreen POS' : 'Enter Fullscreen Touch POS'}
                aria-label="Toggle Fullscreen"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            )}

            {/* Quick Mobile / Second Device Pairing Trigger */}
            {onOpenCloudSync && (
              <button
                type="button"
                onClick={onOpenCloudSync}
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-charcoal-950 hover:bg-charcoal-800 text-charcoal-300 hover:text-white border border-charcoal-800 text-xs font-semibold cursor-pointer transition-colors"
                title="Connect Phone or Another Terminal"
              >
                <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-mono">Pair Phone</span>
              </button>
            )}

            {/* Live Cross-Device Cloud Sync Indicator (Visible everywhere) */}
            <div className="shrink-0">
              <PulseSyncIndicator
                status={syncStatus}
                isSyncing={isSyncing}
                onClick={onOpenCloudSync || onManualSync}
              />
            </div>

            {/* Quick Register Cart Button */}
            <button
              onClick={() => onTabChange('register')}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-forest-700 text-white hover:bg-forest-600 transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95 border border-forest-500/80 shadow-md shadow-forest-950/40 shrink-0"
              aria-label="Open POS Register"
            >
              <ShoppingCart className="w-4 h-4 text-forest-200" />
              <span className="hidden sm:inline text-xs font-bold">POS</span>
              {cartItemCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-4.5 px-1 bg-amber-400 text-charcoal-950 text-[10px] font-mono font-black rounded-full shadow-xs">
                  {cartItemCount}
                </span>
              )}
            </button>

            {/* User Auth Profile Badge / Sign Out (Desktop) */}
            {currentUser ? (
              <div className="hidden sm:flex items-center gap-1.5 bg-charcoal-950 p-1 pl-2 rounded-xl border border-charcoal-800 shrink-0">
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
                className="hidden sm:flex px-3 py-2 rounded-xl bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-200 hover:text-white text-xs font-bold transition-colors cursor-pointer items-center gap-1.5 border border-charcoal-700 active:scale-95"
              >
                <LogIn className="w-3.5 h-3.5 text-forest-400" />
                <span>Sign In</span>
              </button>
            )}

            {/* Mobile Hamburger Drawer Trigger */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl bg-charcoal-950 hover:bg-charcoal-800 text-charcoal-200 hover:text-white border border-charcoal-800 transition-colors cursor-pointer active:scale-95"
              aria-label="Open mobile menu"
            >
              <Menu className="w-5 h-5 text-forest-400" />
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MOBILE BOTTOM NAVIGATION BAR (Fixed at bottom for easy thumb access) */}
      {/* ========================================================================= */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-charcoal-950/95 backdrop-blur-md border-t border-charcoal-800/90 px-2 py-1.5 flex items-center justify-around shadow-2xl safe-area-bottom">
        {mobilePrimaryTabs.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isRegister = item.id === 'register';

          return (
            <button
              key={item.id}
              onClick={() => handleSelectTab(item.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer relative min-h-[46px] ${
                isActive
                  ? 'text-forest-400 font-bold bg-charcoal-900/80 shadow-xs'
                  : 'text-charcoal-400 hover:text-charcoal-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'text-forest-400' : 'text-charcoal-400'}`} />
                {isRegister && cartItemCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-amber-400 text-charcoal-950 font-mono text-[9px] font-black flex items-center justify-center shadow-xs">
                    {cartItemCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
            </button>
          );
        })}

        {/* 5th Button: More (Opens the Drawer) */}
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer relative min-h-[46px] ${
            isSecondaryTabActive || isMobileMenuOpen
              ? 'text-amber-400 font-bold bg-charcoal-900/80 shadow-xs'
              : 'text-charcoal-400 hover:text-charcoal-200'
          }`}
        >
          <div className="relative">
            <Menu className={`w-5 h-5 ${isSecondaryTabActive || isMobileMenuOpen ? 'text-amber-400' : 'text-charcoal-400'}`} />
            {isSecondaryTabActive && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-charcoal-950" />
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">More</span>
        </button>
      </nav>

      {/* ========================================================================= */}
      {/* MOBILE SLIDE-OVER NAVIGATION DRAWER */}
      {/* ========================================================================= */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer Sheet */}
          <div className="relative ml-auto w-full max-w-xs bg-charcoal-900 border-l border-charcoal-800 shadow-2xl flex flex-col h-full z-10 overflow-y-auto">
            
            {/* Drawer Top Header */}
            <div className="p-4 border-b border-charcoal-800 flex items-center justify-between bg-charcoal-950">
              <SappyLogo variant="wordmark" size="sm" showSubtitle={true} />
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-8 h-8 rounded-lg bg-charcoal-900 hover:bg-charcoal-800 text-charcoal-400 hover:text-white flex items-center justify-center border border-charcoal-700 cursor-pointer"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Staff User Card in Drawer */}
            <div className="p-4 bg-charcoal-950/60 border-b border-charcoal-800">
              {currentUser ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-forest-800 border border-forest-600/60 flex items-center justify-center font-bold text-sm text-forest-200">
                      {currentUser.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white truncate max-w-[140px]">
                        {currentUser.fullName}
                      </p>
                      <p className="text-[10px] font-mono text-forest-400 uppercase">
                        {currentUser.role}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onSignOut();
                    }}
                    className="p-1.5 text-charcoal-400 hover:text-rose-400 bg-charcoal-900 rounded-lg border border-charcoal-700 cursor-pointer"
                    title="Sign out / Switch Staff"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenAuth();
                  }}
                  className="w-full py-2 px-3 bg-forest-700 hover:bg-forest-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In to Sappy POS</span>
                </button>
              )}
            </div>

            {/* Drawer Navigation List */}
            <div className="flex-1 p-3 space-y-1 overflow-y-auto">
              <p className="px-3 pt-2 pb-1 text-[10px] font-mono font-bold uppercase text-charcoal-500 tracking-wider">
                Store Management
              </p>

              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-forest-700 text-white shadow-xs border border-forest-600'
                        : 'text-charcoal-300 hover:text-white hover:bg-charcoal-800/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-forest-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.id === 'register' && cartItemCount > 0 ? (
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-charcoal-950 font-mono text-[10px] font-black">
                        {cartItemCount}
                      </span>
                    ) : (
                      <ChevronRight className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-charcoal-600'}`} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick Mobile Utilities Footer */}
            <div className="p-4 border-t border-charcoal-800 bg-charcoal-950 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {onToggleSound && (
                  <button
                    type="button"
                    onClick={onToggleSound}
                    className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      isSoundMuted
                        ? 'bg-charcoal-900 text-charcoal-400 border-charcoal-700'
                        : 'bg-charcoal-900 text-forest-300 border-forest-600/60'
                    }`}
                  >
                    {isSoundMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    <span>{isSoundMuted ? 'Muted' : 'Audio On'}</span>
                  </button>
                )}

                {onOpenCustomerDisplay && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onOpenCustomerDisplay();
                    }}
                    className="p-2 rounded-xl bg-charcoal-900 hover:bg-charcoal-800 border border-charcoal-700 text-xs font-semibold text-charcoal-200 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Monitor className="w-3.5 h-3.5 text-forest-400" />
                    <span>Customer View</span>
                  </button>
                )}
              </div>

              {onOpenCommandPalette && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenCommandPalette();
                  }}
                  className="w-full p-2 bg-charcoal-900 hover:bg-charcoal-800 border border-charcoal-700 rounded-xl text-xs font-semibold text-charcoal-300 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5 text-forest-400" />
                  <span>Search Catalog & Actions</span>
                </button>
              )}

              <div className="pt-2 text-center text-[10px] text-charcoal-500 font-mono">
                Sappy Commercial POS • Mobile Ready
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
