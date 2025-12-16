import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { X, Check, Star, FolderOpen, ChevronLeft } from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';
import { Button } from '../ui';
import type { Collection } from '../../types';

type PickerSource = 'favorites' | 'collection';
type PickerStep = 'select-collection' | 'select-images';

interface ImagePickerModalProps {
  isOpen: boolean;
  source: PickerSource;
  onClose: () => void;
  onConfirm: (imageIds: string[]) => void;
}

export function ImagePickerModal({ isOpen, source, onClose, onConfirm }: ImagePickerModalProps) {
  const prompts = useStore((s) => s.prompts);
  const favorites = useStore((s) => s.favorites);
  const collections = useStore((s) => s.collections);
  const contextImageIds = useStore((s) => s.contextImageIds);

  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [step, setStep] = useState<PickerStep>(
    source === 'collection' ? 'select-collection' : 'select-images'
  );

  // Get images based on source
  const availableImages = useMemo(() => {
    if (source === 'favorites') {
      // Get favorite images with their data
      return favorites
        .map((id) => {
          for (const p of prompts) {
            const img = p.images.find((i) => i.id === id);
            if (img) return { image: img, promptTitle: p.title };
          }
          return null;
        })
        .filter(Boolean) as { image: { id: string; image_path: string }; promptTitle: string }[];
    } else if (source === 'collection' && selectedCollection) {
      // Get images from selected collection
      return selectedCollection.image_ids
        .map((id) => {
          for (const p of prompts) {
            const img = p.images.find((i) => i.id === id);
            if (img) return { image: img, promptTitle: p.title };
          }
          return null;
        })
        .filter(Boolean) as { image: { id: string; image_path: string }; promptTitle: string }[];
    }
    return [];
  }, [source, favorites, selectedCollection, prompts]);

  const handleToggleImage = (id: string) => {
    setSelectedImageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const allIds = availableImages.map((item) => item.image.id);
    setSelectedImageIds(new Set(allIds));
  };

  const handleClearSelection = () => {
    setSelectedImageIds(new Set());
  };

  const handleConfirm = () => {
    // Filter out images already in context
    const newIds = Array.from(selectedImageIds).filter((id) => !contextImageIds.includes(id));
    onConfirm(newIds);
    handleClose();
  };

  const handleClose = () => {
    setSelectedImageIds(new Set());
    setSelectedCollection(null);
    setStep(source === 'collection' ? 'select-collection' : 'select-images');
    onClose();
  };

  const handleSelectCollection = (collection: Collection) => {
    setSelectedCollection(collection);
    setStep('select-images');
  };

  const handleBackToCollections = () => {
    setSelectedCollection(null);
    setSelectedImageIds(new Set());
    setStep('select-collection');
  };

  if (!isOpen) return null;

  const title =
    source === 'favorites'
      ? 'Select from Favorites'
      : step === 'select-collection'
      ? 'Select a Collection'
      : `Select from "${selectedCollection?.name}"`;

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-overlay z-50"
        onClick={handleClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={clsx(
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          'bg-surface rounded-xl shadow-xl',
          'flex flex-col',
          'z-50'
        )}
        style={{ width: 'min(90vw, 36rem)', maxHeight: '80vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            {source === 'collection' && step === 'select-images' && (
              <button
                onClick={handleBackToCollections}
                className="p-1 rounded-lg text-ink-tertiary hover:text-ink hover:bg-canvas-muted transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <div className="flex items-center gap-2">
              {source === 'favorites' ? (
                <Star size={18} className="text-favorite" />
              ) : (
                <FolderOpen size={18} className="text-brass" />
              )}
              <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-ink">
                {title}
              </h2>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-ink-tertiary hover:text-ink hover:bg-canvas-muted transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 min-h-[300px]">
          {/* Collection Selection Step */}
          {source === 'collection' && step === 'select-collection' && (
            <div className="space-y-2">
              {collections.length === 0 ? (
                <div className="text-center py-8 text-ink-muted text-sm">
                  No collections yet. Create a collection first.
                </div>
              ) : (
                collections.map((collection) => (
                  <button
                    key={collection.id}
                    onClick={() => handleSelectCollection(collection)}
                    className={clsx(
                      'w-full p-3 rounded-lg text-left',
                      'bg-canvas-subtle hover:bg-canvas-muted transition-colors',
                      'flex items-center gap-3'
                    )}
                  >
                    <FolderOpen size={20} className="text-brass shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-ink truncate">{collection.name}</div>
                      <div className="text-xs text-ink-muted">
                        {collection.image_ids.length} images
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Image Selection Step */}
          {(source === 'favorites' || step === 'select-images') && (
            <>
              {availableImages.length === 0 ? (
                <div className="text-center py-8 text-ink-muted text-sm">
                  {source === 'favorites'
                    ? 'No favorites yet. Star some images first.'
                    : 'This collection is empty.'}
                </div>
              ) : (
                <>
                  {/* Selection controls */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-ink-muted">
                      {selectedImageIds.size} of {availableImages.length} selected
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSelectAll}
                        className="text-xs text-brass hover:underline"
                      >
                        Select all
                      </button>
                      {selectedImageIds.size > 0 && (
                        <button
                          onClick={handleClearSelection}
                          className="text-xs text-ink-muted hover:text-error"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Image grid */}
                  <div className="grid grid-cols-4 gap-2">
                    {availableImages.map(({ image, promptTitle }) => {
                      const isSelected = selectedImageIds.has(image.id);
                      const isAlreadyInContext = contextImageIds.includes(image.id);

                      return (
                        <button
                          key={image.id}
                          onClick={() => !isAlreadyInContext && handleToggleImage(image.id)}
                          disabled={isAlreadyInContext}
                          className={clsx(
                            'relative aspect-square rounded-lg overflow-hidden',
                            'transition-all duration-150',
                            isAlreadyInContext && 'opacity-40 cursor-not-allowed',
                            !isAlreadyInContext && 'hover:ring-2 hover:ring-brass',
                            isSelected && 'ring-2 ring-brass'
                          )}
                        >
                          <img
                            src={getImageUrl(image.image_path)}
                            alt={promptTitle}
                            className="w-full h-full object-cover"
                          />

                          {/* Selection indicator */}
                          <div
                            className={clsx(
                              'absolute top-1 right-1 w-5 h-5 rounded-full border-2',
                              'flex items-center justify-center transition-all',
                              isSelected
                                ? 'bg-brass border-brass text-surface'
                                : 'bg-surface/80 border-ink-muted',
                              isAlreadyInContext && 'bg-canvas-muted border-ink-muted'
                            )}
                          >
                            {isSelected && <Check size={12} />}
                            {isAlreadyInContext && (
                              <span className="text-[8px] text-ink-muted">✓</span>
                            )}
                          </div>

                          {/* Title tooltip on hover */}
                          <div
                            className={clsx(
                              'absolute inset-x-0 bottom-0 px-1 py-0.5',
                              'bg-ink/70 text-surface text-[9px] truncate',
                              'opacity-0 hover:opacity-100 transition-opacity'
                            )}
                          >
                            {promptTitle}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {(source === 'favorites' || step === 'select-images') && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border shrink-0">
            <Button variant="secondary" size="sm" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="brass"
              size="sm"
              onClick={handleConfirm}
              disabled={selectedImageIds.size === 0}
            >
              Add {selectedImageIds.size} Image{selectedImageIds.size !== 1 ? 's' : ''} to Context
            </Button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
