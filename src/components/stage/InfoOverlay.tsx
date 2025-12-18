import { useState, useEffect, useMemo } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, Copy, Check, Save, Image as ImageIcon, Sparkles, Loader2, Hexagon, Search, Bookmark } from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl, polishAnnotations } from '../../api';
import { Badge } from '../ui';
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

export function InfoOverlay() {
  // Select primitive values to avoid infinite re-renders
  const prompts = useStore((s) => s.prompts);
  const collections = useStore((s) => s.collections);
  const currentPromptId = useStore((s) => s.currentPromptId);
  const currentCollectionId = useStore((s) => s.currentCollectionId);
  const currentImageIndex = useStore((s) => s.currentImageIndex);
  const updateImageNotes = useStore((s) => s.updateImageNotes);
  const toggleAxisLike = useStore((s) => s.toggleAxisLike);
  // Design dimension actions
  const pendingAnalysis = useStore((s) => s.pendingAnalysis);
  const analyzeDimensions = useStore((s) => s.analyzeDimensions);
  const generateConcept = useStore((s) => s.generateConcept);
  const confirmDimension = useStore((s) => s.confirmDimension);
  const updateImageDimensions = useStore((s) => s.updateImageDimensions);
  // Design token extraction
  const extractDesignToken = useStore((s) => s.extractDesignToken);

  // Compute derived values with useMemo
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

  // Get current image and its parent prompt - works for both prompt and collection viewing
  const { currentImage, imagePrompt } = useMemo(() => {
    if (currentPrompt) {
      // Viewing a prompt - get image by index
      const image = currentPrompt.images[currentImageIndex] || null;
      return { currentImage: image, imagePrompt: currentPrompt };
    } else if (currentCollection) {
      // Viewing a collection - get image from collection's image_ids
      const imageId = currentCollection.image_ids[currentImageIndex];
      if (imageId) {
        const found = imageMap.get(imageId);
        if (found) {
          return { currentImage: found.image, imagePrompt: found.prompt };
        }
      }
    }
    return { currentImage: null, imagePrompt: null };
  }, [currentPrompt, currentCollection, currentImageIndex, imageMap]);

  // Get context images used for this prompt's generation
  const contextImages = useMemo(() => {
    if (!imagePrompt?.context_image_ids) return [];
    return imagePrompt.context_image_ids
      .map((id) => imageMap.get(id)?.image)
      .filter((img): img is typeof prompts[0]['images'][0] => img !== undefined);
  }, [imagePrompt?.context_image_ids, imageMap]);

  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const [annotation, setAnnotation] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);

  // Sync annotation with current image
  useEffect(() => {
    setAnnotation(currentImage?.annotation || '');
  }, [currentImage?.id, currentImage?.annotation]);

  if (!imagePrompt || !currentImage) return null;

  const handleCopyPrompt = () => {
    const text = currentImage.varied_prompt || imagePrompt.prompt;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateImageNotes(currentImage.id, currentImage.notes || '', annotation);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePolish = async () => {
    if (!annotation.trim()) return;
    setIsPolishing(true);
    try {
      const response = await polishAnnotations([currentImage.id]);
      if (response.success && response.polished.length > 0) {
        const polished = response.polished[0].polished_annotation;
        setAnnotation(polished);
        // Auto-save the polished annotation
        await updateImageNotes(currentImage.id, currentImage.notes || '', polished);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setIsPolishing(false);
    }
  };

  const handleTagClick = (tag: string) => {
    const axis = findAxisForTag(tag, currentImage.annotations);
    const isLiked = isTagLiked(tag, currentImage.liked_axes);
    toggleAxisLike(currentImage.id, axis, tag, !isLiked);
  };

  const handleAnalyze = async () => {
    if (!currentImage) return;
    const dimensions = await analyzeDimensions(currentImage.id);
    if (dimensions.length > 0) {
      // Save dimensions to image metadata (component re-renders from store update)
      const dimensionsMap: Record<string, DesignDimension> = {};
      for (const dim of dimensions) {
        dimensionsMap[dim.axis] = dim;
      }
      await updateImageDimensions(currentImage.id, dimensionsMap);
    }
  };

  const handleConfirmDimension = async (axis: string) => {
    if (!currentImage) return;
    await confirmDimension(currentImage.id, axis);
  };

  const handleGenerateConcept = async (dimension: DesignDimension) => {
    if (!currentImage) return;
    await generateConcept(currentImage.id, dimension);
  };

  const handleExtractToken = async () => {
    if (!currentImage) return;
    setIsExtracting(true);
    try {
      // Flatten liked_axes to a simple tag list
      const likedTags = currentImage.liked_axes
        ? Object.values(currentImage.liked_axes).flat()
        : undefined;

      const item = await extractDesignToken(
        currentImage.id,
        annotation || undefined,
        likedTags
      );

      if (item) {
        setExtracted(true);
        setTimeout(() => setExtracted(false), 2000);
      }
    } finally {
      setIsExtracting(false);
    }
  };

  // Check if extraction is viable (has annotation or liked tags)
  const canExtract = !!(annotation.trim() || (currentImage?.liked_axes && Object.keys(currentImage.liked_axes).length > 0));

  const displayPrompt = currentImage.varied_prompt || imagePrompt.prompt;

  // Check if there are unsaved changes
  const hasChanges = annotation !== (currentImage.annotation || '');

  return (
    <div className="border-t border-border bg-surface flex-shrink-0">
      {/* Header - click to toggle */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className={clsx(
          'px-4 py-2 flex items-center justify-between',
          'cursor-pointer hover:bg-canvas-subtle/50 transition-colors'
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-ink truncate">
            {imagePrompt.title}
          </h3>
          {currentImage.mood && (
            <Badge variant="secondary" size="sm">{currentImage.mood}</Badge>
          )}
          <span className="text-xs text-ink-muted">
            {imagePrompt.images.length} images
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopyPrompt();
            }}
            className={clsx(
              'p-1.5 rounded-md transition-colors',
              'text-ink-tertiary hover:text-ink hover:bg-canvas-muted'
            )}
            title="Copy prompt"
          >
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
          </button>
          {isExpanded ? (
            <ChevronDown size={16} className="text-ink-tertiary" />
          ) : (
            <ChevronUp size={16} className="text-ink-tertiary" />
          )}
        </div>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-2 border-t border-border/50">
              {/* Two-column grid: Prompt (50%) | Annotation + Design (50%) */}
              <div className="grid grid-cols-2 gap-5">
                {/* Column 1: Prompt + Context Images (50% width) */}
                <div className="min-w-0 space-y-2">
                  {/* Prompt text */}
                  <div>
                    <label className="block text-[0.6rem] font-medium text-ink-muted uppercase tracking-wide mb-1">
                      Prompt
                    </label>
                    <p className="text-[0.65rem] font-[family-name:var(--font-mono)] text-ink-secondary leading-relaxed line-clamp-4">
                      {displayPrompt}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2 text-[0.55rem] text-ink-muted">
                      <span>
                        {new Date(imagePrompt.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <span>·</span>
                      <span className="font-[family-name:var(--font-mono)]">
                        {currentImage.id.slice(0, 8)}
                      </span>
                    </div>
                  </div>

                  {/* Context Images */}
                  {contextImages.length > 0 && (
                    <div>
                      <label className="flex items-center gap-1 text-[0.6rem] font-medium text-ink-muted uppercase tracking-wide mb-1">
                        <ImageIcon size={10} />
                        Context Images ({contextImages.length})
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {contextImages.map((img) => (
                          <img
                            key={img.id}
                            src={getImageUrl(img.image_path)}
                            alt=""
                            className="w-10 h-10 rounded object-cover border border-border"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Column 2: Annotation + Design (50% width, stacked) */}
                <div className="min-w-0 space-y-3">
                  {/* Annotation */}
                  <div>
                    <label className="block text-[0.6rem] font-medium text-ink-muted uppercase tracking-wide mb-1">
                      Annotation
                      <span className="ml-1 text-brass font-normal">(sent to AI)</span>
                    </label>
                    <textarea
                      value={annotation}
                      onChange={(e) => setAnnotation(e.target.value)}
                      placeholder="Context for AI iterations..."
                      className={clsx(
                        'w-full px-2 py-1.5 rounded-md',
                        'bg-canvas-subtle border border-border',
                        'text-[0.65rem] text-ink placeholder:text-ink-muted',
                        'focus:outline-none focus:ring-1 focus:ring-brass/30 focus:border-brass',
                        'resize-none transition-colors'
                      )}
                      rows={2}
                    />
                    {/* Save and Polish buttons */}
                    <div className="mt-1 flex items-center gap-1.5">
                      <button
                        onClick={handleSave}
                        disabled={!hasChanges || isSaving}
                        className={clsx(
                          'flex items-center gap-1 px-2 py-0.5 rounded text-[0.55rem] font-medium transition-all',
                          hasChanges
                            ? 'bg-brass text-surface hover:bg-brass-dark'
                            : 'bg-canvas-muted text-ink-muted cursor-not-allowed',
                          saved && 'bg-success'
                        )}
                      >
                        {saved ? (
                          <>
                            <Check size={9} />
                            Saved
                          </>
                        ) : isSaving ? (
                          'Saving...'
                        ) : (
                          <>
                            <Save size={9} />
                            Save
                          </>
                        )}
                      </button>
                      {/* Polish button - only show when annotation has content */}
                      {annotation.trim() && (
                        <button
                          onClick={handlePolish}
                          disabled={isPolishing}
                          className={clsx(
                            'flex items-center gap-1 px-2 py-0.5 rounded text-[0.55rem] font-medium transition-all',
                            'bg-brass/10 text-brass hover:bg-brass/20',
                            isPolishing && 'opacity-50'
                          )}
                          title="Polish annotation with AI"
                        >
                          {isPolishing ? (
                            <Loader2 size={9} className="animate-spin" />
                          ) : (
                            <Sparkles size={9} />
                          )}
                          Polish
                        </button>
                      )}
                      {/* Extract Token button - show when there's annotation or liked tags */}
                      {canExtract && (
                        <button
                          onClick={handleExtractToken}
                          disabled={isExtracting}
                          className={clsx(
                            'flex items-center gap-1 px-2 py-0.5 rounded text-[0.55rem] font-medium transition-all',
                            extracted
                              ? 'bg-success text-surface'
                              : 'bg-brass/10 text-brass hover:bg-brass/20',
                            isExtracting && 'opacity-50'
                          )}
                          title="Extract design token to library"
                        >
                          {extracted ? (
                            <>
                              <Check size={9} />
                              Saved
                            </>
                          ) : isExtracting ? (
                            <Loader2 size={9} className="animate-spin" />
                          ) : (
                            <Bookmark size={9} />
                          )}
                          {!extracted && 'Extract Token'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Design Dimensions */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[0.6rem] font-medium text-ink-muted uppercase tracking-wide">
                        Design
                      </label>
                      <button
                        onClick={handleAnalyze}
                        disabled={pendingAnalysis.has(currentImage.id)}
                        className={clsx(
                          'flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.5rem] font-medium transition-all',
                          'bg-brass/10 text-brass hover:bg-brass/20',
                          pendingAnalysis.has(currentImage.id) && 'opacity-50'
                        )}
                        title="Analyze design dimensions with AI"
                      >
                        {pendingAnalysis.has(currentImage.id) ? (
                          <Loader2 size={8} className="animate-spin" />
                        ) : (
                          <Search size={8} />
                        )}
                        Analyze
                      </button>
                    </div>

                    {/* Show design_dimensions if available */}
                    {currentImage.design_dimensions && Object.keys(currentImage.design_dimensions).length > 0 ? (
                      <div className="space-y-1.5 max-h-[6rem] overflow-y-auto">
                        {Object.entries(currentImage.design_dimensions).map(([axis, dim]) => (
                          <div
                            key={axis}
                            className={clsx(
                              'p-1.5 rounded border',
                              dim.confirmed
                                ? 'border-brass/50 bg-brass/5'
                                : 'border-dashed border-border bg-canvas-subtle'
                            )}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <div className="min-w-0 flex-1">
                                <span className="text-[0.5rem] text-ink-muted capitalize">{axis}</span>
                                <span className="text-[0.55rem] text-ink font-medium ml-1">"{dim.name}"</span>
                              </div>
                              <div className="flex items-center gap-1">
                                {!dim.confirmed && (
                                  <button
                                    onClick={() => handleConfirmDimension(axis)}
                                    className="text-[0.5rem] px-1 py-0.5 rounded bg-success/20 text-success hover:bg-success/30"
                                    title="Confirm this dimension"
                                  >
                                    <Check size={8} />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleGenerateConcept(dim)}
                                  className="text-[0.5rem] px-1 py-0.5 rounded bg-brass/20 text-brass hover:bg-brass/30"
                                  title="Generate concept image"
                                >
                                  <Hexagon size={8} />
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-0.5 mt-0.5">
                              {dim.tags.map((tag) => {
                                const liked = isTagLiked(tag, currentImage.liked_axes);
                                return (
                                  <button
                                    key={tag}
                                    onClick={() => handleTagClick(tag)}
                                    className={clsx(
                                      'px-1 py-0.5 rounded-full text-[0.5rem] transition-all border',
                                      liked
                                        ? 'bg-brass/20 border-brass text-brass-dark font-medium'
                                        : 'bg-canvas-subtle border-border text-ink-secondary hover:border-ink-muted'
                                    )}
                                  >
                                    {liked && <span className="mr-0.5">●</span>}
                                    {tag}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : currentImage.annotations && Object.keys(currentImage.annotations).length > 0 ? (
                      /* Fallback to legacy annotations */
                      <div className="space-y-1 max-h-[5rem] overflow-y-auto">
                        {Object.entries(currentImage.annotations).map(([axis, tags]) => (
                          tags && tags.length > 0 && (
                            <div key={axis}>
                              <span className="text-[0.5rem] text-ink-muted capitalize">{axis.replace('_', ' ')}</span>
                              <div className="flex flex-wrap gap-0.5 mt-0.5">
                                {tags.map((tag) => {
                                  const liked = isTagLiked(tag, currentImage.liked_axes);
                                  return (
                                    <button
                                      key={tag}
                                      onClick={() => handleTagClick(tag)}
                                      className={clsx(
                                        'px-1.5 py-0.5 rounded-full text-[0.55rem] transition-all',
                                        'border',
                                        liked
                                          ? 'bg-brass/20 border-brass text-brass-dark font-medium'
                                          : 'bg-canvas-subtle border-border text-ink-secondary hover:border-ink-muted'
                                      )}
                                    >
                                      {liked && <span className="mr-0.5">●</span>}
                                      {tag}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )
                        ))}
                      </div>
                    ) : (
                      <p className="text-[0.55rem] text-ink-muted italic">
                        Click Analyze to identify design dimensions
                      </p>
                    )}
                    <p className="mt-0.5 text-[0.5rem] text-ink-muted">
                      Click tags to like • ⬡ generates concept
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
