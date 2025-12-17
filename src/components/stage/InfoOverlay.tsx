import { useState, useEffect, useMemo } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, Copy, Check, Save } from 'lucide-react';
import { useStore } from '../../store';
import { Badge } from '../ui';
import { SUGGESTED_TAGS, type DesignAxis } from '../../types';

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

  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const [caption, setCaption] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync caption with current image
  useEffect(() => {
    setCaption(currentImage?.caption || '');
  }, [currentImage?.id, currentImage?.caption]);

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
      await updateImageNotes(currentImage.id, currentImage.notes || '', caption);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTagClick = (tag: string) => {
    const axis = findAxisForTag(tag, currentImage.annotations);
    const isLiked = isTagLiked(tag, currentImage.liked_axes);
    toggleAxisLike(currentImage.id, axis, tag, !isLiked);
  };

  const displayPrompt = currentImage.varied_prompt || imagePrompt.prompt;

  // Check if there are unsaved changes
  const hasChanges = caption !== (currentImage.caption || '');

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
              {/* Three-column grid: Prompt | Annotation | Design */}
              <div className="grid grid-cols-3 gap-5">
                {/* Column 1: Prompt */}
                <div className="min-w-0">
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

                {/* Column 2: Annotation */}
                <div className="min-w-0">
                  <label className="block text-[0.6rem] font-medium text-ink-muted uppercase tracking-wide mb-1">
                    Annotation
                    <span className="ml-1 text-brass font-normal">(sent to AI)</span>
                  </label>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Context for AI iterations..."
                    className={clsx(
                      'w-full px-2 py-1.5 rounded-md',
                      'bg-canvas-subtle border border-border',
                      'text-[0.65rem] text-ink placeholder:text-ink-muted',
                      'focus:outline-none focus:ring-1 focus:ring-brass/30 focus:border-brass',
                      'resize-none transition-colors'
                    )}
                    rows={3}
                  />
                  {/* Save button directly below caption */}
                  <button
                    onClick={handleSave}
                    disabled={!hasChanges || isSaving}
                    className={clsx(
                      'mt-1.5 flex items-center gap-1 px-2 py-1 rounded text-[0.6rem] font-medium transition-all',
                      hasChanges
                        ? 'bg-brass text-surface hover:bg-brass-dark'
                        : 'bg-canvas-muted text-ink-muted cursor-not-allowed',
                      saved && 'bg-success'
                    )}
                  >
                    {saved ? (
                      <>
                        <Check size={10} />
                        Saved
                      </>
                    ) : isSaving ? (
                      'Saving...'
                    ) : (
                      <>
                        <Save size={10} />
                        Save Annotation
                      </>
                    )}
                  </button>
                </div>

                {/* Column 3: Design Tags - Grouped by Axis */}
                <div className="min-w-0">
                  <label className="block text-[0.6rem] font-medium text-ink-muted uppercase tracking-wide mb-1">
                    Design
                  </label>
                  {currentImage.annotations && Object.keys(currentImage.annotations).length > 0 ? (
                    <div className="space-y-1.5 max-h-[7.8rem] overflow-y-auto">
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
                    <p className="text-[0.6rem] text-ink-muted italic">
                      Tags appear on new generations
                    </p>
                  )}
                  <p className="mt-1 text-[0.5rem] text-ink-muted">
                    Click to like for taste profile
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
