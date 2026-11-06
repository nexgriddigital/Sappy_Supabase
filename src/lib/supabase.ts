import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read from Vite environment variables or localStorage
const envUrl = ((import.meta as any).env?.VITE_SUPABASE_URL || '').trim();
const envAnonKey = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '').trim();

// Stored client singleton
let activeClient: SupabaseClient | null = null;
let activeUrl = envUrl;
let activeAnonKey = envAnonKey;

// Try to initialize from localStorage credentials if not in env
try {
  const saved = typeof window !== 'undefined' ? localStorage.getItem('sappy_supabase_credentials_v1') : null;
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed.url && parsed.anonKey) {
      activeUrl = parsed.url.trim();
      activeAnonKey = parsed.anonKey.trim();
    }
  }
} catch {
  // Ignore storage errors
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

/**
 * Tests connection to Supabase and checks if tables exist.
 */
export async function testSupabaseConnection(
  testClient?: SupabaseClient | null
): Promise<{ success: boolean; message: string; tableFound: boolean }> {
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
      return {
        success: false,
        tableFound: false,
        message: `Connection error: ${error.message} (${error.code || ''})`,
      };
    }
    return {
      success: true,
      tableFound: true,
      message: 'Successfully connected to Supabase and verified tables!',
    };
  } catch (err: any) {
    return {
      success: false,
      tableFound: false,
      message: `Network error: ${err.message || 'Could not reach Supabase endpoint.'}`,
    };
  }
}
