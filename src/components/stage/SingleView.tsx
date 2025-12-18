import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Star,
  Copy,
  Sparkles,
  Trash2,
  Download,
  Plus,
  FolderMinus,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';
import { IconButton } from '../ui';
import { DesignAnnotation } from './DesignAnnotation';

export function SingleView() {
  // Select primitive values and stable arrays to avoid infinite re-renders
  const prompts = useStore((s) => s.prompts);
  const collections = useStore((s) => s.collections);
  const currentPromptId = useStore((s) => s.currentPromptId);
  const currentCollectionId = useStore((s) => s.currentCollectionId);
  const currentImageIndex = useStore((s) => s.currentImageIndex);
  const setCurrentImageIndex = useStore((s) => s.setCurrentImageIndex);
  const nextImage = useStore((s) => s.nextImage);
  const prevImage = useStore((s) => s.prevImage);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const isImageFavorite = useStore((s) => s.isImageFavorite);
  const iterate = useStore((s) => s.iterate);
  const deleteImage = useStore((s) => s.deleteImage);
  const removeFromCurrentCollection = useStore((s) => s.removeFromCurrentCollection);
  const selectionMode = useStore((s) => s.selectionMode);
  const toggleSelection = useStore((s) => s.toggleSelection);
  const selectedIds = useStore((s) => s.selectedIds);
  const setContextImages = useStore((s) => s.setContextImages);
  const contextImageIds = useStore((s) => s.contextImageIds);

  // Compute derived values with useMemo to avoid infinite re-renders
  const currentPrompt = useMemo(
    () => prompts.find((p) => p.id === currentPromptId) || null,
    [prompts, currentPromptId]
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

  // Support both prompt and collection viewing
  const displayImages = currentPrompt?.images ?? currentCollectionImages;
  const displayTitle = currentPrompt?.title ?? currentCollection?.name ?? 'Image';
  const isViewingCollection = !currentPrompt && !!currentCollection;

  const currentImage = displayImages[currentImageIndex] || null;

  // State for prompt display - MUST be before any early returns (React hooks rule)
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [copiedField, setCopiedField] = useState<'original' | 'generated' | null>(null);

  if (!currentImage || displayImages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-ink-muted">No image to display</p>
      </div>
    );
  }

  const isFavorite = isImageFavorite(currentImage.id);
  const isSelected = selectedIds.has(currentImage.id);

  // The original user prompt (what user typed in the prompt box)
  const originalUserPrompt = currentPrompt?.basePrompt || currentPrompt?.prompt || '';
  // The Gemini-generated variation used for this specific image
  const geminiGeneratedPrompt = currentImage.varied_prompt || '';

  const handleCopyPrompt = (type: 'original' | 'generated') => {
    const text = type === 'original' ? originalUserPrompt : geminiGeneratedPrompt;
    if (text) {
      navigator.clipboard.writeText(text);
      setCopiedField(type);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Prompt Display - Above Image */}
      <div className="border-b border-border bg-surface shrink-0">
        <button
          onClick={() => setIsPromptExpanded(!isPromptExpanded)}
          className={clsx(
            'w-full px-4 py-2 flex items-center justify-between',
            'cursor-pointer hover:bg-canvas-subtle/50 transition-colors text-left'
          )}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="text-xs font-medium text-ink-muted uppercase tracking-wide shrink-0">
              Prompt
            </span>
            <p className="text-sm text-ink-secondary truncate">
              {originalUserPrompt.slice(0, 80)}{originalUserPrompt.length > 80 ? '...' : ''}
            </p>
          </div>
          {isPromptExpanded ? (
            <ChevronUp size={16} className="text-ink-tertiary shrink-0 ml-2" />
          ) : (
            <ChevronDown size={16} className="text-ink-tertiary shrink-0 ml-2" />
          )}
        </button>

        {/* Expanded prompt content */}
        <AnimatePresence>
          {isPromptExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3 pt-1 border-t border-border/50 space-y-3">
                {/* Original User Prompt */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[0.6rem] font-medium text-ink-muted uppercase tracking-wide">
                      Original User Prompt
                    </label>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyPrompt('original');
                      }}
                      className="p-1 rounded text-ink-tertiary hover:text-ink hover:bg-canvas-muted transition-colors"
                      title="Copy original prompt"
                    >
                      {copiedField === 'original' ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                    </button>
                  </div>
                  <p className="text-xs text-ink-secondary leading-relaxed">
                    {originalUserPrompt || <span className="italic text-ink-muted">No prompt</span>}
                  </p>
                </div>

                {/* Gemini Generated Variation */}
                {geminiGeneratedPrompt && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[0.6rem] font-medium text-brass uppercase tracking-wide">
                        Gemini Generated
                      </label>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyPrompt('generated');
                        }}
                        className="p-1 rounded text-ink-tertiary hover:text-ink hover:bg-canvas-muted transition-colors"
                        title="Copy generated prompt"
                      >
                        {copiedField === 'generated' ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                      </button>
                    </div>
                    <p className="text-xs text-ink leading-relaxed">
                      {geminiGeneratedPrompt}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Image Container */}
      <div className="flex-1 relative min-h-0 overflow-hidden">
        <div className="absolute inset-4 flex items-center justify-center">
        {/* Navigation - Previous */}
        {currentImageIndex > 0 && (
          <button
            onClick={prevImage}
            className={clsx(
              'absolute left-4 top-1/2 -translate-y-1/2 z-10',
              'w-10 h-10 rounded-full',
              'bg-surface/90 backdrop-blur-sm shadow-md',
              'flex items-center justify-center',
              'text-ink-secondary hover:text-ink',
              'transition-all hover:scale-105'
            )}
          >
            <ChevronLeft size={20} />
          </button>
        )}

        {/* Image */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentImage.id}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className={clsx(
              'relative max-h-full max-w-full',
              'rounded-xl shadow-lg',
              selectionMode !== 'none' && 'cursor-pointer',
              isSelected && 'ring-4 ring-brass'
            )}
            onClick={() => {
              if (selectionMode !== 'none') {
                toggleSelection(currentImage.id);
              }
            }}
          >
            <img
              src={getImageUrl(currentImage.image_path)}
              alt={displayTitle}
              className="max-h-full max-w-full object-contain rounded-xl"
            />

            {/* Overlay Actions */}
            <div className="absolute inset-0 bg-gradient-to-t from-ink/40 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity rounded-xl">
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <div className="flex gap-2">
                  <IconButton
                    variant="default"
                    tooltip="More like this"
                    onClick={(e) => {
                      e.stopPropagation();
                      iterate(currentImage.id);
                    }}
                    className="bg-surface/90 backdrop-blur-sm"
                  >
                    <Sparkles size={18} />
                  </IconButton>
                  <IconButton
                    variant="default"
                    tooltip="Add to context"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!contextImageIds.includes(currentImage.id)) {
                        setContextImages([...contextImageIds, currentImage.id]);
                      }
                    }}
                    className="bg-surface/90 backdrop-blur-sm"
                  >
                    <Plus size={18} />
                  </IconButton>
                  <IconButton
                    variant="default"
                    tooltip="Copy prompt"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyPrompt('generated');
                    }}
                    className="bg-surface/90 backdrop-blur-sm"
                  >
                    <Copy size={18} />
                  </IconButton>
                  <a
                    href={getImageUrl(currentImage.image_path)}
                    download={`${displayTitle}-${currentImage.id}.${currentImage.image_path.split('.').pop()}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex"
                  >
                    <IconButton
                      variant="default"
                      tooltip="Download"
                      className="bg-surface/90 backdrop-blur-sm"
                    >
                      <Download size={18} />
                    </IconButton>
                  </a>
                  {isViewingCollection ? (
                    <IconButton
                      variant="default"
                      tooltip="Remove from collection"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromCurrentCollection(currentImage.id);
                      }}
                      className="bg-surface/90 backdrop-blur-sm text-ink-secondary hover:text-danger"
                    >
                      <FolderMinus size={18} />
                    </IconButton>
                  ) : (
                    <IconButton
                      variant="danger"
                      tooltip="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteImage(currentImage.id);
                      }}
                      className="bg-surface/90 backdrop-blur-sm"
                    >
                      <Trash2 size={18} />
                    </IconButton>
                  )}
                </div>
              </div>
            </div>

            {/* Selection indicator */}
            {selectionMode !== 'none' && (
              <div
                className={clsx(
                  'absolute top-4 left-4 w-6 h-6 rounded-full border-2',
                  'flex items-center justify-center transition-all',
                  isSelected
                    ? 'bg-brass border-brass text-surface'
                    : 'bg-surface/80 border-ink-muted'
                )}
              >
                {isSelected && (
                  <motion.svg
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    viewBox="0 0 24 24"
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </motion.svg>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation - Next */}
        {currentImageIndex < displayImages.length - 1 && (
          <button
            onClick={nextImage}
            className={clsx(
              'absolute right-4 top-1/2 -translate-y-1/2 z-10',
              'w-10 h-10 rounded-full',
              'bg-surface/90 backdrop-blur-sm shadow-md',
              'flex items-center justify-center',
              'text-ink-secondary hover:text-ink',
              'transition-all hover:scale-105'
            )}
          >
            <ChevronRight size={20} />
          </button>
        )}

        {/* Favorite Button */}
        <button
          onClick={() => toggleFavorite(currentImage.id)}
          className={clsx(
            'absolute top-4 right-4 z-10',
            'w-12 h-12 rounded-full',
            'flex items-center justify-center',
            'transition-all duration-200',
            isFavorite
              ? 'bg-favorite text-surface shadow-lg scale-110'
              : 'bg-surface/90 backdrop-blur-sm text-ink-muted hover:text-favorite shadow-md'
          )}
        >
          <Star size={24} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
        </div>
      </div>

      {/* Dot Navigation */}
      <div className="flex justify-center gap-2 py-2">
        {displayImages.map((img, index) => {
          const isActive = index === currentImageIndex;
          const imgIsFavorite = isImageFavorite(img.id);

          return (
            <button
              key={img.id}
              onClick={() => setCurrentImageIndex(index)}
              className={clsx(
                'w-2.5 h-2.5 rounded-full transition-all',
                isActive
                  ? 'bg-brass scale-125'
                  : 'bg-ink-muted/30 hover:bg-ink-muted/50',
                imgIsFavorite && !isActive && 'ring-2 ring-favorite/50'
              )}
            />
          );
        })}
      </div>

      {/* Design Annotation Tags */}
      <DesignAnnotation />
    </div>
  );
}
