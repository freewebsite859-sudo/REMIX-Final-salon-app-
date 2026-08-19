import React from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

/**
 * App-level crash guard. If any render/runtime error escapes the component
 * tree, show a branded recovery screen instead of a blank white page.
 * "Reset App Data" clears only Nexora's own localStorage keys (which may hold
 * stale data from an older app version) and reloads.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[Nexora] App crashed:', error, info?.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetData = () => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('nexora') || key.startsWith('hideBookNearestBanner'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch {
      /* storage unavailable */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-surface-off-white text-on-surface flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg mb-6">
          <span className="text-white font-extrabold text-2xl">N</span>
        </div>
        <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
        <p className="text-sm text-on-surface-variant max-w-sm mb-2">
          Nexora SalonOS hit an unexpected error. Reloading usually fixes it — if it keeps
          happening, reset the locally saved app data.
        </p>
        {this.state.errorMessage ? (
          <p className="text-xs text-outline max-w-sm mb-6 break-words">
            {this.state.errorMessage}
          </p>
        ) : (
          <div className="mb-6" />
        )}
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
          <button
            type="button"
            onClick={this.handleReload}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-white font-semibold py-3 px-4 active:scale-[0.98] transition-transform"
          >
            <RefreshCw className="w-4 h-4" />
            Reload App
          </button>
          <button
            type="button"
            onClick={this.handleResetData}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant text-on-surface font-semibold py-3 px-4 active:scale-[0.98] transition-transform"
          >
            <Trash2 className="w-4 h-4" />
            Reset App Data
          </button>
        </div>
      </div>
    );
  }
}
