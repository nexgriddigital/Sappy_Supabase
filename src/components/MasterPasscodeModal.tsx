import React, { useState } from 'react';
import {
  Lock,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  X,
  Check,
} from 'lucide-react';
import { AppUser } from '../types/pos.ts';
import { storageService, DEFAULT_MASTER_PASSCODE } from '../services/storageService.ts';

// ============================================================================
// 1. MASTER PASSCODE CHALLENGE MODAL (FOR CRITICAL ACTIONS)
// ============================================================================
interface MasterPasscodeModalProps {
  isOpen: boolean;
  title?: string;
  actionName?: string;
  actionDescription: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const MasterPasscodeModal: React.FC<MasterPasscodeModalProps> = ({
  isOpen,
  title = 'Master Passcode Required',
  actionName = 'Critical Operation',
  actionDescription,
  onSuccess,
  onCancel,
}) => {
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!passcode.trim()) {
      setError('Please enter the Store Master Passcode.');
      return;
    }

    const isValid = storageService.verifyMasterPasscode(passcode);
    if (!isValid) {
      setError('Incorrect Master Passcode. Authorization denied.');
      return;
    }

    // Success: clear and trigger callback
    setPasscode('');
    setError(null);
    onSuccess();
  };

  const handleClose = () => {
    setPasscode('');
    setError(null);
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-950/85 backdrop-blur-xs animate-fade-in">
      <div className="bg-charcoal-900 border border-amber-600/60 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-white relative">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-charcoal-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-950/80 border border-amber-500/70 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>{title}</span>
              </h3>
              <p className="text-[11px] text-amber-400/90 font-mono font-medium">
                Authorization Guard: {actionName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-charcoal-400 hover:text-white p-1 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Warning Card */}
        <div className="p-3.5 rounded-xl bg-charcoal-950 border border-charcoal-800 text-xs text-charcoal-300 space-y-1">
          <p className="text-[11px] font-mono uppercase tracking-wider text-charcoal-400 font-bold">
            Action to be authorized:
          </p>
          <p className="text-white font-medium text-xs leading-relaxed">
            {actionDescription}
          </p>
        </div>

        {/* Error Feedback */}
        {error && (
          <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Passcode Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider">
                Store Master Passcode *
              </label>
              <span className="text-[10px] text-charcoal-500 font-mono">Owner Controlled</span>
            </div>

            <div className="relative">
              <Lock className="w-4 h-4 text-charcoal-500 absolute left-3.5 top-3" />
              <input
                type={showPasscode ? 'text' : 'password'}
                autoFocus
                required
                placeholder="Enter master passcode (e.g. Sappy#1313)"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-charcoal-950 border border-charcoal-700 rounded-xl text-sm text-white placeholder-charcoal-500 font-mono focus:outline-hidden focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowPasscode(!showPasscode)}
                className="absolute right-3 top-2.5 text-charcoal-400 hover:text-white cursor-pointer"
                title={showPasscode ? 'Hide passcode' : 'Show passcode'}
              >
                {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <p className="text-[10px] text-charcoal-500 mt-1.5 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-amber-500 shrink-0" />
              <span>Default store master passcode is <strong className="text-charcoal-300 font-mono">Sappy#1313</strong> unless updated by the Store Owner.</span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-charcoal-800">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-xl bg-charcoal-800 text-charcoal-300 text-xs font-semibold hover:bg-charcoal-700 cursor-pointer transition-colors"
            >
              Cancel Action
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-charcoal-950 font-bold text-xs flex items-center gap-1.5 border border-amber-400 shadow-md cursor-pointer transition-all active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Authorize & Proceed</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

// ============================================================================
// 2. CHANGE MASTER PASSCODE MODAL (OWNER EXCLUSIVE)
// ============================================================================
interface ChangeMasterPasscodeModalProps {
  isOpen: boolean;
  currentUser: AppUser | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ChangeMasterPasscodeModal: React.FC<ChangeMasterPasscodeModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onSuccess,
}) => {
  const isOwner = currentUser?.role === 'owner';

  const [currentPasscode, setCurrentPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isOwner) {
      setError('Permission denied. The Master Passcode can only be changed by Store Owner(s).');
      return;
    }

    if (!currentPasscode.trim()) {
      setError('Please enter your current Master Passcode.');
      return;
    }

    // Verify current
    const isCurrentValid = storageService.verifyMasterPasscode(currentPasscode);
    if (!isCurrentValid) {
      setError('Current Master Passcode is incorrect. Please check your entry.');
      return;
    }

    if (!newPasscode.trim()) {
      setError('Please provide a new Master Passcode.');
      return;
    }

    if (newPasscode.trim().length < 4) {
      setError('New Master Passcode must be at least 4 characters long.');
      return;
    }

    if (newPasscode !== confirmPasscode) {
      setError('New passcodes do not match. Please verify your confirmation entry.');
      return;
    }

    const result = storageService.updateMasterPasscode(newPasscode.trim(), currentUser);
    if (!result.success) {
      setError(result.error || 'Failed to update Master Passcode.');
      return;
    }

    setSuccess('Store Master Passcode updated successfully! Keep this passcode secure.');
    setCurrentPasscode('');
    setNewPasscode('');
    setConfirmPasscode('');

    setTimeout(() => {
      if (onSuccess) onSuccess();
      onClose();
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-950/85 backdrop-blur-xs animate-fade-in">
      <div className="bg-charcoal-900 border border-charcoal-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-white relative">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-charcoal-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-forest-950 border border-forest-600/70 flex items-center justify-center text-forest-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Change Master Passcode
              </h3>
              <p className="text-[11px] text-charcoal-400 font-mono">
                Store Owner Security Authorization
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-charcoal-400 hover:text-white p-1 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ownership Check Notice */}
        {!isOwner ? (
          <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>Owner Access Only</span>
            </div>
            <p className="text-[11px] text-rose-200/90 leading-relaxed">
              You are currently signed in as <strong className="text-white capitalize">{currentUser?.role || 'Staff'}</strong> ({currentUser?.fullName}). The Store Master Passcode can only be viewed or modified by an account with the <strong className="text-white">Store Owner</strong> role.
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
          <>
            <p className="text-xs text-charcoal-300 leading-relaxed">
              The Master Passcode protects sensitive operations like database wipes, fiscal resets, staff deletion, and critical inventory adjustments.
            </p>

            {/* Error Feedback */}
            {error && (
              <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Success Feedback */}
            {success && (
              <div className="p-3 bg-forest-950/80 border border-forest-600 rounded-xl text-forest-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-forest-400" />
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              
              {/* Current Passcode */}
              <div>
                <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                  Current Master Passcode *
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    required
                    placeholder="Enter current passcode (default: Sappy#1313)"
                    value={currentPasscode}
                    onChange={(e) => setCurrentPasscode(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white placeholder-charcoal-500 font-mono focus:outline-hidden focus:border-forest-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-2.5 text-charcoal-400 hover:text-white cursor-pointer"
                  >
                    {showCurrent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* New Passcode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                    New Master Passcode *
                  </label>
                  <div className="relative">
                    <input
                      type={showNew ? 'text' : 'password'}
                      required
                      placeholder="Min 4 characters"
                      value={newPasscode}
                      onChange={(e) => setNewPasscode(e.target.value)}
                      className="w-full pl-3 pr-8 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white placeholder-charcoal-500 font-mono focus:outline-hidden focus:border-forest-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-2.5 top-2.5 text-charcoal-400 hover:text-white cursor-pointer"
                    >
                      {showNew ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1">
                    Confirm New Passcode *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Re-enter new passcode"
                    value={confirmPasscode}
                    onChange={(e) => setConfirmPasscode(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white placeholder-charcoal-500 font-mono focus:outline-hidden focus:border-forest-500"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-charcoal-800">
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
                  <span>Update Passcode</span>
                </button>
              </div>

            </form>
          </>
        )}

      </div>
    </div>
  );
};
