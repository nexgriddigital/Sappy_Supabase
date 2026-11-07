import React from 'react';
import sappySquareIcon from '../assets/images/sappy_icon_square_1793958931489.jpg';

interface LoadingScreenProps {
  message?: string;
  submessage?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Initializing Sappy POS Terminal...',
  submessage = 'Connecting cross-device cloud sync and verifying local ledgers',
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-charcoal-950 flex flex-col items-center justify-center p-6 select-none">
      <div className="relative flex flex-col items-center max-w-sm text-center">
        {/* Glow ambient background */}
        <div className="absolute -inset-10 bg-amber-500/10 rounded-full blur-3xl animate-pulse pointer-events-none" />

        {/* Brand Logo with Pulsing Ring */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-2xl bg-charcoal-900 border border-amber-500/40 p-1 flex items-center justify-center shadow-2xl shadow-amber-950/40 relative">
            <img
              src={sappySquareIcon}
              alt="Sappy"
              className="w-full h-full object-cover rounded-xl"
            />
            {/* Spinning decorative ring */}
            <div className="absolute -inset-1.5 rounded-2xl border border-amber-400/40 border-t-amber-400 animate-spin" />
          </div>
        </div>

        {/* Wordmark */}
        <div className="mb-4">
          <span className="font-serif tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 font-extrabold text-2xl drop-shadow-sm">
            SAPPY
          </span>
        </div>

        {/* Dynamic Progress Indicator */}
        <div className="w-56 h-1.5 bg-charcoal-900 rounded-full overflow-hidden border border-charcoal-800 mb-3 relative">
          <div className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-forest-400 rounded-full animate-indeterminate" />
        </div>

        {/* Text */}
        <h3 className="text-sm font-bold text-white tracking-wide">{message}</h3>
        <p className="text-xs text-charcoal-400 mt-1 max-w-xs">{submessage}</p>
      </div>
    </div>
  );
};

export const PaymentProcessingLoader: React.FC<{ message?: string }> = ({
  message = 'Processing payment and generating commercial tax invoice...',
}) => {
  return (
    <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-charcoal-800" />
        <div className="absolute inset-0 rounded-full border-4 border-forest-500 border-t-transparent animate-spin" />
        <div className="absolute inset-2 rounded-full bg-charcoal-900 flex items-center justify-center">
          <img
            src={sappySquareIcon}
            alt="Sappy"
            className="w-8 h-8 rounded-lg object-cover"
          />
        </div>
      </div>
      <div>
        <p className="text-sm font-bold text-white">{message}</p>
        <p className="text-xs text-charcoal-400 mt-0.5">Recording transaction to sales ledger & cloud sync</p>
      </div>
    </div>
  );
};

export const PulseSyncIndicator: React.FC<{
  isSyncing: boolean;
  status: 'synced' | 'syncing' | 'offline' | 'error';
  onClick?: () => void;
  lastSyncedText?: string;
}> = ({ isSyncing, status, onClick, lastSyncedText }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'syncing':
        return 'text-amber-400 bg-amber-950/80 border-amber-800/80';
      case 'synced':
        return 'text-emerald-400 bg-emerald-950/80 border-emerald-800/80 hover:bg-emerald-900/80';
      case 'offline':
        return 'text-amber-300 bg-amber-950/70 border-amber-800/80 hover:bg-amber-900/80 hover:border-amber-600';
      case 'error':
        return 'text-rose-400 bg-rose-950/80 border-rose-800/80 hover:bg-rose-900/80';
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border transition-all cursor-pointer active:scale-95 shadow-2xs ${getStatusColor()}`}
      title={
        status === 'synced'
          ? 'Cloud Synced. Click to manage cloud connection.'
          : status === 'syncing'
          ? 'Synchronizing with cloud...'
          : 'Running in Local Mode. Click to connect Supabase or Cloud Server.'
      }
    >
      <span className="relative flex h-2 w-2">
        {status === 'synced' && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            status === 'syncing'
              ? 'bg-amber-400 animate-spin'
              : status === 'synced'
              ? 'bg-emerald-400'
              : status === 'offline'
              ? 'bg-amber-400'
              : 'bg-rose-400'
          }`}
        />
      </span>
      <span>
        {status === 'syncing'
          ? 'Syncing...'
          : status === 'synced'
          ? 'Cloud Synced'
          : status === 'offline'
          ? 'Local (Connect)'
          : 'Sync Error'}
      </span>
    </button>
  );
};
