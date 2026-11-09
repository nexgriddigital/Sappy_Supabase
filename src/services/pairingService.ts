import { getSupabaseCredentials, configureSupabase, isSupabaseConfigured } from '../lib/supabase.ts';
import { storageService } from './storageService.ts';
import { crossDeviceSyncService } from './crossDeviceSyncService.ts';
import { StoreConfig } from '../types/pos.ts';

export interface PairingPayload {
  supabaseUrl: string;
  supabaseAnonKey: string;
  storeName?: string;
  masterPasscode?: string;
  timestamp: number;
}

/**
 * Encodes pairing data into a compact base64 URL string.
 */
export function generatePairingUrl(): string {
  if (typeof window === 'undefined') return '';
  const creds = getSupabaseCredentials();
  const config = storageService.getStoreConfig();

  const url = creds.url || config.supabaseUrl || '';
  const key = creds.anonKey || config.supabaseAnonKey || '';

  if (!url || !key) return '';

  const payload: PairingPayload = {
    supabaseUrl: url,
    supabaseAnonKey: key,
    storeName: config.storeName || 'Sappy Stationary',
    masterPasscode: config.masterPasscode || 'Sappy#1313',
    timestamp: Date.now(),
  };

  const jsonStr = JSON.stringify(payload);
  const base64 = btoa(encodeURIComponent(jsonStr));
  const currentOrigin = window.location.origin;
  const currentPath = window.location.pathname;

  return `${currentOrigin}${currentPath}#pair=${base64}`;
}

/**
 * Returns a compact string token for manual entry.
 */
export function generatePairingCode(): string {
  if (typeof window === 'undefined') return '';
  const creds = getSupabaseCredentials();
  const config = storageService.getStoreConfig();
  const url = creds.url || config.supabaseUrl || '';
  const key = creds.anonKey || config.supabaseAnonKey || '';

  if (!url || !key) return '';

  const payload: PairingPayload = {
    supabaseUrl: url,
    supabaseAnonKey: key,
    storeName: config.storeName || 'Sappy Stationary',
    masterPasscode: config.masterPasscode || 'Sappy#1313',
    timestamp: Date.now(),
  };

  return btoa(encodeURIComponent(JSON.stringify(payload)));
}

/**
 * Inspects a pairing token or URL hash and applies the credentials.
 */
export function applyPairingToken(tokenOrUrl: string): { success: boolean; message: string } {
  try {
    let clean = tokenOrUrl.trim();
    if (clean.includes('#pair=')) {
      clean = clean.split('#pair=')[1].split('&')[0];
    } else if (clean.includes('pair=')) {
      clean = clean.split('pair=')[1].split('&')[0];
    }

    if (!clean) {
      return { success: false, message: 'Invalid or empty pairing token.' };
    }

    const jsonStr = decodeURIComponent(atob(clean));
    const payload = JSON.parse(jsonStr) as PairingPayload;

    if (!payload.supabaseUrl || !payload.supabaseAnonKey) {
      return { success: false, message: 'Pairing payload is missing database keys.' };
    }

    // 1. Configure Supabase client
    configureSupabase(payload.supabaseUrl, payload.supabaseAnonKey);

    // 2. Persist into Store Config
    const currentConfig = storageService.getStoreConfig();
    const updatedConfig: StoreConfig = {
      ...currentConfig,
      supabaseUrl: payload.supabaseUrl.trim(),
      supabaseAnonKey: payload.supabaseAnonKey.trim(),
      storeName: payload.storeName || currentConfig.storeName,
      masterPasscode: payload.masterPasscode || currentConfig.masterPasscode || 'Sappy#1313',
    };
    storageService.saveStoreConfig(updatedConfig);

    // 3. Auto-login as Owner if no user active
    const currentAuthUser = storageService.getCurrentUser();
    if (!currentAuthUser) {
      const users = storageService.getUsers();
      const ownerUser = users.find((u) => u.email === 'amanuealhailu007@gmail.com') ||
                        users.find((u) => u.role === 'owner') ||
                        users[0];
      if (ownerUser) {
        storageService.setCurrentUser(ownerUser);
      }
    }

    // 4. Trigger cloud sync immediately
    try {
      crossDeviceSyncService.syncNow().catch(() => {});
    } catch {}

    return {
      success: true,
      message: `Successfully connected to ${payload.storeName || 'Sappy Stationary'} cloud database!`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Could not parse pairing code: ${err.message || 'Invalid format'}`,
    };
  }
}

/**
 * Checks window.location for pairing hash on page startup and applies it.
 */
export function checkAndApplyUrlPairing(): boolean {
  if (typeof window === 'undefined') return false;

  const hash = window.location.hash;
  const search = window.location.search;

  let token = '';
  if (hash.includes('pair=')) {
    token = hash.split('pair=')[1].split('&')[0];
  } else if (search.includes('pair=')) {
    const params = new URLSearchParams(search);
    token = params.get('pair') || '';
  }

  if (token) {
    const result = applyPairingToken(token);
    if (result.success) {
      // Clean URL hash without reloading page
      try {
        const cleanUrl = window.location.pathname + (window.location.search.includes('pair=') ? '' : window.location.search);
        window.history.replaceState(null, '', cleanUrl);
      } catch {}
      return true;
    }
  }

  return false;
}
