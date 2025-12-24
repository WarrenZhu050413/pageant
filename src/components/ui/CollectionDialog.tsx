import { useState, useMemo, useEffect } from 'react';
import { clsx } from 'clsx';
import { Plus, Check } from 'lucide-react';
import { useStore } from '../../store';
import { Dialog } from './Dialog';
import { Button } from './Button';
import { Input, Textarea } from './Input';

interface CollectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  imageIds: string[];
  /** Called after successfully adding to collections */
  onSuccess?: () => void;
}

/**
 * Shared dialog for adding images to collections.
 * Supports multi-selection with ⌘+click and creating new collections.
 */
export function CollectionDialog({
  isOpen,
  onClose,
  imageIds,
  onSuccess,
}: CollectionDialogProps) {
  const collections = useStore((s) => s.collections);
  const createCollection = useStore((s) => s.createCollection);
  const addImagesToCollection = useStore((s) => s.addImagesToCollection);

  const [selectedCollectionIds, setSelectedCollectionIds] = useState<Set<string>>(new Set());
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [collectionDescription, setCollectionDescription] = useState('');
  const [focusedCollectionIndex, setFocusedCollectionIndex] = useState(0);

  // Sorted collections for consistent keyboard navigation
  const sortedCollections = useMemo(
    () => [...collections].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ),
    [collections]
  );

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedCollectionIds(new Set());
      setIsCreatingNew(collections.length === 0);
      setCollectionName('');
      setCollectionDescription('');
      setFocusedCollectionIndex(0);
    }
  }, [isOpen, collections.length]);

  const handleClose = () => {
    onClose();
  };

  const handleCollectionClick = (collectionId: string, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      // Command/Ctrl click: toggle selection (multi-select)
      setSelectedCollectionIds((prev) => {
        const next = new Set(prev);
        if (next.has(collectionId)) {
          next.delete(collectionId);
        } else {
          next.add(collectionId);
        }
        return next;
      });
    } else {
      // Regular click: single select (replace selection)
      setSelectedCollectionIds(new Set([collectionId]));
    }
  };

  const handleSave = async () => {
    if (isCreatingNew) {
      if (collectionName.trim()) {
        await createCollection(collectionName.trim(), collectionDescription.trim() || undefined, imageIds);
        setCollectionName('');
        setCollectionDescription('');
        setIsCreatingNew(false);
        handleClose();
        onSuccess?.();
      }
    } else if (selectedCollectionIds.size > 0) {
      // Add to all selected collections
      for (const collectionId of selectedCollectionIds) {
        await addImagesToCollection(collectionId, imageIds);
      }
      setSelectedCollectionIds(new Set());
      handleClose();
      onSuccess?.();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isCreatingNew) return; // Let input handle its own keys

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedCollectionIndex((prev) =>
        Math.min(prev + 1, sortedCollections.length - 1)
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedCollectionIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === ' ' || (e.key === 'Enter' && sortedCollections.length > 0)) {
      e.preventDefault();
      const focusedCollection = sortedCollections[focusedCollectionIndex];
      if (focusedCollection) {
        if (e.metaKey || e.ctrlKey || e.key === ' ') {
          // Cmd/Ctrl+Enter or Space: toggle (multi-select)
          setSelectedCollectionIds((prev) => {
            const next = new Set(prev);
            if (next.has(focusedCollection.id)) {
              next.delete(focusedCollection.id);
            } else {
              next.add(focusedCollection.id);
            }
            return next;
          });
        } else {
          // Plain Enter: select and save
          if (selectedCollectionIds.size > 0) {
            handleSave();
          } else {
            setSelectedCollectionIds(new Set([focusedCollection.id]));
            // Small delay then save
            setTimeout(() => handleSave(), 50);
          }
        }
      }
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Save to Collection"
    >
      <div
        className="space-y-4"
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {/* Existing collections */}
        {!isCreatingNew && collections.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-ink-secondary">
              Add to existing collection
              <span className="ml-2 text-ink-muted font-normal">
                (⌘+click for multiple)
              </span>
            </label>
            <div className="max-h-[50vh] overflow-y-auto space-y-1">
              {sortedCollections.map((collection, index) => {
                const isSelected = selectedCollectionIds.has(collection.id);
                const isFocused = index === focusedCollectionIndex;
                return (
                  <button
                    key={collection.id}
                    onClick={(e) => handleCollectionClick(collection.id, e)}
                    onMouseEnter={() => setFocusedCollectionIndex(index)}
                    className={clsx(
                      'w-full flex items-center justify-between px-3 py-2 rounded-lg text-left',
                      'transition-colors',
                      isSelected
                        ? 'bg-brass-muted text-ink'
                        : isFocused
                        ? 'bg-canvas-muted text-ink-secondary'
                        : 'hover:bg-canvas-muted text-ink-secondary',
                      isFocused && !isSelected && 'ring-1 ring-brass/50'
                    )}
                  >
                    <div>
                      <p className="text-sm font-medium">{collection.name}</p>
                      <p className="text-xs text-ink-muted">
                        {collection.image_ids?.length || 0} images
                      </p>
                    </div>
                    {isSelected && (
                      <Check size={16} className="text-brass-dark" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-ink-muted">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Create new button */}
            <button
              onClick={() => setIsCreatingNew(true)}
              className={clsx(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg',
                'text-sm text-ink-secondary hover:bg-canvas-muted',
                'transition-colors'
              )}
            >
              <Plus size={14} />
              Create new collection
            </button>
          </div>
        )}

        {/* Create new collection form */}
        {isCreatingNew && (
          <div className="space-y-3">
            {collections.length > 0 && (
              <button
                onClick={() => setIsCreatingNew(false)}
                className="text-xs text-ink-muted hover:text-ink-secondary"
              >
                ← Back to existing collections
              </button>
            )}
            <Input
              label="Collection Name"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              placeholder="My Collection"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && collectionName.trim()) {
                  handleSave();
                }
              }}
            />
            <Textarea
              label="Description (optional)"
              value={collectionDescription}
              onChange={(e) => setCollectionDescription(e.target.value)}
              placeholder="What's this collection about?"
              rows={2}
              className="min-h-[60px]"
            />
          </div>
        )}

        <div className="text-xs text-ink-muted">
          {imageIds.length} image{imageIds.length !== 1 ? 's' : ''} will be added
          {selectedCollectionIds.size > 0 && !isCreatingNew && (
            <span>
              {' '}to {selectedCollectionIds.size} collection{selectedCollectionIds.size !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="ghost"
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button
            variant="brass"
            onClick={handleSave}
            disabled={isCreatingNew ? !collectionName.trim() : selectedCollectionIds.size === 0}
          >
            {isCreatingNew
              ? 'Create & Add'
              : selectedCollectionIds.size > 1
              ? `Add to ${selectedCollectionIds.size} Collections`
              : 'Add to Collection'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
