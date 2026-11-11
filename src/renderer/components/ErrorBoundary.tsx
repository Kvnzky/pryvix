import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Undo2, Terminal } from 'lucide-react';
import pryvixLogomark from '../assets/brand/pryvix-logomark.png';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] h-full p-8 text-center bg-[#0a0e1a] text-gray-200">
          <div className="max-w-md w-full bg-[#121829] border border-violet-500/40 rounded-2xl p-6 shadow-2xl text-left space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-600/10 text-violet-400 flex items-center justify-center border border-violet-500/30 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {this.props.fallbackTitle || 'Rendering Error Prevented'}
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    The application caught an unexpected error and safely isolated it.
                  </p>
                </div>
              </div>
              <img src={pryvixLogomark} alt="Pryvix" className="w-6 h-6 object-contain opacity-60 shrink-0" />
            </div>

            {this.state.error && (
              <div className="p-3 rounded-lg bg-[#0a0e1a] border border-[#1e2942] text-[11px] font-mono text-violet-300 break-words space-y-1">
                <div className="flex items-center gap-1.5 text-gray-400 text-[10px]">
                  <Terminal className="w-3 h-3" />
                  <span>Error Details:</span>
                </div>
                <div>{this.state.error.message || String(this.state.error)}</div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2 border-t border-[#1e2942]">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-[#2563eb] to-[#7c3aed] hover:from-[#1d4ed8] hover:to-[#6d28d9] text-white rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-md"
              >
                <Undo2 className="w-3.5 h-3.5" /> Dismiss & Try Again
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 bg-[#18223a] hover:bg-[#202e4e] text-gray-300 rounded-lg text-xs font-medium border border-[#1e2942] transition-all flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
