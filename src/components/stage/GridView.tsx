import { useMemo } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { Check, FolderMinus } from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';
import type { ImageData } from '../../types';

// Extended image data that tracks its parent generation for navigation
interface DisplayImage extends ImageData {
  parentGenerationId?: string;
}

export function GridView() {
  // Select primitive values to avoid infinite re-renders
  const generations = useStore((s) => s.generations);
  const collections = useStore((s) => s.collections);
  const currentGenerationId = useStore((s) => s.currentGenerationId);
  const currentCollectionId = useStore((s) => s.currentCollectionId);
  const setCurrentImageIndex = useStore((s) => s.setCurrentImageIndex);
  const generationFilter = useStore((s) => s.generationFilter);
  const lastSeenLibraryAt = useStore((s) => s.lastSeenLibraryAt);

  // Compute derived values with useMemo
  const currentGeneration = useMemo(
    () => generations.find((g) => g.id === currentGenerationId) || null,
    [generations, currentGenerationId]
  );

  const currentCollection = useMemo(
    () => collections.find((c) => c.id === currentCollectionId) || null,
    [collections, currentCollectionId]
  );

  const currentCollectionImages = useMemo(() => {
    if (!currentCollection) return [];
    const imageMap = new Map<string, typeof generations[0]['images'][0]>();
    for (const generation of generations) {
      for (const image of generation.images) {
        imageMap.set(image.id, image);
      }
    }
    return currentCollection.image_ids
      .map((id) => imageMap.get(id))
      .filter((img): img is typeof generations[0]['images'][0] => img !== undefined);
  }, [generations, currentCollection]);

  // Concept images - all images from generations with is_concept: true, sorted newest first
  const conceptImages = useMemo((): DisplayImage[] => {
    const conceptGenerations = generations.filter((g) => g.is_concept);
    const images = conceptGenerations.flatMap((generation) =>
      generation.images.map((img) => ({
        ...img,
        parentGenerationId: generation.id,
      }))
    );
    // Sort by generated_at date, newest first
    return images.sort((a, b) =>
      new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime()
    );
  }, [generations]);

  const setViewMode = useStore((s) => s.setViewMode);
  const removeFromCurrentCollection = useStore((s) => s.removeFromCurrentCollection);
  const selectionMode = useStore((s) => s.selectionMode);
  const toggleSelection = useStore((s) => s.toggleSelection);
  const selectedIds = useStore((s) => s.selectedIds);

  // Determine what we're viewing
  const isViewingConcepts = generationFilter === 'concepts' && !currentGenerationId && !currentCollectionId;
  const isViewingCollection = !currentGeneration && !!currentCollection && !isViewingConcepts;

  // Helper to check if an image is "new" (created since last library visit)
  const isNewImage = (image: DisplayImage): boolean => {
    if (!lastSeenLibraryAt) return false;
    return new Date(image.generated_at) > new Date(lastSeenLibraryAt);
  };

  // Support generation, collection, and concepts gallery viewing
  const displayImages: DisplayImage[] = isViewingConcepts
    ? conceptImages
    : currentGeneration?.images ?? currentCollectionImages;
  const displayTitle = isViewingConcepts
    ? 'Design Token Concepts'
    : currentGeneration?.title ?? currentCollection?.name ?? 'Image';

  if (displayImages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-ink-muted">
          {isViewingConcepts
            ? 'No concept images yet'
            : isViewingCollection
              ? 'Empty collection'
              : 'No generation selected'}
        </p>
      </div>
    );
  }

  const handleImageClick = (index: number, image: DisplayImage) => {
    if (selectionMode !== 'none') {
      toggleSelection(image.id);
    } else {
      // For all views (generations, collections, concepts), just switch to single view
      setCurrentImageIndex(index);
      setViewMode('single');
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {displayImages.map((image, index) => {
          const isSelected = selectedIds.has(image.id);

          return (
            <motion.div
              key={image.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={clsx(
                'group relative aspect-square overflow-hidden',
                'bg-canvas-muted cursor-pointer',
                'transition-all duration-200',
                isSelected
                  ? 'ring-4 ring-brass shadow-lg scale-[0.98]'
                  : 'hover:shadow-lg hover:scale-[1.02]'
              )}
              onClick={() => handleImageClick(index, image)}
            >
              <img
                src={getImageUrl(image.image_path)}
                alt={`${displayTitle} - ${index + 1}`}
                className="w-full h-full object-cover"
              />

              {/* Hover overlay */}
              <div
                className={clsx(
                  'absolute inset-0 bg-ink/20',
                  'opacity-0 group-hover:opacity-100 transition-opacity'
                )}
              />

              {/* Remove from collection button (when viewing collections) */}
              {isViewingCollection && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromCurrentCollection(image.id);
                  }}
                  className={clsx(
                    'absolute top-2 right-2 w-8 h-8 rounded-full',
                    'flex items-center justify-center',
                    'transition-all duration-200',
                    'bg-surface/80 text-ink-muted opacity-0 group-hover:opacity-100 hover:text-danger'
                  )}
                >
                  <FolderMinus size={16} />
                </button>
              )}

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

              {/* "New" badge for recently created images */}
              {isNewImage(image) && (
                <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-brass/90 backdrop-blur-sm">
                  <span className="text-[0.5rem] font-bold text-white uppercase tracking-wide">
                    New
                  </span>
                </div>
              )}

              {/* Image number badge */}
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-surface/80 backdrop-blur-sm">
                <span className="text-xs font-medium text-ink-secondary">
                  {index + 1}
                </span>
              </div>

              {/* Variation title badge */}
              {image.variation_title && (
                <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-brass-muted backdrop-blur-sm max-w-[60%]">
                  <span className="text-[0.625rem] font-medium text-brass-dark truncate block">
                    {image.variation_title}
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
