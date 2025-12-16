import { useState } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Image, FolderPlus, Plus, Check } from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';
import { Button, Input, Dialog } from '../ui';

export function SelectionTray() {
  const selectedIds = useStore((s) => s.selectedIds);
  const prompts = useStore((s) => s.prompts);
  const collections = useStore((s) => s.collections);
  const clearSelection = useStore((s) => s.clearSelection);
  const toggleSelection = useStore((s) => s.toggleSelection);
  const setContextImages = useStore((s) => s.setContextImages);
  const setRightTab = useStore((s) => s.setRightTab);
  const createCollection = useStore((s) => s.createCollection);
  const addToCollection = useStore((s) => s.addToCollection);
  const setSelectionMode = useStore((s) => s.setSelectionMode);

  const [isCollectionDialogOpen, setIsCollectionDialogOpen] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Get selected images with their data
  const selectedImages = Array.from(selectedIds)
    .map((id) => {
      for (const prompt of prompts) {
        const img = prompt.images.find((i) => i.id === id);
        if (img) return { ...img, promptTitle: prompt.title };
      }
      return null;
    })
    .filter(Boolean);

  if (selectedIds.size === 0) return null;

  const handleUseAsContext = () => {
    setContextImages(Array.from(selectedIds));
    setRightTab('generate');
    clearSelection();
  };

  const handleSaveCollection = async () => {
    if (isCreatingNew) {
      if (collectionName.trim()) {
        await createCollection(collectionName.trim());
        setCollectionName('');
        setIsCreatingNew(false);
        setIsCollectionDialogOpen(false);
      }
    } else if (selectedCollectionId) {
      await addToCollection(selectedCollectionId);
      setSelectedCollectionId(null);
      clearSelection();
      setSelectionMode('none');
      setIsCollectionDialogOpen(false);
    }
  };

  const handleOpenCollectionDialog = () => {
    setSelectedCollectionId(null);
    setIsCreatingNew(collections.length === 0);
    setCollectionName('');
    setIsCollectionDialogOpen(true);
  };

  return (
    <>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className={clsx(
          'absolute bottom-4 left-4 right-4',
          'bg-surface rounded-xl shadow-xl border border-border',
          'p-4'
        )}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-ink">
            {selectedIds.size} selected
          </span>
          <button
            onClick={clearSelection}
            className="p-1 rounded text-ink-muted hover:text-ink hover:bg-canvas-muted transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Selected thumbnails */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-3">
          <AnimatePresence>
            {selectedImages.map((img) => (
              <motion.div
                key={img!.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="relative flex-shrink-0"
              >
                <img
                  src={getImageUrl(img!.image_path)}
                  alt=""
                  className="w-14 h-14 rounded-lg object-cover"
                />
                <button
                  onClick={() => toggleSelection(img!.id)}
                  className={clsx(
                    'absolute -top-1 -right-1 w-5 h-5 rounded-full',
                    'bg-ink text-surface',
                    'flex items-center justify-center',
                    'hover:bg-error transition-colors'
                  )}
                >
                  <X size={12} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSelection}
          >
            Clear
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Image size={14} />}
            onClick={handleUseAsContext}
          >
            Use as Context
          </Button>
          <Button
            variant="brass"
            size="sm"
            leftIcon={<FolderPlus size={14} />}
            onClick={handleOpenCollectionDialog}
          >
            Save Collection
          </Button>
        </div>
      </motion.div>

      {/* Collection dialog */}
      <Dialog
        isOpen={isCollectionDialogOpen}
        onClose={() => setIsCollectionDialogOpen(false)}
        title="Save to Collection"
      >
        <div className="space-y-4">
          {/* Existing collections */}
          {!isCreatingNew && collections.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-ink-secondary">
                Add to existing collection
              </label>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {collections.map((collection) => (
                  <button
                    key={collection.id}
                    onClick={() => setSelectedCollectionId(collection.id)}
                    className={clsx(
                      'w-full flex items-center justify-between px-3 py-2 rounded-lg text-left',
                      'transition-colors',
                      selectedCollectionId === collection.id
                        ? 'bg-brass-muted text-ink'
                        : 'hover:bg-canvas-muted text-ink-secondary'
                    )}
                  >
                    <div>
                      <p className="text-sm font-medium">{collection.name}</p>
                      <p className="text-xs text-ink-muted">
                        {collection.image_ids?.length || 0} images
                      </p>
                    </div>
                    {selectedCollectionId === collection.id && (
                      <Check size={16} className="text-brass-dark" />
                    )}
                  </button>
                ))}
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
                  if (e.key === 'Enter') handleSaveCollection();
                }}
              />
            </div>
          )}

          <div className="text-xs text-ink-muted">
            {selectedIds.size} image{selectedIds.size !== 1 ? 's' : ''} will be
            added
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => setIsCollectionDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="brass"
              onClick={handleSaveCollection}
              disabled={isCreatingNew ? !collectionName.trim() : !selectedCollectionId}
            >
              {isCreatingNew ? 'Create & Add' : 'Add to Collection'}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
