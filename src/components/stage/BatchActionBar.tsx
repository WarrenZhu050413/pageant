import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { CheckSquare, Square, Star, Trash2 } from 'lucide-react';
import { useStore } from '../../store';
import { Button, ConfirmDialog } from '../ui';

export function BatchActionBar() {
  const selectedIds = useStore((s) => s.selectedIds);
  const selectAll = useStore((s) => s.selectAll);
  const clearSelection = useStore((s) => s.clearSelection);
  const batchFavorite = useStore((s) => s.batchFavorite);
  const batchDelete = useStore((s) => s.batchDelete);
  const currentPrompt = useStore((s) => s.getCurrentPrompt());
  const favorites = useStore((s) => s.favorites);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const allSelected =
    currentPrompt && selectedIds.size === currentPrompt.images.length;

  // Check if any selected images are not favorited
  const hasUnfavorited = useMemo(() => {
    return Array.from(selectedIds).some((id) => !favorites.includes(id));
  }, [selectedIds, favorites]);

  // If any are unfavorited, button says "Favorite". Otherwise, "Unfavorite".
  const toggleFavoriteLabel = hasUnfavorited ? 'Favorite' : 'Unfavorite';
  const toggleFavoriteAction = hasUnfavorited;

  return (
    <>
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -50, opacity: 0 }}
        className={clsx(
          'absolute top-0 left-0 right-0',
          'bg-surface border-b border-border',
          'px-4 py-3',
          'flex items-center justify-between'
        )}
      >
        <div className="flex items-center gap-4">
          {/* Select all / Clear */}
          <Button
            variant="ghost"
            size="sm"
            leftIcon={allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
            onClick={() => (allSelected ? clearSelection() : selectAll())}
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </Button>

          <div className="w-px h-5 bg-border" />

          {/* Selection count */}
          <span className="text-sm text-ink-secondary">
            {selectedIds.size} selected
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle Favorite */}
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Star size={14} fill={hasUnfavorited ? 'none' : 'currentColor'} />}
            onClick={() => batchFavorite(toggleFavoriteAction)}
            disabled={selectedIds.size === 0}
          >
            {toggleFavoriteLabel}
          </Button>

          <div className="w-px h-5 bg-border" />

          {/* Delete */}
          <Button
            variant="danger"
            size="sm"
            leftIcon={<Trash2 size={14} />}
            onClick={() => setIsDeleteDialogOpen(true)}
            disabled={selectedIds.size === 0}
          >
            Delete
          </Button>
        </div>
      </motion.div>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={batchDelete}
        title="Delete Images"
        message={`Are you sure you want to delete ${selectedIds.size} image${selectedIds.size !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}
