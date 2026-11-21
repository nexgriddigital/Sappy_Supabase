import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

const CHUNK_RELOAD_GUARD_KEY = 'sappy_chunk_reload_at';

export function isModuleLoadError(error: unknown): boolean {
  const msg = String((error as any)?.message || error || '').toLowerCase();
  return (
    msg.includes('importing a module script failed') ||
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('loading chunk') ||
    msg.includes('chunkloaderror') ||
    msg.includes('unable to preload css')
  );
}

export async function performCleanReload(force = false): Promise<void> {
  try {
    if (!force) {
      const last = Number(sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY) || '0');
      if (Date.now() - last < 15000) {
        return;
      }
      sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, String(Date.now()));
    }

    if (typeof caches !== 'undefined' && caches.keys) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }

    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.getRegistrations) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    // Ignore cache/SW cleanup errors and proceed with reload
  }

  try {
    const url = new URL(window.location.href);
    url.searchParams.set('_r', String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    if (isModuleLoadError(error)) {
      void performCleanReload(false);
    }
  }

  private handleReload = () => {
    void performCleanReload(true);
  };

  private handleResetLocal = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    void performCleanReload(true);
  };

  public render() {
    if (this.state.hasError) {
      const isModuleErr = isModuleLoadError(this.state.error);
      return (
        <div className="min-h-screen bg-charcoal-950 text-white flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="max-w-md w-full bg-charcoal-900 border border-charcoal-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-white">SAPPY POS Recovered from an Issue</h2>
              <p className="text-xs text-charcoal-400 mt-1">
                {isModuleErr
                  ? 'A newer version of SAPPY POS was deployed or the connection dropped while loading. Reload to fetch the latest terminal build — your local records are preserved.'
                  : 'The terminal encountered an unexpected runtime error. Your local records are preserved.'}
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-charcoal-950 rounded-xl border border-charcoal-800 text-left overflow-x-auto text-[11px] font-mono text-rose-300">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 bg-forest-700 hover:bg-forest-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Terminal</span>
              </button>
              <button
                type="button"
                onClick={this.handleResetLocal}
                className="py-2.5 px-4 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-300 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                title="Clears corrupted local cache and restarts fresh"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Cache</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
