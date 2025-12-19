import { useMemo } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { Images, Check, Square, CheckSquare } from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';
import { Button } from '../ui';
import type { ImageData } from '../../types';

export function AllImagesTab() {
  const prompts = useStore((s) => s.generations);
  const selectionMode = useStore((s) => s.selectionMode);
  const selectedIds = useStore((s) => s.selectedIds);
  const setSelectionMode = useStore((s) => s.setSelectionMode);
  const toggleSelection = useStore((s) => s.toggleSelection);
  const setSelectedIds = useStore((s) => s.setSelectedIds);
  const clearSelection = useStore((s) => s.clearSelection);
  const setCurrentGeneration = useStore((s) => s.setCurrentGeneration);
  const setCurrentImageIndex = useStore((s) => s.setCurrentImageIndex);
  const setCurrentCollection = useStore((s) => s.setCurrentCollection);

  // Flatten all images from all prompts, sorted by creation date (newest first)
  const allImages = useMemo(() => {
    const images: { image: ImageData; promptId: string; promptTitle: string; indexInPrompt: number }[] = [];
    for (const prompt of prompts) {
      prompt.images.forEach((image, index) => {
        images.push({
          image,
          promptId: prompt.id,
          promptTitle: prompt.title,
          indexInPrompt: index,
        });
      });
    }
    // Sort by generated_at descending (newest first)
    return images.sort((a, b) =>
      new Date(b.image.generated_at).getTime() - new Date(a.image.generated_at).getTime()
    );
  }, [prompts]);

  const isSelectMode = selectionMode === 'select';

  const handleImageClick = (item: typeof allImages[0]) => {
    if (isSelectMode) {
      toggleSelection(item.image.id);
    } else {
      // Navigate to the image in its prompt
      setCurrentCollection(null);
      setCurrentGeneration(item.promptId);
      setCurrentImageIndex(item.indexInPrompt);
    }
  };

  const handleToggleSelectMode = () => {
    if (isSelectMode) {
      clearSelection();
      setSelectionMode('none');
    } else {
      setSelectionMode('select');
    }
  };

  if (allImages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <div className="w-12 h-12 rounded-full bg-canvas-muted flex items-center justify-center mb-3">
          <Images size={20} className="text-ink-muted" />
        </div>
        <p className="text-sm text-ink-secondary">No images yet</p>
        <p className="text-xs text-ink-muted mt-1">
          Generate some images to see them here
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with select mode toggle */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs text-ink-muted">
          {allImages.length} image{allImages.length !== 1 ? 's' : ''}
          {isSelectMode && selectedIds.size > 0 && (
            <span className="ml-1 text-brass">
              ({selectedIds.size} selected)
            </span>
          )}
        </span>
        <div className="flex items-center gap-1">
          {isSelectMode && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (selectedIds.size === allImages.length) {
                  clearSelection();
                } else {
                  // Select all images visible in this view
                  setSelectedIds(allImages.map((item) => item.image.id));
                }
              }}
            >
              {selectedIds.size === allImages.length ? 'Deselect All' : 'Select All'}
            </Button>
          )}
          <Button
            size="sm"
            variant={isSelectMode ? 'primary' : 'secondary'}
            leftIcon={isSelectMode ? <CheckSquare size={12} /> : <Square size={12} />}
            onClick={handleToggleSelectMode}
          >
            {isSelectMode ? 'Done' : 'Select'}
          </Button>
        </div>
      </div>

      {/* Image Grid */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-3 gap-1">
          {allImages.map((item, index) => {
            const isSelected = selectedIds.has(item.image.id);
            return (
              <motion.div
                key={item.image.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(index * 0.01, 0.3) }}
                onClick={() => handleImageClick(item)}
                className={clsx(
                  'relative aspect-square overflow-hidden cursor-pointer group',
                  isSelected && 'ring-2 ring-brass ring-offset-1 ring-offset-surface'
                )}
              >
                <img
                  src={getImageUrl(item.image.image_path)}
                  alt=""
                  className={clsx(
                    'w-full h-full object-cover transition-all',
                    'group-hover:brightness-90',
                    isSelected && 'brightness-90'
                  )}
                />
                {/* Selection checkbox */}
                {isSelectMode && (
                  <div className={clsx(
                    'absolute top-1 left-1 w-5 h-5 flex items-center justify-center transition-all',
                    isSelected
                      ? 'bg-brass text-surface'
                      : 'bg-ink/50 text-surface opacity-0 group-hover:opacity-100'
                  )}>
                    <Check size={12} />
                  </div>
                )}
                {/* Hover overlay with prompt title */}
                {!isSelectMode && (
                  <div className={clsx(
                    'absolute inset-x-0 bottom-0 p-1 bg-gradient-to-t from-ink/70 to-transparent',
                    'opacity-0 group-hover:opacity-100 transition-opacity'
                  )}>
                    <p className="text-[0.5rem] text-surface truncate">
                      {item.promptTitle}
                    </p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
