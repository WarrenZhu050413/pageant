import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { useStore } from '../../store';

export function InfoSection() {
  const prompts = useStore((s) => s.prompts);
  const collections = useStore((s) => s.collections);
  const currentPromptId = useStore((s) => s.currentPromptId);
  const currentCollectionId = useStore((s) => s.currentCollectionId);
  const currentImageIndex = useStore((s) => s.currentImageIndex);

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

  // Get current image and its parent prompt
  const { currentImage, imagePrompt } = useMemo(() => {
    if (currentPrompt) {
      const image = currentPrompt.images[currentImageIndex] || null;
      return { currentImage: image, imagePrompt: currentPrompt };
    } else if (currentCollection) {
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
  const [isOriginalPromptExpanded, setIsOriginalPromptExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!imagePrompt || !currentImage) {
    return (
      <div className="border-t border-border">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={clsx(
            'w-full flex items-center justify-between px-4 py-2.5',
            'text-xs font-medium text-ink-secondary uppercase tracking-wide',
            'hover:bg-canvas-subtle transition-colors'
          )}
        >
          <span>Prompt</span>
          <ChevronDown
            size={14}
            className={clsx(
              'transition-transform duration-200',
              isExpanded && 'rotate-180'
            )}
          />
        </button>
        {isExpanded && (
          <div className="px-4 py-3 text-sm text-ink-muted">
            Select an image to view prompt
          </div>
        )}
      </div>
    );
  }

  const handleCopyPrompt = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const actualPrompt = currentImage.varied_prompt || imagePrompt.prompt;
  const originalPrompt = imagePrompt.prompt;
  const showOriginalPrompt = currentImage.varied_prompt && currentImage.varied_prompt !== originalPrompt;

  return (
    <div className="border-t border-border">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={clsx(
          'w-full flex items-center justify-between px-4 py-2.5',
          'text-xs font-medium text-ink-secondary uppercase tracking-wide',
          'hover:bg-canvas-subtle transition-colors'
        )}
      >
        <span>Prompt</span>
        <ChevronDown
          size={14}
          className={clsx(
            'transition-transform duration-200',
            isExpanded && 'rotate-180'
          )}
        />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden max-h-[50vh]"
          >
            <div className="px-4 pb-4 overflow-y-auto max-h-[calc(50vh-2rem)]">
              {/* Original User Prompt - Collapsible */}
              {showOriginalPrompt && (
                <div className="mb-3">
                  <button
                    onClick={() => setIsOriginalPromptExpanded(!isOriginalPromptExpanded)}
                    className={clsx(
                      'w-full flex items-center gap-1.5 text-left',
                      'text-xs font-medium text-ink-tertiary',
                      'hover:text-ink-secondary transition-colors'
                    )}
                  >
                    {isOriginalPromptExpanded ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                    Original User Prompt
                  </button>
                  <AnimatePresence>
                    {isOriginalPromptExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <p className="mt-2 pl-5 text-sm text-ink-secondary leading-relaxed">
                          {originalPrompt}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Actual Prompt (Gemini Generated) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-ink-tertiary">
                    {showOriginalPrompt ? 'Gemini Generated' : ''}
                  </span>
                  <button
                    onClick={() => handleCopyPrompt(actualPrompt)}
                    className={clsx(
                      'p-1.5 rounded transition-colors',
                      'text-ink-tertiary hover:text-ink hover:bg-canvas-muted'
                    )}
                    title="Copy prompt"
                  >
                    {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                  </button>
                </div>
                <p className="text-sm text-ink-secondary leading-relaxed">
                  {actualPrompt}
                </p>
                <div className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
