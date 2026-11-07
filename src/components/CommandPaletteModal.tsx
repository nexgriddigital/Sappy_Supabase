import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Store,
  FileText,
  Users,
  Boxes,
  Wallet,
  BarChart3,
  QrCode,
  Settings,
  Database,
  UserCog,
  LayoutDashboard,
  Plus,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Sparkles,
  ArrowRight,
  X,
  Command,
  CornerDownLeft,
} from 'lucide-react';
import { Product, Customer, StoreConfig, AppUser } from '../types/pos.ts';
import { TabType } from './Navbar.tsx';
import { soundEffects } from '../utils/soundEffects.ts';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  customers: Customer[];
  config: StoreConfig;
  onNavigate: (tab: TabType) => void;
  onAddToCart?: (product: Product) => void;
  onOpenSwitchUser?: () => void;
  onLoadStarterPack?: () => void;
  currentUser: AppUser | null;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  products,
  customers,
  config,
  onNavigate,
  onAddToCart,
  onOpenSwitchUser,
  onLoadStarterPack,
  currentUser,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Command items
  const navigationItems = [
    { id: 'dashboard' as TabType, title: 'Go to Dashboard', category: 'Navigation', icon: LayoutDashboard },
    { id: 'register' as TabType, title: 'Open POS Cash Register', category: 'Navigation', icon: Store },
    { id: 'sales' as TabType, title: 'View Sales Ledger & Invoices', category: 'Navigation', icon: FileText },
    { id: 'credit' as TabType, title: 'Customer Credit & Debt Ledger', category: 'Navigation', icon: Users },
    { id: 'inventory' as TabType, title: 'Product Inventory & Stock', category: 'Navigation', icon: Boxes },
    { id: 'expenses' as TabType, title: 'Store Expenses & Log', category: 'Navigation', icon: Wallet },
    { id: 'reports' as TabType, title: 'Financial Reports & P&L', category: 'Navigation', icon: BarChart3 },
    { id: 'qrstudio' as TabType, title: 'QR & Barcode Label Studio', category: 'Navigation', icon: QrCode },
    { id: 'users' as TabType, title: 'Users & Staff Directory', category: 'Navigation', icon: UserCog },
    { id: 'sync' as TabType, title: 'Cloud & Database Sync', category: 'Navigation', icon: Database },
    { id: 'settings' as TabType, title: 'Settings & Reset Options', category: 'Navigation', icon: Settings },
  ];

  // Search Results
  const filteredResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    const results: Array<{
      type: 'nav' | 'product' | 'customer' | 'action';
      title: string;
      subtitle?: string;
      badge?: string;
      icon: any;
      action: () => void;
    }> = [];

    // Quick Actions
    if (!q || 'switch shift cashier user'.includes(q)) {
      if (onOpenSwitchUser) {
        results.push({
          type: 'action',
          title: 'Switch Terminal Shift / Cashier',
          subtitle: `Currently signed in as ${currentUser?.fullName || 'Staff'}`,
          badge: 'Shift',
          icon: UserCog,
          action: () => {
            onClose();
            onOpenSwitchUser();
          },
        });
      }
    }

    if (!q || 'sound volume mute audio beep'.includes(q)) {
      results.push({
        type: 'action',
        title: soundEffects.getIsMuted() ? 'Unmute POS Sound Effects' : 'Mute POS Sound Effects',
        subtitle: 'Cash register chimes, barcode scanner beeps, and tactile audio feedback',
        badge: 'Audio',
        icon: soundEffects.getIsMuted() ? VolumeX : Volume2,
        action: () => {
          soundEffects.toggleMute();
          onClose();
        },
      });
    }

    if (products.length === 0 && onLoadStarterPack && (!q || 'starter demo pack stationery sample'.includes(q))) {
      results.push({
        type: 'action',
        title: 'Load Stationery Starter Essentials (16 Products)',
        subtitle: 'Parker pens, Oxford notebooks, Double A paper, staplers, Casio calculators',
        badge: 'Catalog',
        icon: Sparkles,
        action: () => {
          onClose();
          onLoadStarterPack();
        },
      });
    }

    // Matching Navigation
    navigationItems.forEach((nav) => {
      if (!q || nav.title.toLowerCase().includes(q) || nav.id.toLowerCase().includes(q)) {
        results.push({
          type: 'nav',
          title: nav.title,
          subtitle: `Jump to ${nav.id.toUpperCase()} tab`,
          badge: 'Tab',
          icon: nav.icon,
          action: () => {
            onClose();
            onNavigate(nav.id);
          },
        });
      }
    });

    // Matching Products (up to 8)
    if (q) {
      const matchedProducts = products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            p.barcode.includes(q) ||
            p.category.toLowerCase().includes(q)
        )
        .slice(0, 8);

      matchedProducts.forEach((p) => {
        results.push({
          type: 'product',
          title: p.name,
          subtitle: `SKU: ${p.sku} · Stock: ${p.stockLevel} ${p.unit} · Price: ${config.currencySymbol}${p.sellingPrice.toFixed(2)}`,
          badge: onAddToCart ? 'Add to Cart' : 'Inventory',
          icon: Boxes,
          action: () => {
            onClose();
            if (onAddToCart) {
              soundEffects.playBeep();
              onAddToCart(p);
              onNavigate('register');
            } else {
              onNavigate('inventory');
            }
          },
        });
      });

      // Matching Customers (up to 5)
      const matchedCustomers = customers
        .filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.phone.toLowerCase().includes(q) ||
            (c.companyName && c.companyName.toLowerCase().includes(q))
        )
        .slice(0, 5);

      matchedCustomers.forEach((c) => {
        results.push({
          type: 'customer',
          title: c.name,
          subtitle: `Phone: ${c.phone} · Debt Balance: ${config.currencySymbol}${c.creditBalance.toFixed(2)}`,
          badge: 'Customer',
          icon: Users,
          action: () => {
            onClose();
            onNavigate('credit');
          },
        });
      });
    }

    return results;
  }, [query, products, customers, config, onNavigate, onAddToCart, onOpenSwitchUser, onLoadStarterPack, currentUser]);

  // Handle Keyboard Navigation (ArrowUp, ArrowDown, Enter)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredResults.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredResults.length) % (filteredResults.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredResults[selectedIndex]) {
        filteredResults[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-charcoal-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-charcoal-900 border border-charcoal-700 rounded-2xl max-w-2xl w-full shadow-2xl text-white overflow-hidden flex flex-col max-h-[75vh]">
        
        {/* Search Bar Input */}
        <div className="p-4 border-b border-charcoal-800 flex items-center gap-3 bg-charcoal-950/90">
          <Search className="w-5 h-5 text-forest-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command, search products, barcodes, customers, or tabs..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent text-sm sm:text-base text-white placeholder-charcoal-500 focus:outline-hidden font-medium"
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <kbd className="px-2 py-0.5 rounded bg-charcoal-800 text-[10px] font-mono text-charcoal-400 border border-charcoal-700">
              ESC
            </kbd>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-charcoal-400 hover:text-white rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto flex-1 p-2 space-y-1">
          {filteredResults.length === 0 ? (
            <div className="py-12 text-center text-charcoal-500 space-y-1">
              <p className="text-sm font-semibold">No matching commands or catalog items</p>
              <p className="text-xs text-charcoal-600">Try searching for pen, notebook, paper, register, cashier, or settings.</p>
            </div>
          ) : (
            filteredResults.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = selectedIndex === idx;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full p-3 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-forest-900/80 border border-forest-500/80 text-white shadow-xs'
                      : 'hover:bg-charcoal-800/60 border border-transparent text-charcoal-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                        isSelected
                          ? 'bg-forest-800 text-forest-200 border-forest-400'
                          : 'bg-charcoal-950 text-charcoal-400 border-charcoal-800'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs sm:text-sm truncate">{item.title}</p>
                      {item.subtitle && (
                        <p className="text-[11px] text-charcoal-400 truncate mt-0.5 font-mono">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {item.badge && (
                      <span className="px-2 py-0.5 rounded bg-charcoal-950 border border-charcoal-700 text-[10px] font-mono text-charcoal-300">
                        {item.badge}
                      </span>
                    )}
                    {isSelected && <CornerDownLeft className="w-3.5 h-3.5 text-forest-400" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Bar */}
        <div className="bg-charcoal-950 px-4 py-2.5 border-t border-charcoal-800 flex items-center justify-between text-[11px] text-charcoal-500 font-mono">
          <div className="flex items-center gap-3">
            <span><strong className="text-charcoal-300">↑↓</strong> Navigate</span>
            <span>·</span>
            <span><strong className="text-charcoal-300">↵</strong> Select</span>
            <span>·</span>
            <span><strong className="text-charcoal-300">Esc</strong> Dismiss</span>
          </div>
          <span>SAPPY POS Omni-Search</span>
        </div>

      </div>
    </div>
  );
};
