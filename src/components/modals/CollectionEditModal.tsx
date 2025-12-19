import { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { FolderOpen, Star, Trash2 } from 'lucide-react';
import { useStore } from '../../store';
import { Button, Input, Textarea, Dialog } from '../ui';
import type { Collection } from '../../types';

const FAVORITES_COLLECTION_NAME = '⭐ Favorites';

interface CollectionEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** If provided, we're editing. Otherwise, creating. */
  collection?: Collection | null;
  /** For create mode: images to add to the new collection */
  imageIds?: string[];
  /** Callback after successful save */
  onSaved?: () => void;
}

export function CollectionEditModal({
  isOpen,
  onClose,
  collection,
  imageIds = [],
  onSaved,
}: CollectionEditModalProps) {
  const createCollection = useStore((s) => s.createCollection);
  const updateCollection = useStore((s) => s.updateCollection);
  const deleteCollection = useStore((s) => s.deleteCollection);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isEditing = !!collection;
  const isFavorites = collection?.name === FAVORITES_COLLECTION_NAME;

  // Initialize form when modal opens or collection changes
  useEffect(() => {
    if (isOpen) {
      if (collection) {
        setName(collection.name);
        setDescription(collection.description || '');
      } else {
        setName('');
        setDescription('');
      }
      setShowDeleteConfirm(false);
    }
  }, [isOpen, collection]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      if (isEditing && collection) {
        // Update existing collection
        await updateCollection(collection.id, {
          name: name.trim(),
          description: description.trim() || undefined,
        });
      } else {
        // Create new collection with images
        await createCollection(name.trim(), description.trim() || undefined, imageIds);
      }
      onSaved?.();
      onClose();
    } finally {
      setIsSaving(false);
    }
  }, [name, description, isEditing, collection, imageIds, updateCollection, createCollection, onSaved, onClose]);

  const handleDelete = async () => {
    if (!collection || isFavorites) return;

    setIsSaving(true);
    try {
      await deleteCollection(collection.id);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Cmd/Ctrl+Enter to save
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (name.trim()) {
          handleSave();
        }
      }
    },
    [name, handleSave]
  );

  const title = isEditing ? 'Edit Collection' : 'Create Collection';
  const hasChanges = isEditing
    ? name !== collection?.name || description !== (collection?.description || '')
    : name.trim().length > 0;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4" onKeyDown={handleKeyDown}>
        {/* Icon header */}
        <div className="flex items-center gap-3 pb-2">
          <div
            className={clsx(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              isFavorites ? 'bg-favorite/15' : 'bg-brass-muted'
            )}
          >
            {isFavorites ? (
              <Star size={20} className="text-favorite" />
            ) : (
              <FolderOpen size={20} className="text-brass" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-ink-muted">
              {isEditing
                ? `${collection?.image_ids.length || 0} images`
                : imageIds.length > 0
                ? `Adding ${imageIds.length} image${imageIds.length !== 1 ? 's' : ''}`
                : 'Empty collection'}
            </p>
          </div>
        </div>

        {/* Name input */}
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Collection"
          autoFocus
          disabled={isFavorites}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && name.trim()) {
              e.preventDefault();
              handleSave();
            }
          }}
        />

        {/* Description textarea */}
        <Textarea
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's this collection about?"
          rows={3}
          className="min-h-[80px]"
        />

        {/* Helper text */}
        <div className="flex items-center justify-between text-[0.65rem] text-ink-muted">
          <span>
            <kbd className="px-1 py-0.5 rounded bg-canvas-muted border border-border/50 font-mono">
              ⌘↵
            </kbd>{' '}
            to save
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          {/* Delete button (only for editing, not Favorites) */}
          <div>
            {isEditing && !isFavorites && (
              <>
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-error">Delete?</span>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={handleDelete}
                      disabled={isSaving}
                    >
                      Yes
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      No
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-ink-muted hover:text-error"
                  >
                    <Trash2 size={14} className="mr-1" />
                    Delete
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Save/Cancel buttons */}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              variant="brass"
              onClick={handleSave}
              disabled={!name.trim() || isSaving || (isEditing && !hasChanges)}
            >
              {isSaving ? 'Saving...' : isEditing ? 'Save' : 'Create'}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
