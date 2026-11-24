import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Lock,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  X,
  Check,
  Trash2,
} from 'lucide-react';
import { AppUser } from '../types/pos.ts';
import { storageService } from '../services/storageService.ts';
import { crossDeviceSyncService } from '../services/crossDeviceSyncService.ts';

interface ChangeCredentialsModalProps {
  isOpen: boolean;
  targetUser: AppUser | null;
  currentUser: AppUser | null;
  onClose: () => void;
  onSuccess?: (updatedUser: AppUser) => void;
}

export const ChangeCredentialsModal: React.FC<ChangeCredentialsModalProps> = ({
  isOpen,
  targetUser,
  currentUser,
  onClose,
  onSuccess,
}) => {
  const isSelf = Boolean(currentUser && targetUser && currentUser.id === targetUser.id);
  const isOwner = currentUser?.role === 'owner';

  const [currentCredential, setCurrentCredential] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [clearPin, setClearPin] = useState(false);

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentCredential('');
      setNewPassword('');
      setConfirmPassword('');
      setNewPin('');
      setClearPin(false);
      setError(null);
      setSuccess(null);
    }
  }, [isOpen, targetUser?.id]);

  if (!isOpen || !targetUser) return null;

  const canModify = isSelf || isOwner;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!canModify) {
      setError('Permission denied. Only Store Owners can modify another staff member’s Password or PIN.');
      return;
    }

    const wantPasswordUpdate = newPassword.trim().length > 0;
    const wantPinUpdate = clearPin || newPin.trim().length > 0;

    if (!wantPasswordUpdate && !wantPinUpdate) {
      setError('Enter a new Password, a new 4-digit PIN, or both to save changes.');
      return;
    }

    if (wantPasswordUpdate) {
      if (newPassword.trim().length < 6) {
        setError('New Password must be at least 6 characters long.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('New Password and Confirm Password do not match.');
        return;
      }
    }

    if (newPin.trim().length > 0 && !/^\d{4}$/.test(newPin.trim())) {
      setError('Quick Terminal PIN must be exactly 4 numeric digits.');
      return;
    }

    const res = storageService.updateUserCredentials(targetUser.id, {
      currentCredential: currentCredential.trim(),
      newPassword: wantPasswordUpdate ? newPassword.trim() : undefined,
      newPin: !clearPin && newPin.trim().length > 0 ? newPin.trim() : undefined,
      clearPin,
      actingUser: currentUser,
    });

    if (!res.success || !res.user) {
      setError(res.error || 'Failed to update security credentials.');
      return;
    }

    crossDeviceSyncService.broadcastLocalChange();
    crossDeviceSyncService.syncNow().catch(() => {});

    const updatedParts: string[] = [];
    if (wantPasswordUpdate) updatedParts.push('Password');
    if (clearPin) updatedParts.push('PIN cleared');
    else if (newPin.trim()) updatedParts.push('4-digit PIN');

    setSuccess(`${updatedParts.join(' & ')} updated for ${res.user.fullName}!`);
    setCurrentCredential('');
    setNewPassword('');
    setConfirmPassword('');
    setNewPin('');
    setClearPin(false);

    const updatedUser = res.user;
    setTimeout(() => {
      if (onSuccess) onSuccess(updatedUser);
      onClose();
    }, 1100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-950/85 backdrop-blur-xs animate-fade-in">
      <div className="bg-charcoal-900 border border-charcoal-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-white relative max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-charcoal-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-forest-950 border border-forest-600/70 flex items-center justify-center text-forest-400 shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {isSelf ? 'Change Password & Quick PIN' : `Update Security: ${targetUser.fullName}`}
              </h3>
              <p className="text-[11px] text-charcoal-400 font-mono">
                {targetUser.email} · <span className="uppercase text-forest-400">{targetUser.role}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-charcoal-400 hover:text-white p-1 rounded-lg cursor-pointer transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Summary Badges */}
        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
          <div className="p-2.5 rounded-xl bg-charcoal-950 border border-charcoal-800 flex items-center justify-between">
            <span className="text-charcoal-400">Account PW:</span>
            <span className={targetUser.password ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
              {targetUser.password ? 'Custom Set' : 'Default'}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-charcoal-950 border border-charcoal-800 flex items-center justify-between">
            <span className="text-charcoal-400">4-Digit PIN:</span>
            <span className={targetUser.pinCode ? 'text-emerald-400 font-bold' : 'text-charcoal-500 font-bold'}>
              {targetUser.pinCode ? 'Active (••••)' : 'Not Set'}
            </span>
          </div>
        </div>

        {!canModify ? (
          <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>Permission Denied</span>
            </div>
            <p className="text-[11px] text-rose-200/90 leading-relaxed">
              Only the account holder or a Store Owner can change this user’s Password or Quick Terminal PIN.
            </p>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-charcoal-800 text-white text-xs font-semibold hover:bg-charcoal-700 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3 bg-forest-950/80 border border-forest-600 rounded-xl text-forest-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-forest-400" />
                <span>{success}</span>
              </div>
            )}

            {/* Step 1: Verify Current Credential */}
            <div>
              <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                {isSelf
                  ? 'Current Password or Current 4-Digit PIN *'
                  : 'Owner Password, PIN, or Master Passcode *'}
              </label>
              <div className="relative">
                <ShieldCheck className="w-4 h-4 text-charcoal-500 absolute left-3 top-2.5" />
                <input
                  type={showCurrent ? 'text' : 'password'}
                  required
                  autoFocus
                  placeholder={isSelf ? 'Enter current PW or 4-digit PIN' : 'Enter Owner credential or Master Passcode'}
                  value={currentCredential}
                  onChange={(e) => setCurrentCredential(e.target.value)}
                  className="w-full pl-9 pr-10 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white placeholder-charcoal-500 font-mono focus:outline-hidden focus:border-forest-500"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-2.5 text-charcoal-400 hover:text-white cursor-pointer"
                  title={showCurrent ? 'Hide' : 'Show'}
                >
                  {showCurrent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Step 2: Account Password (PW) */}
            <div className="p-3.5 rounded-xl bg-charcoal-950/80 border border-charcoal-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-forest-400" />
                  <span>New Login Password (PW)</span>
                </span>
                <span className="text-[10px] font-mono text-charcoal-500">Leave blank to keep current</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    placeholder="New PW (min 6 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 bg-charcoal-900 border border-charcoal-700 rounded-xl text-xs text-white placeholder-charcoal-500 font-mono focus:outline-hidden focus:border-forest-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-2.5 top-2.5 text-charcoal-400 hover:text-white cursor-pointer"
                    title={showNewPw ? 'Hide' : 'Show'}
                  >
                    {showNewPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <input
                  type={showNewPw ? 'text' : 'password'}
                  placeholder="Confirm new PW"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-900 border border-charcoal-700 rounded-xl text-xs text-white placeholder-charcoal-500 font-mono focus:outline-hidden focus:border-forest-500"
                />
              </div>
            </div>

            {/* Step 3: 4-Digit Quick Terminal PIN */}
            <div className="p-3.5 rounded-xl bg-charcoal-950/80 border border-charcoal-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>New 4-Digit Quick PIN</span>
                </span>
                {targetUser.pinCode && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextClear = !clearPin;
                      setClearPin(nextClear);
                      if (nextClear) setNewPin('');
                    }}
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-md border flex items-center gap-1 cursor-pointer transition-colors ${
                      clearPin
                        ? 'bg-rose-950 border-rose-700 text-rose-300'
                        : 'bg-charcoal-900 border-charcoal-700 text-charcoal-400 hover:text-rose-300'
                    }`}
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                    <span>{clearPin ? 'Will Remove PIN' : 'Remove PIN'}</span>
                  </button>
                )}
              </div>

              {!clearPin ? (
                <div className="relative">
                  <input
                    type={showNewPin ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="4 digits (leave blank to keep current)"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full pl-3 pr-10 py-2 bg-charcoal-900 border border-charcoal-700 rounded-xl text-xs text-white placeholder-charcoal-500 font-mono tracking-[0.3em] focus:outline-hidden focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPin(!showNewPin)}
                    className="absolute right-3 top-2.5 text-charcoal-400 hover:text-white cursor-pointer"
                    title={showNewPin ? 'Hide PIN' : 'Show PIN'}
                  >
                    {showNewPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-rose-300 font-mono">
                  Saving will remove the 4-digit Quick PIN for this user (login via Password only).
                </p>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-charcoal-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-charcoal-800 text-charcoal-300 text-xs font-semibold hover:bg-charcoal-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-forest-700 hover:bg-forest-600 text-white font-bold text-xs flex items-center gap-1.5 border border-forest-500 shadow-md cursor-pointer transition-all active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Save Password & PIN</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
