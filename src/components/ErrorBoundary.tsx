import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

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
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetLocal = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-charcoal-950 text-white flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="max-w-md w-full bg-charcoal-900 border border-charcoal-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-white">SAPPY POS Recovered from an Issue</h2>
              <p className="text-xs text-charcoal-400 mt-1">
                The terminal encountered an unexpected runtime error. Your local records are preserved.
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
