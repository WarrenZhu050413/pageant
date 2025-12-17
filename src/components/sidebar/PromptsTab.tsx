import { useState } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { Loader2, ImageIcon, Trash2, CheckSquare, Square, X } from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';
import { Button, ConfirmDialog } from '../ui';

export function PromptsTab() {
  const prompts = useStore((s) => s.prompts);
  const pendingPrompts = useStore((s) => s.pendingPrompts);
  const currentPromptId = useStore((s) => s.currentPromptId);
  const setCurrentPrompt = useStore((s) => s.setCurrentPrompt);
  const selectedPromptIds = useStore((s) => s.selectedPromptIds);
  const togglePromptSelection = useStore((s) => s.togglePromptSelection);
  const selectAllPrompts = useStore((s) => s.selectAllPrompts);
  const clearPromptSelection = useStore((s) => s.clearPromptSelection);
  const batchDeletePrompts = useStore((s) => s.batchDeletePrompts);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Combine pending and actual prompts
  type PromptItem = {
    id: string;
    title: string;
    count: number;
    isPending: boolean;
    created_at: string;
    prompt?: string;
    category?: string;
    thumbnail?: string;
  };

  const allItems: PromptItem[] = [
    // Pending prompts always at top
    ...Array.from(pendingPrompts.entries()).map(([id, data]) => ({
      id,
      title: data.title,
      count: data.count,
      isPending: true as const,
      created_at: new Date().toISOString(),
    })),
    // Sort actual prompts by created_at descending (newest first)
    ...prompts
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((p) => ({
        id: p.id,
        title: p.title,
        prompt: p.prompt,
        category: p.category,
        count: p.images.length,
        isPending: false as const,
        created_at: p.created_at,
        thumbnail: p.images[0]?.image_path,
      })),
  ];

  const selectableItems = allItems.filter((item) => !item.isPending);
  const allSelected = selectableItems.length > 0 && selectedPromptIds.size === selectableItems.length;

  const handleToggleSelectionMode = () => {
    if (isSelectionMode) {
      clearPromptSelection();
    }
    setIsSelectionMode(!isSelectionMode);
  };

  const handleDeleteSelected = async () => {
    await batchDeletePrompts(Array.from(selectedPromptIds));
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
          const isActive = item.id === currentPromptId;
          const isSelected = selectedPromptIds.has(item.id);

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
              className={clsx(
                'flex items-center gap-2 rounded-lg overflow-hidden',
                'transition-all duration-150',
                item.isPending && 'shimmer cursor-wait',
                isActive && !isSelectionMode
                  ? 'bg-brass-muted ring-1 ring-brass/30'
                  : 'hover:bg-canvas-subtle',
                isSelected && 'bg-brass-muted/50'
              )}
            >
              {/* Checkbox (only in selection mode) */}
              {isSelectionMode && !item.isPending && (
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
                  if (isSelectionMode && !item.isPending) {
                    togglePromptSelection(item.id);
                  } else if (!item.isPending) {
                    setCurrentPrompt(item.id);
                  }
                }}
                disabled={item.isPending}
                className="flex-1 text-left"
              >
                <div className="flex gap-3 p-2.5 pl-0">
                  {/* Thumbnail */}
                  <div
                    className={clsx(
                      'w-12 h-12 rounded-md flex-shrink-0 overflow-hidden',
                      'bg-canvas-muted',
                      !isSelectionMode && 'ml-2.5'
                    )}
                  >
                    {item.isPending ? (
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
                          item.isPending
                            ? 'bg-generating/15 text-generating'
                            : 'bg-canvas-muted text-ink-tertiary'
                        )}
                      >
                        {item.count}
                      </span>
                    </div>

                    {item.prompt && (
                      <p className="text-xs text-ink-muted truncate mt-0.5 font-[family-name:var(--font-mono)]">
                        {item.prompt.slice(0, 50)}...
                      </p>
                    )}

                    <p className="text-[0.625rem] text-ink-muted mt-1">
                      {item.isPending
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
