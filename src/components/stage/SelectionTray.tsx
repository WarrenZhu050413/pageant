import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FolderPlus, Trash2, CheckSquare, Square, Download, Plus } from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl, batchDownload } from '../../api';
import { Button, Dialog, IconButton, CollectionDialog } from '../ui';

export function SelectionTray() {
  const selectedIds = useStore((s) => s.selectedIds);
  // Use all generations (including archived) for image lookup
  const getAllGenerations = useStore((s) => s.getAllGenerations);
  const allPrompts = getAllGenerations();
  const collections = useStore((s) => s.collections);
  const currentGenerationId = useStore((s) => s.currentGenerationId);
  const currentCollectionId = useStore((s) => s.currentCollectionId);

  // Compute derived values with useMemo to avoid infinite re-renders
  const currentPrompt = useMemo(
    () => allPrompts.find((p) => p.id === currentGenerationId) || null,
    [allPrompts, currentGenerationId]
  );

  const currentCollection = useMemo(
    () => collections.find((c) => c.id === currentCollectionId) || null,
    [collections, currentCollectionId]
  );

  const currentCollectionImages = useMemo(() => {
    if (!currentCollection) return [];
    // Build image map from all prompts (including archived)
    const imageMap = new Map<string, typeof allPrompts[0]['images'][0]>();
    for (const prompt of allPrompts) {
      for (const image of prompt.images) {
        if (!imageMap.has(image.id)) {
          imageMap.set(image.id, image);
        }
      }
    }
    return currentCollection.image_ids
      .map((id) => imageMap.get(id))
      .filter((img): img is typeof allPrompts[0]['images'][0] => img !== undefined);
  }, [allPrompts, currentCollection]);
  const clearSelection = useStore((s) => s.clearSelection);
  const toggleSelection = useStore((s) => s.toggleSelection);
  const setContextImages = useStore((s) => s.setContextImages);
  const setRightTab = useStore((s) => s.setRightTab);
  const setSelectionMode = useStore((s) => s.setSelectionMode);
  const selectAll = useStore((s) => s.selectAll);
  const batchDelete = useStore((s) => s.batchDelete);
  const contextImageIds = useStore((s) => s.contextImageIds);

  const [isCollectionDialogOpen, setIsCollectionDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Get display images (from prompt or collection)
  const displayImages = useMemo(
    () => currentPrompt?.images ?? currentCollectionImages,
    [currentPrompt?.images, currentCollectionImages]
  );
  const allSelected = displayImages.length > 0 && selectedIds.size === displayImages.length;

  // Get selected images with their data - memoize to prevent re-creating objects on every render
  const selectedImages = useMemo(() => {
    return Array.from(selectedIds)
      .map((id) => {
        for (const prompt of allPrompts) {
          const img = prompt.images.find((i) => i.id === id);
          if (img) return { ...img, promptTitle: prompt.title };
        }
        return null;
      })
      .filter(Boolean);
  }, [selectedIds, allPrompts]);

  if (selectedIds.size === 0) return null;

  const handleAddToContext = () => {
    // Add selected images to existing context (additive, not replacement)
    const newContextIds = [...contextImageIds];
    for (const id of selectedIds) {
      if (!newContextIds.includes(id)) {
        newContextIds.push(id);
      }
    }
    setContextImages(newContextIds);
    setRightTab('generate');
    clearSelection();
  };

  const handleCollectionDialogSuccess = () => {
    clearSelection();
    setSelectionMode('none');
  };

  const handleSelectAllToggle = () => {
    if (allSelected) {
      clearSelection();
    } else {
      selectAll();
    }
  };

  const handleDelete = async () => {
    await batchDelete();
    setIsDeleteDialogOpen(false);
    clearSelection();
    setSelectionMode('none');
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await batchDownload(Array.from(selectedIds));
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
    }
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
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
            onClick={handleSelectAllToggle}
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </Button>
          <div className="w-px h-6 bg-border self-center" />
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={handleAddToContext}
          >
            Add to Context
          </Button>
          <Button
            variant="brass"
            size="sm"
            leftIcon={<FolderPlus size={14} />}
            onClick={() => setIsCollectionDialogOpen(true)}
          >
            Save Collection
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Download size={14} />}
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? 'Downloading...' : 'Download'}
          </Button>
          <div className="w-px h-6 bg-border self-center" />
          <IconButton
            variant="danger"
            size="sm"
            tooltip="Delete selected"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <Trash2 size={14} />
          </IconButton>
        </div>
      </motion.div>

      {/* Collection dialog */}
      <CollectionDialog
        isOpen={isCollectionDialogOpen}
        onClose={() => setIsCollectionDialogOpen(false)}
        imageIds={Array.from(selectedIds)}
        onSuccess={handleCollectionDialogSuccess}
      />

      {/* Delete confirmation dialog */}
      <Dialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        title="Delete Images"
      >
        <p className="text-sm text-ink-secondary mb-6">
          Are you sure you want to delete {selectedIds.size} image{selectedIds.size !== 1 ? 's' : ''}? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </Dialog>
    </>
  );
}
