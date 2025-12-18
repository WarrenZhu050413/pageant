import { useState } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { Loader2, ImageIcon, Trash2, CheckSquare, Square, X, FileEdit, Hexagon } from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';
import { Button, ConfirmDialog } from '../ui';

export function PromptsTab() {
  const prompts = useStore((s) => s.prompts);
  const pendingPrompts = useStore((s) => s.pendingPrompts);
  const draftPrompts = useStore((s) => s.draftPrompts);
  const generatingImageDraftIds = useStore((s) => s.generatingImageDraftIds);
  const pendingCount = pendingPrompts.size;
  const currentPromptId = useStore((s) => s.currentPromptId);
  const currentDraftId = useStore((s) => s.currentDraftId);
  const setCurrentPrompt = useStore((s) => s.setCurrentPrompt);
  const setCurrentDraft = useStore((s) => s.setCurrentDraft);
  const selectedPromptIds = useStore((s) => s.selectedPromptIds);
  const togglePromptSelection = useStore((s) => s.togglePromptSelection);
  const selectAllPrompts = useStore((s) => s.selectAllPrompts);
  const clearPromptSelection = useStore((s) => s.clearPromptSelection);
  const batchDeletePrompts = useStore((s) => s.batchDeletePrompts);
  const deleteDraft = useStore((s) => s.deleteDraft);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Combine drafts, pending, and actual prompts
  type PromptItem = {
    id: string;
    title: string;
    count: number;
    itemType: 'draft' | 'pending' | 'prompt' | 'concept';
    created_at: string;
    prompt?: string;
    thumbnail?: string;
    variationCount?: number;
    isGenerating?: boolean; // Per-draft generating variations state
    isGeneratingImages?: boolean; // Per-draft generating images state
    // Concept-specific fields
    conceptAxis?: string;
    sourceImageId?: string;
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
    ...Array.from(pendingPrompts.entries()).map(([id, data]) => ({
      id,
      title: data.title || 'Generating...',
      count: data.count,
      itemType: 'pending' as const,
      created_at: new Date().toISOString(),
    })),
    // Sort actual prompts by created_at descending (newest first)
    // Separate concepts from regular prompts
    ...prompts
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((p) => ({
        id: p.id,
        title: p.title,
        prompt: p.prompt,
        count: p.images.length,
        itemType: p.is_concept ? ('concept' as const) : ('prompt' as const),
        created_at: p.created_at,
        thumbnail: p.images[0]?.image_path,
        conceptAxis: p.concept_axis,
        sourceImageId: p.source_image_id,
      })),
  ];

  const selectableItems = allItems.filter((item) => item.itemType === 'prompt' || item.itemType === 'concept' || item.itemType === 'draft');
  const allSelected = selectableItems.length > 0 && selectedPromptIds.size === selectableItems.length;

  const handleToggleSelectionMode = () => {
    if (isSelectionMode) {
      clearPromptSelection();
    }
    setIsSelectionMode(!isSelectionMode);
  };

  const handleDeleteSelected = async () => {
    const selectedIds = Array.from(selectedPromptIds);

    // Separate drafts from prompts/concepts
    const draftIds = selectedIds.filter(id =>
      allItems.find(item => item.id === id)?.itemType === 'draft'
    );
    const promptIds = selectedIds.filter(id => {
      const item = allItems.find(item => item.id === id);
      return item?.itemType === 'prompt' || item?.itemType === 'concept';
    });

    // Delete drafts (local state only)
    for (const draftId of draftIds) {
      deleteDraft(draftId);
    }

    // Delete prompts/concepts (API + refresh)
    if (promptIds.length > 0) {
      await batchDeletePrompts(promptIds);
    }

    setIsDeleteDialogOpen(false);
    setIsSelectionMode(false);
  };

  if (allItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <div className="w-12 h-12 rounded-full bg-canvas-muted flex items-center justify-center mb-3">
          <ImageIcon size={20} className="text-ink-muted" />
        </div>
        <p className="text-sm text-ink-secondary">No prompts yet</p>
        <p className="text-xs text-ink-muted mt-1">
          Generate your first images to get started
        </p>
      </div>
    );
  }

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
                onClick={() => (allSelected ? clearPromptSelection() : selectAllPrompts())}
              >
                {allSelected ? 'None' : 'All'}
              </Button>
              <span className="text-xs text-ink-muted">
                {selectedPromptIds.size} selected
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="danger"
                leftIcon={<Trash2 size={14} />}
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={selectedPromptIds.size === 0}
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
        {allItems.map((item, index) => {
          const isDraft = item.itemType === 'draft';
          const isPending = item.itemType === 'pending';
          const isPrompt = item.itemType === 'prompt';
          const isConcept = item.itemType === 'concept';
          const isActive = isDraft
            ? item.id === currentDraftId
            : item.id === currentPromptId;
          const isSelected = selectedPromptIds.has(item.id);
          const isSelectable = isPrompt || isConcept || isDraft;

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
                isDraft && (item.isGenerating || item.isGeneratingImages) && 'shimmer',
                isConcept && 'border border-purple-500/30',
                isActive && !isSelectionMode
                  ? isDraft
                    ? 'bg-brass/10 ring-1 ring-brass/40'
                    : isConcept
                    ? 'bg-purple-500/10 ring-1 ring-purple-500/40'
                    : 'bg-brass-muted ring-1 ring-brass/30'
                  : 'hover:bg-canvas-subtle',
                isSelected && 'bg-brass-muted/50'
              )}
            >
              {/* Checkbox (only in selection mode, for prompts and concepts) */}
              {isSelectionMode && isSelectable && (
                <button
                  onClick={() => togglePromptSelection(item.id)}
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
                    togglePromptSelection(item.id);
                  } else if (isDraft) {
                    setCurrentDraft(item.id);
                  } else if (isPrompt || isConcept) {
                    setCurrentDraft(null); // Clear any selected draft
                    setCurrentPrompt(item.id);
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
                      isDraft ? 'bg-brass/10 border border-dashed border-brass/30' :
                      isConcept ? 'bg-purple-500/10 border border-purple-500/30' : 'bg-canvas-muted',
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
                    ) : isConcept ? (
                      // Concept: show hexagon icon
                      <div className="w-full h-full flex items-center justify-center">
                        <Hexagon size={20} className="text-purple-500" />
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
                            : isConcept
                            ? 'bg-purple-500/15 text-purple-600'
                            : isPending
                            ? 'bg-generating/15 text-generating'
                            : 'bg-canvas-muted text-ink-tertiary'
                        )}
                      >
                        {isDraft ? 'Draft' : isConcept ? 'Concept' : item.count}
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
                        : isConcept
                        ? `${item.conceptAxis || 'design'} axis`
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
        message={`Are you sure you want to delete ${selectedPromptIds.size} prompt${selectedPromptIds.size !== 1 ? 's' : ''} and all their images? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
