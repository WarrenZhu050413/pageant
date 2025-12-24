import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Grid,
  Maximize2,
  Square,
  Loader2,
  FileEdit,
  FolderOpen,
  FileText,
} from 'lucide-react';
import { useStore } from '../../store';
import { IconButton, Button } from '../ui';
import { SingleView } from './SingleView';
import { GridView } from './GridView';
import { SelectionTray } from './SelectionTray';
import { DraftVariationsView } from './DraftVariationsView';
import { PromptVariationsView } from './PromptVariationsView';

export function MainStage() {
  // Select primitive values and stable arrays to avoid infinite re-renders
  const generations = useStore((s) => s.generations);
  const collections = useStore((s) => s.collections);
  const draftPrompts = useStore((s) => s.draftPrompts);
  const currentGenerationId = useStore((s) => s.currentGenerationId);
  const currentDraftId = useStore((s) => s.currentDraftId);
  const currentCollectionId = useStore((s) => s.currentCollectionId);
  const currentImageIndex = useStore((s) => s.currentImageIndex);
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const selectionMode = useStore((s) => s.selectionMode);
  const setSelectionMode = useStore((s) => s.setSelectionMode);
  const pendingGenerations = useStore((s) => s.pendingGenerations);
  const currentPendingId = useStore((s) => s.currentPendingId);
  const isGeneratingVariations = useStore((s) => s.isGeneratingVariations);

  // Compute derived values with useMemo to avoid infinite re-renders
  const currentGeneration = useMemo(
    () => generations.find((g) => g.id === currentGenerationId) || null,
    [generations, currentGenerationId]
  );

  const currentDraft = useMemo(
    () => draftPrompts.find((d) => d.id === currentDraftId) || null,
    [draftPrompts, currentDraftId]
  );

  const currentCollection = useMemo(
    () => collections.find((c) => c.id === currentCollectionId) || null,
    [collections, currentCollectionId]
  );

  const currentCollectionImages = useMemo(() => {
    if (!currentCollection) return [];
    // Build image map from all generations (including hidden ones)
    const imageMap = new Map<string, typeof generations[0]['images'][0]>();
    for (const generation of generations) {
      for (const image of generation.images) {
        imageMap.set(image.id, image);
      }
    }
    return currentCollection.image_ids
      .map((id) => imageMap.get(id))
      .filter((img): img is typeof generations[0]['images'][0] => img !== undefined);
  }, [generations, currentCollection]);

  const hasPending = pendingGenerations.size > 0;

  // Get current pending generation data
  const currentPending = useMemo(
    () => currentPendingId ? pendingGenerations.get(currentPendingId) || null : null,
    [pendingGenerations, currentPendingId]
  );

  // State for viewing variations of generated prompt
  const [showingVariations, setShowingVariations] = useState(false);

  // Draft takes over full stage when present
  if (currentDraft) {
    return <DraftVariationsView draft={currentDraft} />;
  }

  // Pending generation view
  if (currentPending) {
    return (
      <div className="flex flex-col h-full bg-canvas">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0 flex-1">
              <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-ink truncate">
                {currentPending.title || 'Generating...'}
              </h2>
              <p className="text-xs text-ink-muted">
                {currentPending.count} images generating
              </p>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Status indicator */}
            <div className="flex items-center gap-3 p-4 rounded-lg bg-generating/10 border border-generating/20">
              <Loader2 size={20} className="text-generating animate-spin" />
              <div>
                <p className="text-sm font-medium text-ink">Generating {currentPending.count} images...</p>
                <p className="text-xs text-ink-muted">All images will use the same prompt</p>
              </div>
            </div>

            {/* Prompt display */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-ink-secondary uppercase tracking-wide">Prompt</h3>
              <div className="p-4 rounded-lg bg-canvas-subtle border border-border">
                <p className="text-sm text-ink whitespace-pre-line break-words">
                  {currentPending.prompt}
                </p>
              </div>
            </div>

            {/* Image slots preview */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-ink-secondary uppercase tracking-wide">Images</h3>
              <div className="grid grid-cols-4 gap-3">
                {Array.from({ length: currentPending.count }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-lg bg-canvas-muted border border-border flex items-center justify-center shimmer"
                  >
                    <Loader2 size={24} className="text-ink-muted animate-spin" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show read-only variations view when toggled
  if (showingVariations && currentGeneration) {
    return (
      <PromptVariationsView
        prompt={currentGeneration}
        onBack={() => setShowingVariations(false)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-canvas">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
        <div className="flex items-center gap-3 min-w-0">
          {/* Title */}
          <div className="min-w-0 flex-1">
            {currentGeneration ? (
              <>
                <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-ink truncate">
                  {currentGeneration.title}
                </h2>
                {/* Show variation title as subtitle when available */}
                {currentGeneration.images[currentImageIndex]?.variation_title && (
                  <p className="text-sm text-ink-secondary truncate">
                    {currentGeneration.images[currentImageIndex].variation_title}
                  </p>
                )}
                {currentGeneration.basePrompt && (
                  <p className="text-xs text-ink-tertiary mt-0.5" title={currentGeneration.basePrompt}>
                    <span className="text-ink-muted">Based on:</span> "{currentGeneration.basePrompt.slice(0, 50)}{currentGeneration.basePrompt.length > 50 ? '...' : ''}"
                  </p>
                )}
                <p className="text-xs text-ink-muted">
                  {currentImageIndex + 1} of {currentGeneration.images.length} images
                </p>
              </>
            ) : currentCollection ? (
              <>
                <div className="flex items-center gap-2">
                  <FolderOpen size={16} className="text-brass" />
                  <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-ink truncate">
                    {currentCollection.name}
                  </h2>
                </div>
                {currentCollection.description && (
                  <p className="text-xs text-ink-tertiary truncate mt-0.5 max-w-md">
                    {currentCollection.description}
                  </p>
                )}
                <p className="text-xs text-ink-muted">
                  {currentCollectionImages.length > 0
                    ? `${currentImageIndex + 1} of ${currentCollectionImages.length} images`
                    : 'Empty collection'}
                </p>
              </>
            ) : isGeneratingVariations ? (
              <div className="flex items-center gap-2">
                <FileEdit size={16} className="text-brass" />
                <span className="text-sm text-ink-secondary">Creating variations...</span>
              </div>
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
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-border" />

          {/* Variations button - only show when viewing a prompt */}
          {currentGeneration && currentGeneration.images.some(img => img.varied_prompt) && (
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<FileText size={14} />}
              onClick={() => setShowingVariations(true)}
            >
              Variations
            </Button>
          )}

          {/* Selection mode toggle */}
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
          </motion.div>
        </AnimatePresence>

        {/* Selection tray (when in select mode) */}
        {selectionMode === 'select' && <SelectionTray />}
      </div>
    </div>
  );
}
