import { useEffect, useState, useCallback, useRef } from 'react';
import { clsx } from 'clsx';
import { useStore } from '../../store';
import { useKeyboardShortcuts, useTheme } from '../../hooks';
import { LeftSidebar } from '../sidebar/LeftSidebar';
import { MainStage } from '../stage/MainStage';
import { RightPanel } from '../panel/RightPanel';

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 500;
const DEFAULT_LEFT_WIDTH = 375;
const DEFAULT_RIGHT_WIDTH = 360;

export function AppShell() {
  const initialize = useStore((s) => s.initialize);
  const error = useStore((s) => s.error);
  const clearError = useStore((s) => s.clearError);

  // Resizable sidebar widths
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT_WIDTH);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize data on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Set up keyboard shortcuts
  useKeyboardShortcuts();

  // Initialize theme (applies dark class to html element)
  useTheme();

  // Handle mouse move for resizing
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();

      if (isResizingLeft) {
        const newWidth = e.clientX - containerRect.left;
        setLeftWidth(Math.min(Math.max(newWidth, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH));
      }

      if (isResizingRight) {
        const newWidth = containerRect.right - e.clientX;
        setRightWidth(Math.min(Math.max(newWidth, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH));
      }
    },
    [isResizingLeft, isResizingRight]
  );

  // Handle mouse up to stop resizing
  const handleMouseUp = useCallback(() => {
    setIsResizingLeft(false);
    setIsResizingRight(false);
  }, []);

  // Add/remove event listeners for resizing
  useEffect(() => {
    if (isResizingLeft || isResizingRight) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingLeft, isResizingRight, handleMouseMove, handleMouseUp]);

  return (
    <div ref={containerRef} className="h-screen flex bg-canvas overflow-hidden">
      {/* Left Sidebar */}
      <aside
        className={clsx(
          'flex-shrink-0',
          'bg-surface border-r border-border',
          'flex flex-col relative'
        )}
        style={{ width: leftWidth }}
      >
        <LeftSidebar />

        {/* Left resize handle */}
        <div
          onMouseDown={() => setIsResizingLeft(true)}
          className={clsx(
            'absolute top-0 right-0 w-1 h-full cursor-col-resize z-10',
            'hover:bg-brass/50 active:bg-brass',
            'transition-colors',
            isResizingLeft && 'bg-brass'
          )}
        />
      </aside>

      {/* Main Stage */}
      <main className="flex-1 min-w-0 flex flex-col">
        <MainStage />
      </main>

      {/* Right Panel */}
      <aside
        className={clsx(
          'flex-shrink-0',
          'bg-surface border-l border-border',
          'flex flex-col relative'
        )}
        style={{ width: rightWidth }}
      >
        {/* Right resize handle */}
        <div
          onMouseDown={() => setIsResizingRight(true)}
          className={clsx(
            'absolute top-0 left-0 w-1 h-full cursor-col-resize z-10',
            'hover:bg-brass/50 active:bg-brass',
            'transition-colors',
            isResizingRight && 'bg-brass'
          )}
        />

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
