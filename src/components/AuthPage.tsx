import React, { useState } from 'react';
import {
  Store,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  LogIn,
  UserPlus,
  Building2,
  Phone,
  Sparkles,
  KeyRound,
  X,
  BadgeCheck,
  DollarSign,
  Percent,
} from 'lucide-react';
import { AppUser, UserRole } from '../types/pos.ts';
import { storageService } from '../services/storageService.ts';
import { getSupabase } from '../lib/supabase.ts';
import sappySquareIcon from '../assets/images/sappy_icon_square_1793958931489.jpg';

interface AuthPageProps {
  onAuthSuccess: (user: AppUser) => void;
  onClose?: () => void; // Optional if shown as modal
  initialMode?: 'login' | 'signup' | 'setup';
  isModal?: boolean;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  onAuthSuccess,
  onClose,
  initialMode,
  isModal = false,
}) => {
  const hasExistingUsers = storageService.hasUsers();
  const defaultMode = initialMode || (hasExistingUsers ? 'login' : 'setup');

  const [mode, setMode] = useState<'login' | 'signup' | 'setup'>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [storeName, setStoreName] = useState('Sappy Stationary');
  const [phone, setPhone] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('Br ');
  const [currencyCode, setCurrencyCode] = useState('ETB');
  const [taxRate, setTaxRate] = useState('15');
  const [role, setRole] = useState<UserRole>('owner');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Handle First-Time Store Owner Setup
  const handleFirstTimeSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();

    if (!cleanName || !cleanEmail || !password) {
      setError('Please provide your full name, email address, and master password.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Master password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify your password entry.');
      setLoading(false);
      return;
    }

    try {
      // 1. Save configured store settings
      const currentConfig = storageService.getStoreConfig();
      storageService.saveStoreConfig({
        ...currentConfig,
        storeName: storeName.trim() || 'Sappy Stationary',
        phone: phone.trim() || currentConfig.phone,
        email: cleanEmail,
        currencySymbol: currencySymbol,
        currencyCode: currencyCode,
        defaultTaxRate: parseFloat(taxRate) || 15,
      });

      // 2. Register master Store Owner user
      const ownerUser = storageService.registerUser({
        email: cleanEmail,
        fullName: cleanName,
        role: 'owner',
        storeName: storeName.trim() || 'Sappy Stationary',
        phone: phone.trim() || undefined,
      });

      // 3. Set active session
      storageService.setCurrentUser(ownerUser);
      setSuccessMsg(`Welcome, ${ownerUser.fullName}! Sappy POS is configured and ready.`);

      setTimeout(() => {
        onAuthSuccess(ownerUser);
      }, 500);
    } catch (err: any) {
      setError(err?.message || 'Failed to complete setup. Please check your entries.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Please provide both email address and password.');
      setLoading(false);
      return;
    }

    try {
      // 1. Check Supabase Auth if configured
      const supabase = getSupabase();
      let cloudAuthUser: AppUser | null = null;

      if (supabase) {
        try {
          const { data, error: supaErr } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: password,
          });

          if (!supaErr && data.user) {
            const metadata = data.user.user_metadata || {};
            cloudAuthUser = {
              id: data.user.id,
              email: data.user.email || cleanEmail,
              fullName: metadata.full_name || cleanEmail.split('@')[0],
              role: (metadata.role as UserRole) || 'cashier',
              storeName: metadata.store_name || storeName,
              createdAt: data.user.created_at,
              lastLoginAt: new Date().toISOString(),
            };
          }
        } catch {
          // Cloud auth skipped in local mode
        }
      }

      // 2. Check local user database or cloud result
      let user = cloudAuthUser || storageService.findUserByEmail(cleanEmail);

      if (!user) {
        // If system has no registered users, redirect to setup
        if (!storageService.hasUsers()) {
          setMode('setup');
          setError('No user accounts exist yet. Please complete the initial store owner setup.');
          setLoading(false);
          return;
        }

        setError('Invalid staff credentials. Please check your email or contact your Store Owner.');
        setLoading(false);
        return;
      }

      // Set active session
      storageService.setCurrentUser(user);
      setSuccessMsg(`Welcome back, ${user.fullName}!`);
      setTimeout(() => {
        onAuthSuccess(user!);
      }, 400);
    } catch (err: any) {
      setError(err?.message || 'Failed to authenticate. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Signup (Staff Member Registration)
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !fullName.trim()) {
      setError('Please fill in your full name and email address.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      setLoading(false);
      return;
    }

    try {
      // Register user locally in storageService
      const newUser = storageService.registerUser({
        email: cleanEmail,
        fullName: fullName.trim(),
        role: role,
        storeName: storeName.trim() || 'Sappy Stationary',
        phone: phone.trim() || undefined,
      });

      storageService.setCurrentUser(newUser);
      setSuccessMsg(`Account created successfully! Welcome, ${newUser.fullName}.`);
      setTimeout(() => {
        onAuthSuccess(newUser);
      }, 500);
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const containerClasses = isModal
    ? 'fixed inset-0 z-50 bg-charcoal-950/80 backdrop-blur-sm flex items-center justify-center p-4'
    : 'min-h-[85vh] flex items-center justify-center p-4 sm:p-6';

  return (
    <div className={containerClasses}>
      <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden text-charcoal-100 relative">
        
        {/* Close Button if Modal */}
        {isModal && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 text-charcoal-400 hover:text-white p-1 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Top Header Card */}
        <div className="bg-charcoal-950 p-6 border-b border-charcoal-800 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-forest-600/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex flex-col items-center justify-center mb-2">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-amber-500/40 shadow-xl shadow-amber-950/60 p-0.5 bg-gradient-to-b from-amber-500/20 to-transparent">
              <img src={sappySquareIcon} alt="Sappy" className="w-full h-full object-cover rounded-xl" />
            </div>
            <h2 className="font-serif tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 font-extrabold text-2xl mt-1.5 drop-shadow-sm">
              SAPPY
            </h2>
          </div>

          {mode === 'setup' ? (
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold font-mono px-3 py-1 rounded-full bg-forest-950 text-forest-300 border border-forest-700/60 shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-forest-400" />
                <span>First-Time Store Owner Setup</span>
              </span>
              <p className="text-xs text-charcoal-400 mt-2">
                Register the master store owner administrator account and set your store preferences.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-charcoal-400 mt-1">
                Commercial Point of Sale & Retail Management Hub
              </p>

              {/* Mode Switch Tabs */}
              <div className="grid grid-cols-2 gap-1 bg-charcoal-900 p-1 rounded-xl border border-charcoal-800 mt-5">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className={`py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    mode === 'login'
                      ? 'bg-forest-700 text-white shadow-xs border border-forest-600/60'
                      : 'text-charcoal-400 hover:text-white'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className={`py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    mode === 'signup'
                      ? 'bg-forest-700 text-white shadow-xs border border-forest-600/60'
                      : 'text-charcoal-400 hover:text-white'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register Staff</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Error / Success Feedback */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-forest-950/80 border border-forest-700 rounded-xl text-forest-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-forest-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6">
          {mode === 'setup' ? (
            /* ======================================================== */
            /* 1. FIRST-TIME STORE OWNER SETUP FORM */
            /* ======================================================== */
            <form onSubmit={handleFirstTimeSetup} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                  Store Owner Full Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-charcoal-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Store Owner Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white placeholder-charcoal-500 focus:border-forest-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                    Store / Stationery Name *
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-charcoal-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sappy Stationary"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white placeholder-charcoal-500 focus:border-forest-500 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                    Store Contact Phone
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-charcoal-500 absolute left-3.5 top-3" />
                    <input
                      type="tel"
                      placeholder="+251 91 123 4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white placeholder-charcoal-500 font-mono focus:border-forest-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                  Master Owner Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-charcoal-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="owner@sappystationery.et"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white placeholder-charcoal-500 focus:border-forest-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                    Master Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Min 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-3 pr-8 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white font-mono focus:border-forest-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-charcoal-400 hover:text-white cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white font-mono focus:border-forest-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                    Currency Symbol
                  </label>
                  <input
                    type="text"
                    value={currencySymbol}
                    onChange={(e) => setCurrencySymbol(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white font-mono focus:border-forest-500"
                    placeholder="Br "
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                    Standard Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white font-mono focus:border-forest-500"
                    placeholder="15"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 bg-forest-700 hover:bg-forest-600 text-white font-bold text-sm rounded-xl cursor-pointer shadow-lg active:scale-[0.99] transition-all flex items-center justify-center gap-2 border border-forest-600/50 shadow-forest-950/60"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <BadgeCheck className="w-4 h-4 text-forest-200" />
                    <span>Complete Setup & Enter POS</span>
                  </>
                )}
              </button>
            </form>
          ) : mode === 'login' ? (
            /* ======================================================== */
            /* 2. REGULAR LOGIN FORM */
            /* ======================================================== */
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1.5">
                  Staff Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-charcoal-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. owner@sappystationery.et"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-charcoal-950 border border-charcoal-700 rounded-xl text-sm text-white placeholder-charcoal-500 focus:outline-hidden focus:ring-2 focus:ring-forest-500/30 focus:border-forest-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-charcoal-500 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter password..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-charcoal-950 border border-charcoal-700 rounded-xl text-sm text-white placeholder-charcoal-500 focus:outline-hidden focus:ring-2 focus:ring-forest-500/30 focus:border-forest-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-charcoal-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-charcoal-400">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-charcoal-700 bg-charcoal-950 text-forest-600 focus:ring-forest-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Keep me signed in</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-forest-700 hover:bg-forest-600 text-white font-bold text-sm rounded-xl cursor-pointer shadow-lg active:scale-[0.99] transition-all flex items-center justify-center gap-2 border border-forest-600/50 shadow-forest-950/60"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-4 h-4 text-forest-200" />
                    <span>Sign In to Terminal</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* ======================================================== */
            /* 3. STAFF REGISTRATION FORM */
            /* ======================================================== */
            <form onSubmit={handleSignup} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-charcoal-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="Staff Member Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white placeholder-charcoal-500 focus:border-forest-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-charcoal-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="staff@sappystationery.et"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white placeholder-charcoal-500 focus:border-forest-500"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                  Staff Role *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'owner' as UserRole, label: 'Owner', desc: 'Full control' },
                    { id: 'manager' as UserRole, label: 'Manager', desc: 'Inventory & P&L' },
                    { id: 'cashier' as UserRole, label: 'Cashier', desc: 'POS checkout' },
                  ].map((r) => {
                    const isSelected = role === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRole(r.id)}
                        className={`p-2 rounded-xl text-left border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-forest-900/80 border-forest-500 text-white'
                            : 'bg-charcoal-950 border-charcoal-800 text-charcoal-400 hover:text-white'
                        }`}
                      >
                        <p className="text-xs font-bold">{r.label}</p>
                        <p className="text-[10px] text-charcoal-400">{r.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white font-mono focus:border-forest-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white font-mono focus:border-forest-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 bg-forest-700 hover:bg-forest-600 text-white font-bold text-sm rounded-xl cursor-pointer shadow-lg active:scale-[0.99] transition-all flex items-center justify-center gap-2 border border-forest-600/50 shadow-forest-950/60"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 text-forest-200" />
                    <span>Register Staff Account</span>
                  </>
                )}
              </button>
            </form>
          )}

        </div>

        {/* Security Footer */}
        <div className="px-6 py-3 bg-charcoal-950 border-t border-charcoal-800 flex items-center justify-between text-[11px] text-charcoal-500 font-mono">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-forest-400" />
            <span>256-bit Encrypted POS</span>
          </span>
          <span>Role-Based Access</span>
        </div>

      </div>
    </div>
  );
};
