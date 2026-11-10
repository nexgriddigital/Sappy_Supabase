import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default Supabase project credentials for Sappy Stationary POS
export const DEFAULT_SUPABASE_URL = 'https://fegfrjhxxpojmalytbku.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_Ym9JdgLbipg5KGouA2UGEg_smmRkqd2';

// Read from Vite environment variables or defaults
const envUrl = (((import.meta as any).env?.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL) as string).trim();
const envAnonKey = (((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY) as string).trim();

// Stored client singleton
let activeClient: SupabaseClient | null = null;
let activeUrl = envUrl || DEFAULT_SUPABASE_URL;
let activeAnonKey = envAnonKey || DEFAULT_SUPABASE_ANON_KEY;

try {
  const saved = typeof window !== 'undefined' ? localStorage.getItem('sappy_supabase_credentials_v1') : null;
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed.url && parsed.anonKey) {
      activeUrl = parsed.url.trim();
      activeAnonKey = parsed.anonKey.trim();
    }
  }
  // Check store config if credentials not found in specific key
  if ((!activeUrl || !activeAnonKey) && typeof window !== 'undefined') {
    const rawConfig = localStorage.getItem('sappy_pos_config_v1');
    if (rawConfig) {
      const cfg = JSON.parse(rawConfig);
      if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
        activeUrl = cfg.supabaseUrl.trim();
        activeAnonKey = cfg.supabaseAnonKey.trim();
      }
    }
  }
} catch {
  // Ignore storage errors
}

// Fallback to defaults if empty
if (!activeUrl) activeUrl = DEFAULT_SUPABASE_URL;
if (!activeAnonKey) activeAnonKey = DEFAULT_SUPABASE_ANON_KEY;

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
    console.warn('Could not initialize Supabase client:', err);
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
 * Checks whether Supabase credentials have been configured.
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

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(
        'sappy_supabase_credentials_v1',
        JSON.stringify({ url: cleanUrl, anonKey: cleanKey })
      );

      // Also persist to store config so crossDeviceSyncService automatically pushes credentials to central server
      const rawConfig = localStorage.getItem('sappy_pos_config_v1');
      const cfg = rawConfig ? JSON.parse(rawConfig) : {};
      cfg.supabaseUrl = cleanUrl;
      cfg.supabaseAnonKey = cleanKey;
      localStorage.setItem('sappy_pos_config_v1', JSON.stringify(cfg));

      if ('BroadcastChannel' in window) {
        try {
          const bc = new BroadcastChannel('sappy_pos_sync_channel');
          bc.postMessage({ type: 'DATA_UPDATED', timestamp: Date.now() });
          bc.close();
        } catch {}
      }
    } catch (e) {
      console.error('Could not persist Supabase credentials:', e);
    }
  }

  return { client: newClient, success: true };
}

/**
 * Resets saved custom Supabase credentials back to the primary store Supabase instance.
 */
export function resetSupabaseConfig(): void {
  activeUrl = DEFAULT_SUPABASE_URL;
  activeAnonKey = DEFAULT_SUPABASE_ANON_KEY;
  try {
    activeClient = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  } catch {}
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('sappy_supabase_credentials_v1');

      const rawConfig = localStorage.getItem('sappy_pos_config_v1');
      if (rawConfig) {
        const cfg = JSON.parse(rawConfig);
        cfg.supabaseUrl = DEFAULT_SUPABASE_URL;
        cfg.supabaseAnonKey = DEFAULT_SUPABASE_ANON_KEY;
        localStorage.setItem('sappy_pos_config_v1', JSON.stringify(cfg));
      }

      if ('BroadcastChannel' in window) {
        try {
          const bc = new BroadcastChannel('sappy_pos_sync_channel');
          bc.postMessage({ type: 'DATA_UPDATED', timestamp: Date.now() });
          bc.close();
        } catch {}
      }
    } catch {
      // Ignore storage errors
    }
  }
}

/**
 * Tests connection to Supabase and checks if tables exist.
 */
export async function testSupabaseConnection(
  testClient?: SupabaseClient | null
): Promise<{ success: boolean; message: string; tableFound: boolean; rlsError?: boolean }> {
  const client = testClient || activeClient;
  if (!client) {
    return { success: false, message: 'No Supabase client configured.', tableFound: false };
  }

  try {
    const { error } = await client.from('products').select('id').limit(1);
    if (error) {
      const isMissingTable =
        error.code === 'PGRST205' ||
        error.code === '42P01' ||
        error.message?.includes('schema cache') ||
        error.message?.includes('does not exist');

      if (isMissingTable) {
        return {
          success: true,
          tableFound: false,
          message: 'Connected to Supabase project! Database tables need to be created in your Supabase SQL Editor.',
        };
      }
      if (error.code === '42501' || error.message?.includes('row-level security')) {
        return {
          success: true,
          tableFound: true,
          rlsError: true,
          message: 'Connected to Supabase! Row-Level Security policy (Error 42501) is blocking table access. Run the RLS fix in SQL Editor.',
        };
      }
      return {
        success: false,
        tableFound: false,
        message: `Connection error: ${error.message} (${error.code || ''})`,
      };
    }

    // Quick write probe to detect RLS write block (Error 42501)
    const testProbeId = `probe-${Date.now()}`;
    const { error: writeErr } = await client.from('products').upsert({
      id: testProbeId,
      sku: `PROBE-${testProbeId}`,
      barcode: '',
      name: '__probe_test__',
      category: 'Diagnostic',
      cost_price: 1,
      selling_price: 1,
      stock_level: 0,
      low_stock_threshold: 0,
      unit: 'pcs',
      description: 'Temporary RLS diagnostic probe',
    });

    if (writeErr) {
      if (writeErr.code === '42501' || writeErr.message?.includes('row-level security')) {
        return {
          success: true,
          tableFound: true,
          rlsError: true,
          message: 'Connected to Supabase, but Row-Level Security (Error 42501) is blocking new records. Run the 1-click RLS fix in SQL Editor.',
        };
      }
    } else {
      // Clean up diagnostic probe row
      try {
        await client.from('products').delete().eq('id', testProbeId);
      } catch {}
    }

    return {
      success: true,
      tableFound: true,
      rlsError: false,
      message: 'Successfully connected to Supabase! Read and write permissions are fully active.',
    };
  } catch (err: any) {
    return {
      success: false,
      tableFound: false,
      message: `Network error: ${err.message || 'Could not reach Supabase endpoint.'}`,
    };
  }
}
