import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { Star, Check } from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';

export function GridView() {
  const currentPrompt = useStore((s) => s.getCurrentPrompt());
  const setCurrentImageIndex = useStore((s) => s.setCurrentImageIndex);
  const setViewMode = useStore((s) => s.setViewMode);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const isImageFavorite = useStore((s) => s.isImageFavorite);
  const selectionMode = useStore((s) => s.selectionMode);
  const toggleSelection = useStore((s) => s.toggleSelection);
  const selectedIds = useStore((s) => s.selectedIds);

  if (!currentPrompt) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-ink-muted">No prompt selected</p>
      </div>
    );
  }

  const handleImageClick = (index: number, imageId: string) => {
    if (selectionMode !== 'none') {
      toggleSelection(imageId);
    } else {
      setCurrentImageIndex(index);
      setViewMode('single');
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {currentPrompt.images.map((image, index) => {
          const isFavorite = isImageFavorite(image.id);
          const isSelected = selectedIds.has(image.id);

          return (
            <motion.div
              key={image.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={clsx(
                'group relative aspect-square rounded-xl overflow-hidden',
                'bg-canvas-muted cursor-pointer',
                'transition-all duration-200',
                isSelected
                  ? 'ring-4 ring-brass shadow-lg scale-[0.98]'
                  : 'hover:shadow-lg hover:scale-[1.02]'
              )}
              onClick={() => handleImageClick(index, image.id)}
            >
              <img
                src={getImageUrl(image.image_path)}
                alt={`${currentPrompt.title} - ${index + 1}`}
                className="w-full h-full object-cover"
              />

              {/* Hover overlay */}
              <div
                className={clsx(
                  'absolute inset-0 bg-ink/20',
                  'opacity-0 group-hover:opacity-100 transition-opacity'
                )}
              />

              {/* Favorite button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(image.id);
                }}
                className={clsx(
                  'absolute top-2 right-2 w-8 h-8 rounded-full',
                  'flex items-center justify-center',
                  'transition-all duration-200',
                  isFavorite
                    ? 'bg-favorite text-surface opacity-100'
                    : 'bg-surface/80 text-ink-muted opacity-0 group-hover:opacity-100 hover:text-favorite'
                )}
              >
                <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} />
              </button>

              {/* Selection indicator */}
              {selectionMode !== 'none' && (
                <div
                  className={clsx(
                    'absolute top-2 left-2 w-6 h-6 rounded-full border-2',
                    'flex items-center justify-center transition-all',
                    isSelected
                      ? 'bg-brass border-brass text-surface'
                      : 'bg-surface/80 border-ink-muted opacity-0 group-hover:opacity-100'
                  )}
                >
                  {isSelected && <Check size={14} strokeWidth={3} />}
                </div>
              )}

              {/* Image number badge */}
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-surface/80 backdrop-blur-sm">
                <span className="text-xs font-medium text-ink-secondary">
                  {index + 1}
                </span>
              </div>

              {/* Mood/variation badge */}
              {image.mood && (
                <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-brass-muted backdrop-blur-sm">
                  <span className="text-[0.625rem] font-medium text-brass-dark">
                    {image.mood}
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
