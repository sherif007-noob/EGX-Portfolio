import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Database } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught Error in EGX App:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearStorageAndReload = () => {
    if (window.confirm('This will clear local session caches and reload the application. Proceed?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      const errMsg = this.state.error?.message || 'An unexpected application error occurred.';
      const isQuotaError =
        errMsg.toLowerCase().includes('quota') ||
        errMsg.toLowerCase().includes('resource_exhausted') ||
        errMsg.toLowerCase().includes('rate');

      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              {isQuotaError ? <Database className="w-7 h-7 text-amber-400" /> : <AlertTriangle className="w-7 h-7 text-rose-400" />}
            </div>

            <h2 className="text-xl font-bold text-white">
              {isQuotaError ? 'Database Quota / Rate Limit Exceeded' : 'Application Recoverable Error'}
            </h2>

            <p className="text-xs text-slate-400 leading-relaxed">
              {isQuotaError
                ? 'The remote data service reported a quota or rate-limit error. Reload after the limit clears; locally cached state may still be available, but Supabase remains the authoritative portfolio store.'
                : 'The application encountered an unexpected runtime exception. Reload first; resetting local cache should only be used if the problem persists.'}
            </p>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-left overflow-auto max-h-32 text-[11px] font-mono text-amber-300">
              {errMsg}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              <button
                onClick={this.handleReload}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Application
              </button>
              <button
                onClick={this.handleClearStorageAndReload}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                Reset Local Cache
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
