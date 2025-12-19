import { useMemo, useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Check, Heart } from 'lucide-react';
import { useStore } from '../../store';
import { SUGGESTED_TAGS, type DesignAxis, type DesignDimension } from '../../types';

// Helper to find which axis a tag belongs to
function findAxisForTag(
  tag: string,
  annotations?: Record<string, string[]>
): DesignAxis {
  if (annotations) {
    for (const [axis, tags] of Object.entries(annotations)) {
      if (tags.includes(tag)) {
        return axis as DesignAxis;
      }
    }
  }
  for (const [axis, tags] of Object.entries(SUGGESTED_TAGS)) {
    if (tags.includes(tag)) {
      return axis as DesignAxis;
    }
  }
  return 'style';
}

// Helper to check if a tag is liked
function isTagLiked(tag: string, likedAxes: Record<string, string[]> | undefined): boolean {
  if (!likedAxes) return false;
  for (const tags of Object.values(likedAxes)) {
    if (tags?.includes(tag)) return true;
  }
  return false;
}

// Helper to check if a dimension axis is liked
function isDimensionLiked(axis: string, likedDimensionAxes: string[] | undefined): boolean {
  return likedDimensionAxes?.includes(axis) ?? false;
}

export function DesignAnnotation() {
  const prompts = useStore((s) => s.prompts);
  const collections = useStore((s) => s.collections);
  const currentPromptId = useStore((s) => s.currentPromptId);
  const currentCollectionId = useStore((s) => s.currentCollectionId);
  const currentImageIndex = useStore((s) => s.currentImageIndex);
  const toggleAxisLike = useStore((s) => s.toggleAxisLike);
  const toggleDimensionLike = useStore((s) => s.toggleDimensionLike);
  const updateImageNotes = useStore((s) => s.updateImageNotes);

  const [annotation, setAnnotation] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const currentPrompt = useMemo(
    () => prompts.find((p) => p.id === currentPromptId) || null,
    [prompts, currentPromptId]
  );

  const currentCollection = useMemo(
    () => collections.find((c) => c.id === currentCollectionId) || null,
    [collections, currentCollectionId]
  );

  // Build image map for looking up images by ID
  const imageMap = useMemo(() => {
    const map = new Map<string, { image: typeof prompts[0]['images'][0]; prompt: typeof prompts[0] }>();
    for (const prompt of prompts) {
      for (const image of prompt.images) {
        map.set(image.id, { image, prompt });
      }
    }
    return map;
  }, [prompts]);

  // Get current image
  const currentImage = useMemo(() => {
    if (currentPrompt) {
      return currentPrompt.images[currentImageIndex] || null;
    } else if (currentCollection) {
      const imageId = currentCollection.image_ids[currentImageIndex];
      if (imageId) {
        const found = imageMap.get(imageId);
        if (found) {
          return found.image;
        }
      }
    }
    return null;
  }, [currentPrompt, currentCollection, currentImageIndex, imageMap]);

  // Group annotations by axis for display - MUST be before early return (React hooks rule)
  const groupedAnnotations = useMemo(() => {
    if (!currentImage?.annotations) return [];
    return Object.entries(currentImage.annotations).filter(
      ([, tags]) => tags && tags.length > 0
    );
  }, [currentImage?.annotations]);

  // Sync annotation with current image
  useEffect(() => {
    setAnnotation(currentImage?.annotation || '');
  }, [currentImage?.id, currentImage?.annotation]);

  const handleTagClick = (tag: string) => {
    if (!currentImage) return;
    const axis = findAxisForTag(tag, currentImage.annotations);
    const isLiked = isTagLiked(tag, currentImage.liked_axes);
    toggleAxisLike(currentImage.id, axis, tag, !isLiked);
  };

  const handleSave = async () => {
    if (!currentImage) return;
    setIsSaving(true);
    try {
      await updateImageNotes(currentImage.id, currentImage.notes || '', annotation);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDimensionLikeClick = (axis: string) => {
    if (!currentImage) return;
    const isLiked = isDimensionLiked(axis, currentImage.liked_dimension_axes);
    toggleDimensionLike(currentImage.id, axis, !isLiked);
  };

  // Get design dimensions from current image (limit to 3 most important)
  const dimensions = useMemo(() => {
    if (!currentImage?.design_dimensions) return [];
    return Object.entries(currentImage.design_dimensions).slice(0, 3);
  }, [currentImage?.design_dimensions]);

  if (!currentImage) return null;

  const hasAnnotations = currentImage.annotations && Object.keys(currentImage.annotations).length > 0;
  const hasDimensions = dimensions.length > 0;
  const hasChanges = annotation !== (currentImage.annotation || '');

  return (
    <div className="px-6 py-5">
      {/* Three Column Layout: Notes | Design Tags | Dimensions */}
      <div className="flex gap-6">
        {/* Left Column: Notes */}
        <div className="w-64 shrink-0">
          <div className="relative">
            <textarea
              value={annotation}
              onChange={(e) => setAnnotation(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && hasChanges) {
                  e.preventDefault();
                  handleSave();
                }
              }}
              placeholder="What stands out in this image?"
              rows={3}
              className={clsx(
                'w-full px-3 py-2 rounded-lg resize-none',
                'bg-canvas-subtle border border-border/50',
                'text-sm text-ink placeholder:text-ink-muted/60',
                'focus:outline-none focus:ring-1 focus:ring-brass/30 focus:border-brass/50',
                'transition-all'
              )}
            />
          </div>
          {/* Helper text */}
          <div className="mt-1.5 flex items-center justify-between text-[0.6rem] text-ink-muted">
            <span>
              <kbd className="px-1 py-0.5 rounded bg-canvas-muted border border-border/50 font-mono">⇧↵</kbd>
              {' '}new line
            </span>
            <span className="flex items-center gap-1.5">
              {saved ? (
                <span className="text-success flex items-center gap-0.5">
                  <Check size={10} /> saved
                </span>
              ) : hasChanges ? (
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-1.5 py-0.5 rounded text-[0.6rem] font-medium bg-brass text-surface hover:bg-brass-dark"
                >
                  {isSaving ? '...' : '↵ save'}
                </button>
              ) : (
                <span>
                  <kbd className="px-1 py-0.5 rounded bg-canvas-muted border border-border/50 font-mono">↵</kbd>
                  {' '}to save
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Middle Column: Design Tags by Axis */}
        <div className="flex-1 min-w-0">
          {hasAnnotations ? (
            <div className="space-y-1.5">
              {groupedAnnotations.map(([axis, tags]) => (
                <div key={axis} className="flex items-start gap-2">
                  <span className="w-14 text-[0.6rem] text-ink-muted uppercase tracking-wide text-right shrink-0 pt-1">
                    {axis.replace('_', ' ')}
                  </span>
                  <div className="flex flex-wrap items-center gap-1">
                    {tags.map((tag) => {
                      const liked = isTagLiked(tag, currentImage.liked_axes);
                      return (
                        <button
                          key={tag}
                          onClick={() => handleTagClick(tag)}
                          className={clsx(
                            'px-2 py-0.5 rounded-full text-xs transition-all',
                            'border',
                            liked
                              ? 'bg-brass/15 border-brass text-brass-dark font-medium'
                              : 'bg-surface border-border/50 text-ink-secondary hover:border-brass/40 hover:bg-brass/5'
                          )}
                        >
                          {liked && <span className="mr-0.5">♥</span>}
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-muted/50 italic py-2">
              Design tags will appear on new generations
            </p>
          )}
        </div>

        {/* Right Column: Design Dimensions - compact list */}
        {hasDimensions && (
          <div className="w-56 shrink-0">
            <div className="space-y-1">
              {dimensions.map(([axis, dim]) => {
                const liked = isDimensionLiked(axis, currentImage.liked_dimension_axes);
                return (
                  <button
                    key={axis}
                    onClick={() => handleDimensionLikeClick(axis)}
                    className={clsx(
                      'w-full px-2.5 py-1.5 rounded-md text-left transition-all',
                      'flex items-center gap-2 group',
                      liked
                        ? 'bg-brass/15 text-brass-dark'
                        : 'bg-canvas-subtle hover:bg-canvas-muted text-ink-secondary'
                    )}
                    title={dim.description}
                  >
                    <Heart
                      size={12}
                      className={clsx(
                        'shrink-0 transition-colors',
                        liked ? 'text-brass' : 'text-ink-muted/50 group-hover:text-brass/60'
                      )}
                      fill={liked ? 'currentColor' : 'none'}
                    />
                    <span className="text-xs leading-tight truncate">
                      {dim.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
