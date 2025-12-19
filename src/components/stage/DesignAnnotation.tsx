import { useMemo, useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { Check, Heart, Sparkles, Loader2, CheckCircle } from 'lucide-react';
import { useStore } from '../../store';
import { toast } from '../../store/toastStore';
import { SUGGESTED_TAGS, type DesignAxis, type DesignDimension, type DesignToken } from '../../types';
import { TokenDetailView } from './TokenDetailView';

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
  const prompts = useStore((s) => s.generations);
  const collections = useStore((s) => s.collections);
  const currentGenerationId = useStore((s) => s.currentGenerationId);
  const currentCollectionId = useStore((s) => s.currentCollectionId);
  const currentImageIndex = useStore((s) => s.currentImageIndex);
  const toggleAxisLike = useStore((s) => s.toggleAxisLike);
  const toggleDimensionLike = useStore((s) => s.toggleDimensionLike);
  const updateImageNotes = useStore((s) => s.updateImageNotes);
  const createToken = useStore((s) => s.createToken);
  const designTokens = useStore((s) => s.designTokens);

  const [annotation, setAnnotation] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null);
  // Track extractions by imageId-axis to be image-specific
  const [extractingKeys, setExtractingKeys] = useState<Set<string>>(new Set());
  const [selectedToken, setSelectedToken] = useState<DesignToken | null>(null);

  const currentPrompt = useMemo(
    () => prompts.find((p) => p.id === currentGenerationId) || null,
    [prompts, currentGenerationId]
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

  // Sync annotation with current image and reset expanded dimension
  useEffect(() => {
    setAnnotation(currentImage?.annotation || '');
    setExpandedDimension(null);
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

  // Find existing token for a specific image + axis combination
  const findTokenForImageAxis = useCallback(
    (imageId: string, axis: string): DesignToken | undefined => {
      return designTokens.find(
        (token) =>
          token.category === axis &&
          token.images.some((img) => img.id === imageId)
      );
    },
    [designTokens]
  );

  // Handle inline extraction of a dimension as a design token (non-blocking, allows concurrent extractions)
  const handleInlineExtract = async (axis: string, dim: DesignDimension) => {
    if (!currentImage) return;

    const extractionKey = `${currentImage.id}-${axis}`;

    // Check if this specific image+axis is already being extracted
    if (extractingKeys.has(extractionKey)) return;

    // Check if token already exists - if so, open it instead
    const existingToken = findTokenForImageAxis(currentImage.id, axis);
    if (existingToken) {
      setSelectedToken(existingToken);
      return;
    }

    // Add this key to the extracting set
    setExtractingKeys((prev) => new Set(prev).add(extractionKey));

    try {
      const token = await createToken({
        name: dim.name,
        description: dim.description,
        image_ids: [currentImage.id],
        prompts: [dim.generation_prompt],
        creation_method: 'ai-extraction',
        dimension: dim,
        generate_concept: true,
        category: axis,
        tags: dim.tags,
      });

      if (token) {
        toast.success(`Token "${dim.name}" created`);
      }
    } catch (error) {
      toast.error(`Failed to create token: ${(error as Error).message}`);
    } finally {
      // Remove this key from the extracting set
      setExtractingKeys((prev) => {
        const next = new Set(prev);
        next.delete(extractionKey);
        return next;
      });
    }
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

  // Check if there are any liked tags (for visual affordance)
  const hasLikedTags = currentImage.liked_axes && Object.values(currentImage.liked_axes).some(tags => tags?.length > 0);
  const hasLikedDimensions = currentImage.liked_dimension_axes && currentImage.liked_dimension_axes.length > 0;

  return (
    <div className="px-6 py-5 h-52 overflow-y-auto">
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
              placeholder="What stands out in this image? Write to send to AI."
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
              {/* Visual affordance: show when liked tags will be sent to AI */}
              {hasLikedTags && (
                <p className="text-[0.6rem] text-brass/80 mt-2 ml-16">
                  ♥ preferences sent to AI when used as context
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-ink-muted/50 italic py-2">
              Design tags will appear on new generations
            </p>
          )}
        </div>

        {/* Right Column: Design Dimensions - click to expand */}
        <div className="w-64 shrink-0">
          {hasDimensions ? (
            <div className="divide-y divide-border/30">
              {dimensions.map(([axis, dim]) => {
                const liked = isDimensionLiked(axis, currentImage.liked_dimension_axes);
                const isExpanded = expandedDimension === axis;
                const extractionKey = `${currentImage.id}-${axis}`;
                const isExtracting = extractingKeys.has(extractionKey);
                const existingToken = findTokenForImageAxis(currentImage.id, axis);
                const hasToken = !!existingToken;

                return (
                  <div key={axis} className="py-1.5 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDimensionLikeClick(axis);
                        }}
                        className={clsx(
                          'p-1 rounded transition-colors shrink-0',
                          liked
                            ? 'text-brass'
                            : 'text-ink-muted/40 hover:text-brass/60'
                        )}
                        title="Like this dimension"
                      >
                        <Heart size={12} fill={liked ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (hasToken) {
                            setSelectedToken(existingToken);
                          } else {
                            handleInlineExtract(axis, dim);
                          }
                        }}
                        disabled={isExtracting}
                        className={clsx(
                          'p-1 rounded transition-colors shrink-0',
                          isExtracting
                            ? 'text-brass animate-pulse'
                            : hasToken
                              ? 'text-success hover:text-success/80'
                              : 'text-ink-muted/40 hover:text-brass/60'
                        )}
                        title={
                          isExtracting
                            ? 'Extracting...'
                            : hasToken
                              ? 'View token (already extracted)'
                              : 'Extract as design token'
                        }
                      >
                        {isExtracting ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : hasToken ? (
                          <CheckCircle size={12} />
                        ) : (
                          <Sparkles size={12} />
                        )}
                      </button>
                      <button
                        onClick={() => setExpandedDimension(isExpanded ? null : axis)}
                        className={clsx(
                          'flex-1 text-left text-xs transition-colors truncate',
                          liked ? 'text-brass-dark font-medium' : 'text-ink-secondary hover:text-ink'
                        )}
                      >
                        {dim.name}
                      </button>
                    </div>
                    {isExpanded && (
                      <p className="mt-1 ml-14 text-[0.65rem] text-ink-muted leading-snug">
                        {dim.description}
                      </p>
                    )}
                  </div>
                );
              })}
              {/* Visual affordance: show when liked dimensions will be sent to AI */}
              {hasLikedDimensions && (
                <p className="text-[0.6rem] text-brass/80 mt-2">
                  ♥ preferences sent to AI when used as context
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-ink-muted/50 italic">
              Dimensions appear on new generations
            </p>
          )}
        </div>
      </div>

      {/* Token detail modal */}
      {selectedToken && (
        <TokenDetailView
          token={selectedToken}
          onClose={() => setSelectedToken(null)}
        />
      )}
    </div>
  );
}
