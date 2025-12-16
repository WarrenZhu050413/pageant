import { useEffect } from 'react';
import { clsx } from 'clsx';
import { useStore } from '../../store';
import { useKeyboardShortcuts } from '../../hooks';
import { LeftSidebar } from '../sidebar/LeftSidebar';
import { MainStage } from '../stage/MainStage';
import { RightPanel } from '../panel/RightPanel';

export function AppShell() {
  const initialize = useStore((s) => s.initialize);
  const error = useStore((s) => s.error);
  const clearError = useStore((s) => s.clearError);

  // Initialize data on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Set up keyboard shortcuts
  useKeyboardShortcuts();

  return (
    <div className="h-screen flex bg-canvas overflow-hidden">
      {/* Left Sidebar */}
      <aside
        className={clsx(
          'w-[300px] flex-shrink-0',
          'bg-surface border-r border-border',
          'flex flex-col'
        )}
      >
        <LeftSidebar />
      </aside>

      {/* Main Stage */}
      <main className="flex-1 min-w-0 flex flex-col">
        <MainStage />
      </main>

      {/* Right Panel */}
      <aside
        className={clsx(
          'w-[360px] flex-shrink-0',
          'bg-surface border-l border-border',
          'flex flex-col'
        )}
      >
        <RightPanel />
      </aside>

      {/* Error Toast */}
      {error && (
        <div
          className={clsx(
            'fixed bottom-4 left-1/2 -translate-x-1/2',
            'px-4 py-3 rounded-lg shadow-lg',
            'bg-error text-surface text-sm',
            'animate-[slideUp_0.3s_ease-out]'
          )}
        >
          <div className="flex items-center gap-3">
            <span>{error}</span>
            <button
              onClick={clearError}
              className="text-surface/80 hover:text-surface"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
