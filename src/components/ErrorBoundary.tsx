/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Top-level React error boundary for runtime errors and failed lazy chunk loads.
 */

import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  isChunkError: boolean;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, isChunkError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const msg = error?.message || '';
    const isChunkError =
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Loading chunk') ||
      msg.includes('Importing a module script failed');
    return { hasError: true, isChunkError };
  }

  componentDidCatch(_error: Error) {
    // Error captured by UI boundary without exposing stack details.
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-[#FAF6EF] dark:bg-[#141311] text-[#1F1B16] dark:text-[#F5F1EA] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-[#1E1C18] border border-[#C4BBAF] dark:border-[#3E3931] rounded-[12px] p-6 space-y-4 shadow-sm">
          <div className="w-11 h-11 rounded-[10px] bg-[#FDF2F2] dark:bg-[#2B0E0E] text-[#9B1C1C] dark:text-[#F87171] border border-[#F87171]/40 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-serif text-lg font-bold">
              {this.state.isChunkError ? 'Page could not load offline' : 'Something went wrong'}
            </h1>
            <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB] leading-relaxed">
              {this.state.isChunkError
                ? 'A newer version or uncached screen could not be fetched. Check your connection and reload.'
                : 'NileFound hit an unexpected issue while rendering this screen. Reload to continue safely.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full min-h-[44px] bg-[#0F6E6E] hover:bg-[#0C5656] text-white text-sm font-semibold rounded-[10px] inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reload page</span>
          </button>
        </div>
      </div>
    );
  }
}
