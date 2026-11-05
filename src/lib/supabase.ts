import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default Supabase project credentials provided for Sappy Stationary
const DEFAULT_SUPABASE_URL = 'https://fegfrjhxxpojmalytbku.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_Ym9JdgLbipg5KGouA2UGEg_smmRkqd2';

// Read from Vite environment variables or default project credentials
const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const envAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY;

// Stored client singleton
let activeClient: SupabaseClient | null = null;
let activeUrl = envUrl;
let activeAnonKey = envAnonKey;

// Try to initialize from localStorage credentials if not in env
if (!activeUrl || !activeAnonKey) {
  try {
    const saved = localStorage.getItem('sappy_supabase_credentials_v1');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.url && parsed.anonKey) {
        activeUrl = parsed.url;
        activeAnonKey = parsed.anonKey;
      }
    }
  } catch {
    // Ignore storage errors
  }
}

// Create singleton if credentials exist
if (activeUrl && activeAnonKey) {
  try {
    activeClient = createClient(activeUrl, activeAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
  }
}

/**
 * Returns the current default Supabase client or null if not yet configured.
 */
export function getSupabase(): SupabaseClient | null {
  return activeClient;
}

export const supabase = activeClient;

/**
 * Checks whether Supabase credentials have been configured and loaded.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(activeUrl && activeAnonKey && activeClient);
}

/**
 * Returns currently active Supabase connection credentials.
 */
export function getSupabaseCredentials(): { url: string; anonKey: string } {
  return {
    url: activeUrl,
    anonKey: activeAnonKey,
  };
}

/**
 * Allows dynamic configuration or runtime testing of Supabase credentials.
 * Saves credentials to localStorage so the client reconnects across page refreshes.
 */
export function configureSupabase(url: string, anonKey: string): {
  client: SupabaseClient;
  success: boolean;
} {
  const cleanUrl = url.trim();
  const cleanKey = anonKey.trim();

  if (!cleanUrl || !cleanKey) {
    throw new Error('Supabase Project URL and Anon/Public Key are required.');
  }

  const newClient = createClient(cleanUrl, cleanKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  activeClient = newClient;
  activeUrl = cleanUrl;
  activeAnonKey = cleanKey;

  try {
    localStorage.setItem(
      'sappy_supabase_credentials_v1',
      JSON.stringify({ url: cleanUrl, anonKey: cleanKey })
    );
  } catch (e) {
    console.error('Could not persist Supabase credentials to localStorage:', e);
  }

  return { client: newClient, success: true };
}

/**
 * Clears saved Supabase credentials and resets to local offline mode.
 */
export function resetSupabaseConfig(): void {
  activeClient = null;
  activeUrl = '';
  activeAnonKey = '';
  try {
    localStorage.removeItem('sappy_supabase_credentials_v1');
  } catch {
    // Ignore storage errors
  }
}
