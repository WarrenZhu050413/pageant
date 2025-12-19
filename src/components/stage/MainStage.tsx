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
import { TokenGalleryView } from './TokenGalleryView';

export function MainStage() {
  // Select primitive values and stable arrays to avoid infinite re-renders
  const prompts = useStore((s) => s.prompts);
  const collections = useStore((s) => s.collections);
  const draftPrompts = useStore((s) => s.draftPrompts);
  const currentPromptId = useStore((s) => s.currentPromptId);
  const currentDraftId = useStore((s) => s.currentDraftId);
  const currentCollectionId = useStore((s) => s.currentCollectionId);
  const currentImageIndex = useStore((s) => s.currentImageIndex);
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const selectionMode = useStore((s) => s.selectionMode);
  const setSelectionMode = useStore((s) => s.setSelectionMode);
  const pendingPrompts = useStore((s) => s.pendingPrompts);
  const isGeneratingVariations = useStore((s) => s.isGeneratingVariations);

  // Compute derived values with useMemo to avoid infinite re-renders
  const currentPrompt = useMemo(
    () => prompts.find((p) => p.id === currentPromptId) || null,
    [prompts, currentPromptId]
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
    const imageMap = new Map<string, typeof prompts[0]['images'][0]>();
    for (const prompt of prompts) {
      for (const image of prompt.images) {
        imageMap.set(image.id, image);
      }
    }
    return currentCollection.image_ids
      .map((id) => imageMap.get(id))
      .filter((img): img is typeof prompts[0]['images'][0] => img !== undefined);
  }, [prompts, currentCollection]);

  const hasPending = pendingPrompts.size > 0;

  // State for viewing variations of generated prompt
  const [showingVariations, setShowingVariations] = useState(false);

  // Draft takes over full stage when present
  if (currentDraft) {
    return <DraftVariationsView draft={currentDraft} />;
  }

  // Token gallery takes over full stage when in that mode
  if (viewMode === 'token-gallery') {
    return <TokenGalleryView />;
  }

  // Show read-only variations view when toggled
  if (showingVariations && currentPrompt) {
    return (
      <PromptVariationsView
        prompt={currentPrompt}
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
            {currentPrompt ? (
              <>
                <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-ink truncate">
                  {currentPrompt.title}
                </h2>
                {/* Show variation title as subtitle when available */}
                {currentPrompt.images[currentImageIndex]?.variation_title && (
                  <p className="text-sm text-ink-secondary truncate">
                    {currentPrompt.images[currentImageIndex].variation_title}
                  </p>
                )}
                {currentPrompt.basePrompt && (
                  <p className="text-xs text-ink-tertiary mt-0.5" title={currentPrompt.basePrompt}>
                    <span className="text-ink-muted">Based on:</span> "{currentPrompt.basePrompt.slice(0, 50)}{currentPrompt.basePrompt.length > 50 ? '...' : ''}"
                  </p>
                )}
                <p className="text-xs text-ink-muted">
                  {currentImageIndex + 1} of {currentPrompt.images.length} images
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
          {currentPrompt && currentPrompt.images.some(img => img.varied_prompt) && (
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
