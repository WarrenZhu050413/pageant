import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Grid,
  Maximize2,
  Columns,
  CheckSquare,
  Square,
  Loader2,
} from 'lucide-react';
import { useStore } from '../../store';
import { IconButton, Button } from '../ui';
import { SingleView } from './SingleView';
import { GridView } from './GridView';
import { CompareView } from './CompareView';
import { SelectionTray } from './SelectionTray';
import { BatchActionBar } from './BatchActionBar';

export function MainStage() {
  const currentPrompt = useStore((s) => s.getCurrentPrompt());
  const currentImageIndex = useStore((s) => s.currentImageIndex);
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const selectionMode = useStore((s) => s.selectionMode);
  const setSelectionMode = useStore((s) => s.setSelectionMode);
  const pendingPrompts = useStore((s) => s.pendingPrompts);

  const hasPending = pendingPrompts.size > 0;

  return (
    <div className="flex flex-col h-full bg-canvas">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
        <div className="flex items-center gap-3 min-w-0">
          {/* Title */}
          <div className="min-w-0">
            {currentPrompt ? (
              <>
                <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-ink truncate">
                  {currentPrompt.title}
                </h2>
                <p className="text-xs text-ink-muted">
                  {currentImageIndex + 1} of {currentPrompt.images.length} images
                </p>
              </>
            ) : hasPending ? (
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="text-generating animate-spin" />
                <span className="text-sm text-ink-secondary">Generating...</span>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">No prompt selected</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggles */}
          <div className="flex items-center gap-1 p-1 bg-canvas-subtle rounded-lg">
            <IconButton
              size="sm"
              variant={viewMode === 'single' ? 'default' : 'ghost'}
              tooltip="Single view (1)"
              onClick={() => setViewMode('single')}
              className={clsx(viewMode === 'single' && 'bg-surface shadow-sm')}
            >
              <Maximize2 size={16} />
            </IconButton>
            <IconButton
              size="sm"
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              tooltip="Grid view (2)"
              onClick={() => setViewMode('grid')}
              className={clsx(viewMode === 'grid' && 'bg-surface shadow-sm')}
            >
              <Grid size={16} />
            </IconButton>
            <IconButton
              size="sm"
              variant={viewMode === 'compare' ? 'default' : 'ghost'}
              tooltip="Compare view (3)"
              onClick={() => setViewMode('compare')}
              className={clsx(viewMode === 'compare' && 'bg-surface shadow-sm')}
            >
              <Columns size={16} />
            </IconButton>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-border" />

          {/* Selection mode toggles */}
          <Button
            size="sm"
            variant={selectionMode === 'select' ? 'brass' : 'secondary'}
            leftIcon={<Square size={14} />}
            onClick={() =>
              setSelectionMode(selectionMode === 'select' ? 'none' : 'select')
            }
          >
            Select (S)
          </Button>
          <Button
            size="sm"
            variant={selectionMode === 'batch' ? 'brass' : 'secondary'}
            leftIcon={<CheckSquare size={14} />}
            onClick={() =>
              setSelectionMode(selectionMode === 'batch' ? 'none' : 'batch')
            }
          >
            Batch (B)
          </Button>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={viewMode}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0"
          >
            {viewMode === 'single' && <SingleView />}
            {viewMode === 'grid' && <GridView />}
            {viewMode === 'compare' && <CompareView />}
          </motion.div>
        </AnimatePresence>

        {/* Selection tray (when in select mode) */}
        {selectionMode === 'select' && <SelectionTray />}

        {/* Batch action bar (when in batch mode) */}
        {selectionMode === 'batch' && <BatchActionBar />}
      </div>
    </div>
  );
}
