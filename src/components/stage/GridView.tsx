import { useMemo } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { Check, FolderMinus, X, Sparkles } from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';
import type { ImageData } from '../../types';

// Extended image data that tracks its parent prompt for navigation
interface DisplayImage extends ImageData {
  parentPromptId?: string;
}

export function GridView() {
  // Select primitive values to avoid infinite re-renders
  const prompts = useStore((s) => s.generations);
  const collections = useStore((s) => s.collections);
  const currentGenerationId = useStore((s) => s.currentGenerationId);
  const currentCollectionId = useStore((s) => s.currentCollectionId);
  const setCurrentImageIndex = useStore((s) => s.setCurrentImageIndex);
  const generationFilter = useStore((s) => s.generationFilter);
  const setGenerationFilter = useStore((s) => s.setGenerationFilter);
  const lastSeenLibraryAt = useStore((s) => s.lastSeenLibraryAt);

  // Compute derived values with useMemo
  const currentPrompt = useMemo(
    () => prompts.find((p) => p.id === currentGenerationId) || null,
    [prompts, currentGenerationId]
  );

  const currentCollection = useMemo(
    () => collections.find((c) => c.id === currentCollectionId) || null,
    [collections, currentCollectionId]
  );

  const currentCollectionImages = useMemo(() => {
    if (!currentCollection) return [];
    const imageMap = new Map<string, typeof prompts[0]['images'][0]>();
    for (const prompt of prompts) {
      for (const image of prompt.images) {
        imageMap.set(image.id, image);
      }
    }
    return currentCollection.image_ids
      .map((id) => imageMap.get(id))
      .filter((img): img is typeof prompts[0]['images'][0] => img !== undefined);
  }, [prompts, currentCollection]);

  // Concept images - all images from prompts with is_concept: true, sorted newest first
  const conceptImages = useMemo((): DisplayImage[] => {
    const conceptPrompts = prompts.filter((p) => p.is_concept);
    const images = conceptPrompts.flatMap((prompt) =>
      prompt.images.map((img) => ({
        ...img,
        parentPromptId: prompt.id,
      }))
    );
    // Sort by generated_at date, newest first
    return images.sort((a, b) =>
      new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime()
    );
  }, [prompts]);

  const setViewMode = useStore((s) => s.setViewMode);
  const removeFromCurrentCollection = useStore((s) => s.removeFromCurrentCollection);
  const selectionMode = useStore((s) => s.selectionMode);
  const toggleSelection = useStore((s) => s.toggleSelection);
  const selectedIds = useStore((s) => s.selectedIds);

  // Determine what we're viewing
  const isViewingConcepts = generationFilter === 'concepts' && !currentGenerationId && !currentCollectionId;
  const isViewingCollection = !currentPrompt && !!currentCollection && !isViewingConcepts;

  // Helper to check if a concept image is "new" (created since last library visit)
  const isNewImage = (image: DisplayImage): boolean => {
    if (!isViewingConcepts || !lastSeenLibraryAt) return false;
    return new Date(image.generated_at) > new Date(lastSeenLibraryAt);
  };

  // Support prompt, collection, and concepts gallery viewing
  const displayImages: DisplayImage[] = isViewingConcepts
    ? conceptImages
    : currentPrompt?.images ?? currentCollectionImages;
  const displayTitle = isViewingConcepts
    ? 'Design Token Concepts'
    : currentPrompt?.title ?? currentCollection?.name ?? 'Image';

  if (displayImages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-ink-muted">
          {isViewingConcepts
            ? 'No concept images yet'
            : isViewingCollection
              ? 'Empty collection'
              : 'No prompt selected'}
        </p>
      </div>
    );
  }

  const handleImageClick = (index: number, image: DisplayImage) => {
    if (selectionMode !== 'none') {
      toggleSelection(image.id);
    } else {
      // For all views (prompts, collections, concepts), just switch to single view
      setCurrentImageIndex(index);
      setViewMode('single');
    }
  };

  const handleClearFilter = () => {
    setGenerationFilter('all');
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* Concepts filter header */}
      {isViewingConcepts && (
        <div className="flex items-center justify-between mb-4 p-3 bg-brass-muted/30 rounded-lg border border-brass/20">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-brass" />
            <span className="text-sm font-medium text-ink">
              Design Token Concepts
            </span>
            <span className="text-xs text-ink-muted">
              ({conceptImages.length} image{conceptImages.length !== 1 ? 's' : ''})
            </span>
          </div>
          <button
            onClick={handleClearFilter}
            className="flex items-center gap-1 px-2 py-1 text-xs text-ink-muted hover:text-ink rounded hover:bg-surface transition-colors"
          >
            <X size={12} />
            Clear filter
          </button>
        </div>
      )}

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

              {/* "New" badge for recently created concept images */}
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
