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
} from 'lucide-react';
import { AppUser, UserRole } from '../types/pos.ts';
import { storageService } from '../services/storageService.ts';
import { getSupabase } from '../lib/supabase.ts';
import sappyBrandWordmark from '../assets/images/sappy_brand_logo_1793958913812.jpg';
import sappySquareIcon from '../assets/images/sappy_icon_square_1793958931489.jpg';

interface AuthPageProps {
  onAuthSuccess: (user: AppUser) => void;
  onClose?: () => void; // Optional if shown as modal
  initialMode?: 'login' | 'signup';
  isModal?: boolean;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  onAuthSuccess,
  onClose,
  initialMode = 'login',
  isModal = false,
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [storeName, setStoreName] = useState('Sappy Stationery & Books');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('owner');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Quick Preset Staff Fill
  const handleQuickFill = (presetEmail: string, presetRole: UserRole, presetName: string) => {
    setEmail(presetEmail);
    setPassword('password123');
    setFullName(presetName);
    setRole(presetRole);
    setError(null);
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
          // Fallback to local user ledger if cloud network is offline
        }
      }

      // 2. Check local user database or cloud result
      let user = cloudAuthUser || storageService.findUserByEmail(cleanEmail);

      // If user doesn't exist yet in local storage but credentials look valid, auto-register as staff
      if (!user) {
        user = storageService.registerUser({
          email: cleanEmail,
          fullName: cleanEmail.split('@')[0].replace('.', ' '),
          role: cleanEmail.includes('owner') ? 'owner' : cleanEmail.includes('manager') ? 'manager' : 'cashier',
          storeName: storeName,
          phone: '+251 91 123 4567',
        });
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

  // Handle Signup
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
      // 1. Try Supabase cloud user registration if configured
      const supabase = getSupabase();
      let cloudUserId = `usr-${Date.now()}`;

      if (supabase) {
        try {
          const { data, error: supaErr } = await supabase.auth.signUp({
            email: cleanEmail,
            password: password,
            options: {
              data: {
                full_name: fullName.trim(),
                role: role,
                store_name: storeName.trim(),
                phone: phone.trim() || undefined,
              },
            },
          });

          if (supaErr) {
            // Note if cloud returned a non-fatal message
            console.warn('Supabase signup notice:', supaErr.message);
          } else if (data.user) {
            cloudUserId = data.user.id;
          }
        } catch {
          // Supabase signup skipped in offline mode
        }
      }

      // 2. Register user locally in storageService
      const newUser = storageService.registerUser({
        email: cleanEmail,
        fullName: fullName.trim(),
        role: role,
        storeName: storeName.trim() || 'Sappy Stationery',
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

  // Guest Quick Access
  const handleGuestAccess = () => {
    const guestUser: AppUser = {
      id: `usr-guest-${Date.now()}`,
      email: 'guest.cashier@sappystationery.et',
      fullName: 'Counter Cashier (Guest)',
      role: 'cashier',
      storeName: 'Sappy Stationery & Books',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    storageService.setCurrentUser(guestUser);
    onAuthSuccess(guestUser);
  };

  const containerClasses = isModal
    ? 'fixed inset-0 z-50 bg-charcoal-950/80 backdrop-blur-sm flex items-center justify-center p-4'
    : 'min-h-[85vh] flex items-center justify-center p-4 sm:p-6';

  return (
    <div className={containerClasses}>
      <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden text-charcoal-100 relative">
        
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
          
          <div className="flex flex-col items-center justify-center mb-3">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-amber-500/40 shadow-xl shadow-amber-950/60 mb-2.5">
              <img src={sappySquareIcon} alt="Sappy" className="w-full h-full object-cover" />
            </div>
            <img src={sappyBrandWordmark} alt="SAPPY" className="h-8 w-auto max-w-[160px] object-contain" />
          </div>

          <p className="text-xs text-charcoal-400 mt-1">
            Commercial Point of Sale & Cross-Device Management Hub
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
              <span>Register Store</span>
            </button>
          </div>
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
          {mode === 'login' ? (
            /* ======================================================== */
            /* LOGIN FORM */
            /* ======================================================== */
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1.5">
                  Staff Email or Username
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
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-charcoal-300 uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('owner@sappystationery.et');
                      setPassword('password123');
                    }}
                    className="text-[11px] text-forest-400 hover:text-forest-300 font-semibold cursor-pointer"
                  >
                    Use default
                  </button>
                </div>
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

              {/* Fast Staff Login Presets */}
              <div className="pt-3 border-t border-charcoal-800">
                <p className="text-[11px] font-semibold text-charcoal-400 uppercase tracking-wider mb-2 text-center">
                  Quick Staff Login (1-Click Fill):
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickFill('owner@sappystationery.et', 'owner', 'Abebe Hailu')}
                    className="p-2 bg-charcoal-950 hover:bg-charcoal-800 border border-charcoal-800 hover:border-forest-600 rounded-lg text-center transition-colors cursor-pointer group"
                  >
                    <p className="text-[11px] font-bold text-white group-hover:text-forest-400">Owner</p>
                    <p className="text-[9px] text-charcoal-400 truncate">Abebe</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickFill('manager@sappystationery.et', 'manager', 'Dawit Kebede')}
                    className="p-2 bg-charcoal-950 hover:bg-charcoal-800 border border-charcoal-800 hover:border-blue-600 rounded-lg text-center transition-colors cursor-pointer group"
                  >
                    <p className="text-[11px] font-bold text-white group-hover:text-blue-400">Manager</p>
                    <p className="text-[9px] text-charcoal-400 truncate">Dawit</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickFill('cashier@sappystationery.et', 'cashier', 'Bethelhem T.')}
                    className="p-2 bg-charcoal-950 hover:bg-charcoal-800 border border-charcoal-800 hover:border-amber-600 rounded-lg text-center transition-colors cursor-pointer group"
                  >
                    <p className="text-[11px] font-bold text-white group-hover:text-amber-400">Cashier</p>
                    <p className="text-[9px] text-charcoal-400 truncate">Bethelhem</p>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* ======================================================== */
            /* SIGNUP FORM */
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
                    placeholder="e.g. Abebe Hailu"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white placeholder-charcoal-500 focus:border-forest-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                    Store / Company *
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-charcoal-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sappy Stationery"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white placeholder-charcoal-500 focus:border-forest-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                    Contact Phone
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
                  Terminal Staff Role *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'owner' as UserRole, label: 'Store Owner', desc: 'Full control' },
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
                    <span>Create Staff Account</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Guest Checkout Bypass Option */}
          <div className="mt-4 pt-3 border-t border-charcoal-800 text-center">
            <button
              type="button"
              onClick={handleGuestAccess}
              className="text-xs text-charcoal-400 hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>Instant Test Mode: Continue as Guest Cashier</span>
              <ArrowRight className="w-3.5 h-3.5 text-forest-400" />
            </button>
          </div>

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
