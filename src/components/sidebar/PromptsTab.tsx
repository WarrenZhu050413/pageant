import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { Loader2, ImageIcon, Trash2, CheckSquare, Square, X, FileEdit, Sparkles } from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';
import { Button, ConfirmDialog } from '../ui';

export function PromptsTab() {
  const prompts = useStore((s) => s.generations);
  const pendingGenerations = useStore((s) => s.pendingGenerations);
  const draftPrompts = useStore((s) => s.draftPrompts);
  const generatingImageDraftIds = useStore((s) => s.generatingImageDraftIds);
  const pendingCount = pendingGenerations.size;
  const currentGenerationId = useStore((s) => s.currentGenerationId);
  const currentDraftId = useStore((s) => s.currentDraftId);
  const setCurrentGeneration = useStore((s) => s.setCurrentGeneration);
  const setCurrentDraft = useStore((s) => s.setCurrentDraft);
  const selectedGenerationIds = useStore((s) => s.selectedGenerationIds);
  const toggleGenerationSelection = useStore((s) => s.toggleGenerationSelection);
  const selectAllGenerations = useStore((s) => s.selectAllGenerations);
  const clearGenerationSelection = useStore((s) => s.clearGenerationSelection);
  const batchDeleteGenerations = useStore((s) => s.batchDeleteGenerations);
  const deleteDraft = useStore((s) => s.deleteDraft);
  const generationFilter = useStore((s) => s.generationFilter);
  const setGenerationFilter = useStore((s) => s.setGenerationFilter);
  const setCurrentCollection = useStore((s) => s.setCurrentCollection);
  const setViewMode = useStore((s) => s.setViewMode);
  const pendingConceptGenerations = useStore((s) => s.pendingConceptGenerations);
  const pendingConceptCount = pendingConceptGenerations.size;

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Count concept images for the pinned Design Library entry
  const conceptCount = useMemo(() => {
    return prompts
      .filter((p) => p.is_concept)
      .reduce((sum, p) => sum + p.images.length, 0);
  }, [prompts]);

  // Check if Design Library is currently active
  const isDesignLibraryActive = generationFilter === 'concepts' && !currentGenerationId && !currentDraftId;

  // Combine drafts, pending, and actual prompts
  type PromptItem = {
    id: string;
    title: string;
    count: number;
    itemType: 'draft' | 'pending' | 'prompt';
    created_at: string;
    prompt?: string;
    thumbnail?: string;
    variationCount?: number;
    isGenerating?: boolean; // Per-draft generating variations state
    isGeneratingImages?: boolean; // Per-draft generating images state
  };

  const allItems: PromptItem[] = [
    // Draft prompts always at very top
    ...draftPrompts.map((d) => ({
      id: d.id,
      title: d.title,
      count: d.variations.length,
      itemType: 'draft' as const,
      created_at: d.createdAt,
      prompt: d.basePrompt,
      variationCount: d.variations.length,
      isGenerating: d.isGenerating,
      isGeneratingImages: generatingImageDraftIds.has(d.id),
    })),
    // Pending prompts at top (below drafts)
    ...Array.from(pendingGenerations.entries()).map(([id, data]) => ({
      id,
      title: data.title || 'Generating...',
      count: data.count,
      itemType: 'pending' as const,
      created_at: new Date().toISOString(),
    })),
    // Sort actual generations by created_at descending (newest first)
    // Filter out concepts - they appear in the pinned Design Library entry
    ...prompts
      .filter((p: { is_concept?: boolean }) => !p.is_concept)
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((p) => ({
        id: p.id,
        title: p.title,
        prompt: p.prompt,
        count: p.images.length,
        itemType: 'prompt' as const,
        created_at: p.created_at,
        thumbnail: p.images[0]?.image_path,
      })),
  ];

  const selectableItems = allItems.filter((item) => item.itemType === 'prompt' || item.itemType === 'draft');
  const allSelected = selectableItems.length > 0 && selectedGenerationIds.size === selectableItems.length;

  const handleToggleSelectionMode = () => {
    if (isSelectionMode) {
      clearGenerationSelection();
    }
    setIsSelectionMode(!isSelectionMode);
  };

  const handleDeleteSelected = async () => {
    const selectedIds = Array.from(selectedGenerationIds);

    // Separate drafts from prompts
    const draftIds = selectedIds.filter(id =>
      allItems.find(item => item.id === id)?.itemType === 'draft'
    );
    const promptIds = selectedIds.filter(id =>
      allItems.find(item => item.id === id)?.itemType === 'prompt'
    );

    // Delete drafts (local state only)
    for (const draftId of draftIds) {
      deleteDraft(draftId);
    }

    // Delete prompts (API + refresh)
    if (promptIds.length > 0) {
      await batchDeleteGenerations(promptIds);
    }

    setIsDeleteDialogOpen(false);
    setIsSelectionMode(false);
  };

  // Show empty state only if no items AND no concept images
  const showEmptyState = allItems.length === 0 && conceptCount === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Selection mode header */}
      <div className="p-2 border-b border-border flex items-center justify-between">
        {/* Pending generations indicator */}
        {pendingCount > 0 && !isSelectionMode && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-generating/15 text-generating text-xs font-medium">
            <Loader2 size={12} className="animate-spin" />
            {pendingCount} generating
          </div>
        )}
        {isSelectionMode ? (
          <>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                leftIcon={allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                onClick={() => (allSelected ? clearGenerationSelection() : selectAllGenerations())}
              >
                {allSelected ? 'None' : 'All'}
              </Button>
              <span className="text-xs text-ink-muted">
                {selectedGenerationIds.size} selected
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="danger"
                leftIcon={<Trash2 size={14} />}
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={selectedGenerationIds.size === 0}
              >
                Delete
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleToggleSelectionMode}
              >
                <X size={14} />
              </Button>
            </div>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleToggleSelectionMode}
            className="ml-auto"
          >
            Select
          </Button>
        )}
      </div>

      {/* Prompts list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Pinned Design Library entry */}
        <button
          onClick={() => {
            setCurrentGeneration(null);
            setCurrentDraft(null);
            setCurrentCollection(null);
            setGenerationFilter('concepts');
            setViewMode('grid');
          }}
          className={clsx(
            'w-full flex items-center gap-3 p-2.5 rounded-lg',
            'transition-all duration-150',
            isDesignLibraryActive
              ? 'bg-brass-muted ring-1 ring-brass/30'
              : 'hover:bg-canvas-subtle'
          )}
        >
          <div
            className={clsx(
              'w-12 h-12 rounded-md flex-shrink-0 flex items-center justify-center',
              isDesignLibraryActive ? 'bg-brass/20' : 'bg-brass/10'
            )}
          >
            {pendingConceptCount > 0 ? (
              <Loader2 size={20} className="text-brass animate-spin" />
            ) : (
              <Sparkles size={20} className="text-brass" />
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center justify-between gap-2">
              <h3
                className={clsx(
                  'text-sm font-medium',
                  isDesignLibraryActive ? 'text-ink' : 'text-ink-secondary'
                )}
              >
                Design Library
              </h3>
              <div className="flex items-center gap-1.5">
                {pendingConceptCount > 0 && (
                  <span className="flex-shrink-0 text-[0.625rem] font-medium px-1.5 py-0.5 rounded bg-brass/30 text-brass animate-pulse">
                    +{pendingConceptCount}
                  </span>
                )}
                <span className="flex-shrink-0 text-[0.625rem] font-medium px-1.5 py-0.5 rounded bg-brass/15 text-brass">
                  {conceptCount}
                </span>
              </div>
            </div>
            <p className="text-[0.625rem] text-ink-muted mt-0.5">
              {pendingConceptCount > 0
                ? `Generating ${pendingConceptCount} concept${pendingConceptCount !== 1 ? 's' : ''}...`
                : 'Concept images from design tokens'}
            </p>
          </div>
        </button>

        {/* Empty state */}
        {showEmptyState && (
          <div className="flex flex-col items-center justify-center text-center p-6 mt-4">
            <div className="w-12 h-12 rounded-full bg-canvas-muted flex items-center justify-center mb-3">
              <ImageIcon size={20} className="text-ink-muted" />
            </div>
            <p className="text-sm text-ink-secondary">No prompts yet</p>
            <p className="text-xs text-ink-muted mt-1">
              Generate your first images to get started
            </p>
          </div>
        )}

        {/* Separator */}
        {allItems.length > 0 && (
          <div className="h-px bg-border my-2" />
        )}

        {allItems.map((item, index) => {
          const isDraft = item.itemType === 'draft';
          const isPending = item.itemType === 'pending';
          const isPrompt = item.itemType === 'prompt';
          const isActive = isDraft
            ? item.id === currentDraftId
            : item.id === currentGenerationId;
          const isSelected = selectedGenerationIds.has(item.id);
          const isSelectable = isPrompt || isDraft;

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
              className={clsx(
                'flex items-center gap-2 rounded-lg overflow-hidden',
                'transition-all duration-150',
                isPending && 'shimmer cursor-wait',
                isDraft && 'border border-dashed border-brass/40',
                isActive && !isSelectionMode
                  ? isDraft
                    ? 'bg-brass/10 ring-1 ring-brass/40'
                    : 'bg-brass-muted ring-1 ring-brass/30'
                  : 'hover:bg-canvas-subtle',
                isSelected && 'bg-brass-muted/50'
              )}
            >
              {/* Checkbox (only in selection mode, for prompts and drafts) */}
              {isSelectionMode && isSelectable && (
                <button
                  onClick={() => toggleGenerationSelection(item.id)}
                  className="pl-2 py-2.5"
                >
                  <div
                    className={clsx(
                      'w-5 h-5 rounded border-2 flex items-center justify-center',
                      'transition-all',
                      isSelected
                        ? 'bg-brass border-brass text-surface'
                        : 'border-ink-muted'
                    )}
                  >
                    {isSelected && (
                      <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </button>
              )}

              {/* Main content button */}
              <button
                onClick={() => {
                  if (isSelectionMode && isSelectable) {
                    toggleGenerationSelection(item.id);
                  } else if (isDraft) {
                    setCurrentDraft(item.id);
                  } else if (isPrompt) {
                    setCurrentDraft(null); // Clear any selected draft
                    setGenerationFilter('all'); // Clear concepts filter when selecting a prompt
                    setCurrentGeneration(item.id);
                  }
                }}
                disabled={isPending}
                className="flex-1 text-left"
              >
                <div className="flex gap-3 p-2.5 pl-0">
                  {/* Thumbnail */}
                  <div
                    className={clsx(
                      'w-12 h-12 rounded-md flex-shrink-0 overflow-hidden',
                      isDraft ? 'bg-brass/10 border border-dashed border-brass/30' : 'bg-canvas-muted',
                      !isSelectionMode && 'ml-2.5'
                    )}
                  >
                    {isDraft ? (
                      // Draft: show edit icon or loading spinner
                      <div className="w-full h-full flex items-center justify-center">
                        {(item.isGenerating || item.isGeneratingImages) ? (
                          <Loader2 size={16} className="text-brass animate-spin" />
                        ) : (
                          <FileEdit size={16} className="text-brass" />
                        )}
                      </div>
                    ) : isPending ? (
                      // Show grid of placeholder slots for each image being generated
                      <div className="w-full h-full grid grid-cols-2 gap-px">
                        {Array.from({ length: Math.min(item.count, 4) }).map((_, i) => (
                          <div
                            key={i}
                            className="bg-generating/10 flex items-center justify-center"
                          >
                            <Loader2 size={8} className="text-generating animate-spin" />
                          </div>
                        ))}
                      </div>
                    ) : item.thumbnail ? (
                      <img
                        src={getImageUrl(item.thumbnail)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon size={16} className="text-ink-muted" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        className={clsx(
                          'text-sm font-medium truncate',
                          isActive ? 'text-ink' : 'text-ink-secondary'
                        )}
                      >
                        {item.title}
                      </h3>
                      <span
                        className={clsx(
                          'flex-shrink-0 text-[0.625rem] font-medium px-1.5 py-0.5 rounded',
                          isDraft
                            ? 'bg-brass/15 text-brass'
                            : isPending
                            ? 'bg-generating/15 text-generating'
                            : 'bg-canvas-muted text-ink-tertiary'
                        )}
                      >
                        {isDraft ? 'Draft' : item.count}
                      </span>
                    </div>

                    {item.prompt && (
                      <p className="text-xs text-ink-muted truncate mt-0.5 font-[family-name:var(--font-mono)]">
                        {item.prompt.slice(0, 50)}{item.prompt.length > 50 ? '...' : ''}
                      </p>
                    )}

                    <p className="text-[0.625rem] text-ink-muted mt-1">
                      {isDraft
                        ? item.isGeneratingImages
                          ? 'Generating images...'
                          : item.isGenerating
                          ? 'Creating variations...'
                          : `${item.variationCount} variation${item.variationCount !== 1 ? 's' : ''}`
                        : isPending
                        ? 'Generating...'
                        : new Date(item.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                    </p>
                  </div>
                </div>
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteSelected}
        title="Delete Prompts"
        message={`Are you sure you want to delete ${selectedGenerationIds.size} prompt${selectedGenerationIds.size !== 1 ? 's' : ''} and all their images? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
