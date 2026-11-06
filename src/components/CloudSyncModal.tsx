import React, { useState } from 'react';
import {
  Cloud,
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  ExternalLink,
  Server,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  getSupabaseCredentials,
  configureSupabase,
  resetSupabaseConfig,
  testSupabaseConnection,
  isSupabaseConfigured,
} from '../lib/supabase.ts';
import { crossDeviceSyncService, SyncState } from '../services/crossDeviceSyncService.ts';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncState: SyncState;
  onNavigateToSyncTab: () => void;
  onRefreshData: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  syncState,
  onNavigateToSyncTab,
  onRefreshData,
}) => {
  const [credentials, setCredentials] = useState(getSupabaseCredentials());
  const [supabaseUrl, setSupabaseUrl] = useState(credentials.url);
  const [supabaseKey, setSupabaseKey] = useState(credentials.anonKey);
  const [backendUrl, setBackendUrlState] = useState(crossDeviceSyncService.getBackendUrl());

  const [activeSubTab, setActiveSubTab] = useState<'supabase' | 'backend'>('supabase');
  const [isTesting, setIsTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSaveSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter both Supabase Project URL and Anon Key.' });
      return;
    }

    setIsTesting(true);
    setStatusMessage({ type: 'info', text: 'Validating Supabase connection...' });

    try {
      const { client } = configureSupabase(supabaseUrl, supabaseKey);
      const testResult = await testSupabaseConnection(client);

      if (testResult.success) {
        setStatusMessage({
          type: 'success',
          text: testResult.message,
        });
        await crossDeviceSyncService.syncNow();
        onRefreshData();
      } else {
        setStatusMessage({
          type: 'error',
          text: testResult.message,
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to connect to Supabase.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveBackend = async (e: React.FormEvent) => {
    e.preventDefault();
    crossDeviceSyncService.setBackendUrl(backendUrl);
    setIsTesting(true);
    setStatusMessage({ type: 'info', text: 'Testing custom backend endpoint...' });

    const success = await crossDeviceSyncService.syncNow();
    setIsTesting(false);

    if (success) {
      setStatusMessage({ type: 'success', text: 'Successfully connected to backend server!' });
      onRefreshData();
    } else {
      setStatusMessage({
        type: 'error',
        text: 'Could not reach /api/pos/sync on the specified backend. Check URL and CORS.',
      });
    }
  };

  const handleManualSync = async () => {
    setIsTesting(true);
    const success = await crossDeviceSyncService.syncNow();
    setIsTesting(false);
    if (success) {
      setStatusMessage({ type: 'success', text: 'Synchronization completed successfully!' });
      onRefreshData();
    } else {
      setStatusMessage({
        type: 'error',
        text: 'Sync could not reach a remote cloud database. Ensure Supabase or backend is configured.',
      });
    }
  };

  const handleDisconnect = () => {
    resetSupabaseConfig();
    setSupabaseUrl('');
    setSupabaseKey('');
    crossDeviceSyncService.setBackendUrl('');
    setBackendUrlState('');
    setStatusMessage({ type: 'info', text: 'Reset to local offline storage mode.' });
    crossDeviceSyncService.syncNow();
  };

  return (
    <div className="fixed inset-0 z-50 bg-charcoal-950/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-charcoal-900 rounded-2xl shadow-2xl max-w-lg w-full border border-charcoal-800 overflow-hidden flex flex-col my-auto text-charcoal-100">
        
        {/* Header */}
        <div className="bg-charcoal-950 px-6 py-4 flex items-center justify-between border-b border-charcoal-800">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-forest-950 border border-forest-700/60 flex items-center justify-center text-forest-400">
              <Cloud className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-white">Cross-Device Cloud Sync</h3>
              <p className="text-xs text-charcoal-400">Connect cloud database for multi-device live sync</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-charcoal-400 hover:text-white p-1 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Connection Status Banner */}
        <div className="px-6 pt-5 pb-3">
          <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
            syncState.status === 'synced'
              ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
              : 'bg-amber-950/40 border-amber-800/80 text-amber-200'
          }`}>
            <div className="flex items-center gap-2.5">
              <span className={`w-3 h-3 rounded-full shrink-0 ${
                syncState.status === 'synced' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`} />
              <div>
                <p className="text-xs font-bold">
                  Status: {syncState.status === 'synced' ? 'Cloud Synced' : 'Running in Local Mode'}
                </p>
                <p className="text-[11px] text-charcoal-300 mt-0.5">
                  {syncState.mode === 'supabase'
                    ? 'Connected directly to Supabase PostgreSQL'
                    : syncState.mode === 'server'
                    ? 'Connected to Node/Express sync backend'
                    : 'GitHub Pages is static: data is currently saved in this browser.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleManualSync}
              disabled={isTesting}
              className="py-1.5 px-3 rounded-lg bg-charcoal-800 hover:bg-charcoal-700 text-xs font-bold font-mono text-white flex items-center gap-1.5 shrink-0 border border-charcoal-700 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin text-amber-400' : ''}`} />
              <span>Sync</span>
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="px-6 grid grid-cols-2 gap-2 border-b border-charcoal-800 pb-3">
          <button
            type="button"
            onClick={() => setActiveSubTab('supabase')}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'supabase'
                ? 'bg-forest-900/80 text-forest-300 border border-forest-700'
                : 'bg-charcoal-950 text-charcoal-400 border border-charcoal-800 hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Supabase Free Tier (Recommended)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('backend')}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'backend'
                ? 'bg-forest-900/80 text-forest-300 border border-forest-700'
                : 'bg-charcoal-950 text-charcoal-400 border border-charcoal-800 hover:text-white'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Custom Backend URL</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          
          {activeSubTab === 'supabase' && (
            <form onSubmit={handleSaveSupabase} className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-charcoal-300">
                    Supabase Project URL
                  </label>
                  <a
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-forest-400 hover:underline inline-flex items-center gap-1"
                  >
                    <span>Supabase Dashboard</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <input
                  type="url"
                  required
                  placeholder="https://xyzcompany.supabase.co"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white placeholder-charcoal-500 font-mono focus:border-forest-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-charcoal-300 mb-1">
                  Supabase Public/Anon API Key
                </label>
                <input
                  type="password"
                  required
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={supabaseKey}
                  onChange={(e) => setSupabaseKey(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white placeholder-charcoal-500 font-mono focus:border-forest-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isTesting}
                  className="flex-1 py-2 px-4 rounded-xl bg-forest-700 hover:bg-forest-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span>Connect & Save Supabase</span>
                </button>
                {isSupabaseConfigured() && (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="py-2 px-3 rounded-xl bg-charcoal-800 hover:bg-rose-950 hover:text-rose-300 text-charcoal-400 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </form>
          )}

          {activeSubTab === 'backend' && (
            <form onSubmit={handleSaveBackend} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-charcoal-300 mb-1">
                  Custom Node/Express Server URL
                </label>
                <p className="text-[11px] text-charcoal-400 mb-2">
                  If you deployed this repo to Render, Fly.io, or Railway, enter the full public URL:
                </p>
                <input
                  type="url"
                  placeholder="https://sappy-pos-backend.onrender.com"
                  value={backendUrl}
                  onChange={(e) => setBackendUrlState(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white placeholder-charcoal-500 font-mono focus:border-forest-500 focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={isTesting}
                className="w-full py-2 px-4 rounded-xl bg-forest-700 hover:bg-forest-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
              >
                <Server className="w-3.5 h-3.5" />
                <span>Save Backend URL</span>
              </button>
            </form>
          )}

          {/* Feedback status message */}
          {statusMessage && (
            <div className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                : statusMessage.type === 'error'
                ? 'bg-rose-950/60 border-rose-800 text-rose-300'
                : 'bg-charcoal-950 border-charcoal-800 text-charcoal-300'
            }`}>
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : statusMessage.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              ) : (
                <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-amber-400 mt-0.5" />
              )}
              <span className="leading-relaxed">{statusMessage.text}</span>
            </div>
          )}

          {/* Helper links */}
          <div className="pt-2 border-t border-charcoal-800 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateToSyncTab();
              }}
              className="text-forest-400 hover:text-forest-300 font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <span>View Full SQL Schema & Setup Guide</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] text-charcoal-500 font-mono">
              Offline-First Enabled
            </span>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-charcoal-950 border-t border-charcoal-800 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-charcoal-800 hover:bg-charcoal-700 text-white text-xs font-semibold cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
