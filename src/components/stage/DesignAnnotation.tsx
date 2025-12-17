import { useMemo, useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Check } from 'lucide-react';
import { useStore } from '../../store';
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

export function DesignAnnotation() {
  const prompts = useStore((s) => s.prompts);
  const collections = useStore((s) => s.collections);
  const currentPromptId = useStore((s) => s.currentPromptId);
  const currentCollectionId = useStore((s) => s.currentCollectionId);
  const currentImageIndex = useStore((s) => s.currentImageIndex);
  const toggleAxisLike = useStore((s) => s.toggleAxisLike);
  const updateImageNotes = useStore((s) => s.updateImageNotes);

  const [caption, setCaption] = useState('');
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

  // Sync caption with current image
  useEffect(() => {
    setCaption(currentImage?.caption || '');
  }, [currentImage?.id, currentImage?.caption]);

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
      await updateImageNotes(currentImage.id, currentImage.notes || '', caption);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentImage) return null;

  const hasAnnotations = currentImage.annotations && Object.keys(currentImage.annotations).length > 0;
  const hasChanges = caption !== (currentImage.caption || '');

  // Group annotations by axis for display
  const groupedAnnotations = useMemo(() => {
    if (!currentImage?.annotations) return [];
    return Object.entries(currentImage.annotations).filter(
      ([, tags]) => tags && tags.length > 0
    );
  }, [currentImage?.annotations]);

  return (
    <div className="px-6 py-3 space-y-3">
      {/* Note Input - Full width, 2 lines */}
      <div className="relative">
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && hasChanges) {
              e.preventDefault();
              handleSave();
            }
          }}
          placeholder="What stands out in this image?"
          rows={2}
          className={clsx(
            'w-full px-3 py-2 pr-12 rounded-lg resize-none',
            'bg-canvas-subtle border border-border/50',
            'text-sm text-ink placeholder:text-ink-muted/60',
            'focus:outline-none focus:ring-1 focus:ring-brass/30 focus:border-brass/50',
            'transition-all'
          )}
        />
        <div className="absolute right-2 top-2">
          {saved ? (
            <span className="text-xs text-success flex items-center gap-0.5">
              <Check size={12} />
            </span>
          ) : hasChanges ? (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-2 py-0.5 rounded text-xs font-medium bg-brass text-surface hover:bg-brass-dark"
            >
              {isSaving ? '...' : 'Save'}
            </button>
          ) : null}
        </div>
      </div>

      {/* Design Tags - Organized by Axis */}
      {hasAnnotations ? (
        <div className="space-y-1.5">
          {groupedAnnotations.map(([axis, tags]) => (
            <div key={axis} className="flex items-center gap-3">
              <span className="w-16 text-[0.65rem] text-ink-muted uppercase tracking-wide text-right shrink-0">
                {axis.replace('_', ' ')}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {tags.map((tag) => {
                  const liked = isTagLiked(tag, currentImage.liked_axes);
                  return (
                    <button
                      key={tag}
                      onClick={() => handleTagClick(tag)}
                      className={clsx(
                        'px-2.5 py-0.5 rounded-full text-xs transition-all',
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
        <p className="text-xs text-ink-muted/50 italic text-center py-2">
          Design tags will appear on new generations
        </p>
      )}
    </div>
  );
}
