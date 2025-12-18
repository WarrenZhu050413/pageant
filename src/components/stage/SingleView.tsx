import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Trash2,
  Download,
  Plus,
  FolderPlus,
  FolderMinus,
  ChevronDown,
  ChevronUp,
  Images,
  Search,
  Loader2,
  Check,
} from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';
import { IconButton, Dialog, Button, Input } from '../ui';
import { DesignAnnotation } from './DesignAnnotation';
import type { ImageData, DesignDimension } from '../../types';

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
  const deleteImage = useStore((s) => s.deleteImage);
  // Design dimension analysis
  const pendingAnalysis = useStore((s) => s.pendingAnalysis);
  const analyzeDimensions = useStore((s) => s.analyzeDimensions);
  const updateImageDimensions = useStore((s) => s.updateImageDimensions);
  const removeFromCurrentCollection = useStore((s) => s.removeFromCurrentCollection);
  const selectionMode = useStore((s) => s.selectionMode);
  const toggleSelection = useStore((s) => s.toggleSelection);
  const selectedIds = useStore((s) => s.selectedIds);
  const setContextImages = useStore((s) => s.setContextImages);
  const contextImageIds = useStore((s) => s.contextImageIds);
  const createCollection = useStore((s) => s.createCollection);
  const addImagesToCollection = useStore((s) => s.addImagesToCollection);

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

  // Build a map of all images for resolving context image IDs
  const allImagesMap = useMemo(() => {
    const map = new Map<string, ImageData>();
    for (const prompt of prompts) {
      for (const image of prompt.images) {
        map.set(image.id, image);
      }
    }
    return map;
  }, [prompts]);

  // Get context images used for this prompt's generation
  const promptContextImages = useMemo(() => {
    if (!currentPrompt?.context_image_ids) return [];
    return currentPrompt.context_image_ids
      .map((id) => allImagesMap.get(id))
      .filter((img): img is ImageData => img !== undefined);
  }, [currentPrompt?.context_image_ids, allImagesMap]);

  // State for context display - MUST be before any early returns (React hooks rule)
  const [isContextExpanded, setIsContextExpanded] = useState(false);

  // Collection dialog state
  const [isCollectionDialogOpen, setIsCollectionDialogOpen] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Sort collections newest first
  const sortedCollections = useMemo(() =>
    [...collections].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ),
    [collections]
  );

  if (!currentImage || displayImages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-ink-muted">No image to display</p>
      </div>
    );
  }

  const isSelected = selectedIds.has(currentImage.id);

  // The Gemini-generated variation used for this specific image (for copy button)
  const geminiGeneratedPrompt = currentImage.varied_prompt || '';

  const handleCopyPrompt = () => {
    if (geminiGeneratedPrompt) {
      navigator.clipboard.writeText(geminiGeneratedPrompt);
    }
  };

  const handleOpenCollectionDialog = () => {
    setSelectedCollectionId(null);
    setIsCreatingNew(collections.length === 0);
    setCollectionName('');
    setIsCollectionDialogOpen(true);
  };

  const handleSaveToCollection = async () => {
    if (!currentImage) return;

    if (isCreatingNew) {
      if (collectionName.trim()) {
        // Create collection with current image
        await createCollection(collectionName.trim(), '', [currentImage.id]);
        setCollectionName('');
        setIsCreatingNew(false);
        setIsCollectionDialogOpen(false);
      }
    } else if (selectedCollectionId) {
      await addImagesToCollection(selectedCollectionId, [currentImage.id]);
      setSelectedCollectionId(null);
      setIsCollectionDialogOpen(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Context Images Display - Above Image (only shown if context images exist) */}
      {promptContextImages.length > 0 && (
        <div className="border-b border-border bg-surface shrink-0">
          <button
            onClick={() => setIsContextExpanded(!isContextExpanded)}
            className={clsx(
              'w-full px-4 py-2 flex items-center justify-between',
              'cursor-pointer hover:bg-canvas-subtle/50 transition-colors text-left'
            )}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Images size={14} className="text-ink-muted shrink-0" />
              <span className="text-xs font-medium text-ink-muted uppercase tracking-wide shrink-0">
                Context
              </span>
              <span className="text-xs text-ink-tertiary">
                {promptContextImages.length} reference {promptContextImages.length === 1 ? 'image' : 'images'}
              </span>
            </div>
            {isContextExpanded ? (
              <ChevronUp size={16} className="text-ink-tertiary shrink-0 ml-2" />
            ) : (
              <ChevronDown size={16} className="text-ink-tertiary shrink-0 ml-2" />
            )}
          </button>

          {/* Expanded context images */}
          <AnimatePresence>
            {isContextExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-3 pt-1 border-t border-border/50">
                  <div className="flex gap-2 flex-wrap">
                    {promptContextImages.map((img) => (
                      <div
                        key={img.id}
                        className="relative group"
                        title={img.annotation || 'Context image'}
                      >
                        <img
                          src={getImageUrl(img.image_path)}
                          alt={img.annotation || 'Context'}
                          className="w-16 h-16 object-cover rounded-lg border border-border"
                        />
                        {img.annotation && (
                          <div className="absolute inset-0 bg-ink/70 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center p-1">
                            <p className="text-[0.5rem] text-surface text-center line-clamp-3 leading-tight">
                              {img.annotation}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

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
              'relative w-fit h-fit',
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
              className="block max-h-[calc(100vh-280px)] max-w-full h-auto w-auto object-contain rounded-xl"
            />

            {/* Overlay Actions */}
            <div className="absolute inset-0 bg-gradient-to-t from-ink/40 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity rounded-xl overflow-visible">
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-10">
                <div className="flex gap-2">
                  <IconButton
                    variant="default"
                    tooltip="Extract dimensions"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const dimensions = await analyzeDimensions(currentImage.id);
                      if (dimensions.length > 0) {
                        const dimensionsMap: Record<string, DesignDimension> = {};
                        for (const dim of dimensions) {
                          dimensionsMap[dim.axis] = dim;
                        }
                        await updateImageDimensions(currentImage.id, dimensionsMap);
                      }
                    }}
                    disabled={pendingAnalysis.has(currentImage.id)}
                    className="bg-surface/90 backdrop-blur-sm"
                  >
                    {pendingAnalysis.has(currentImage.id) ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Search size={18} />
                    )}
                  </IconButton>
                  <IconButton
                    variant="default"
                    tooltip="Add to context (A)"
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
                    tooltip="Save to collection"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenCollectionDialog();
                    }}
                    className="bg-surface/90 backdrop-blur-sm"
                  >
                    <FolderPlus size={18} />
                  </IconButton>
                  <IconButton
                    variant="default"
                    tooltip="Copy prompt"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyPrompt();
                    }}
                    className="bg-surface/90 backdrop-blur-sm"
                  >
                    <Copy size={18} />
                  </IconButton>
                  <a
                    href={getImageUrl(currentImage.image_path)}
                    download={`\${displayTitle}-\${currentImage.id}.\${currentImage.image_path.split('.').pop()}`}
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

        </div>
      </div>

      {/* Dot Navigation */}
      <div className="flex justify-center gap-2 py-2">
        {displayImages.map((img, index) => {
          const isActive = index === currentImageIndex;

          return (
            <button
              key={img.id}
              onClick={() => setCurrentImageIndex(index)}
              className={clsx(
                'w-2.5 h-2.5 rounded-full transition-all',
                isActive
                  ? 'bg-brass scale-125'
                  : 'bg-ink-muted/30 hover:bg-ink-muted/50'
              )}
            />
          );
        })}
      </div>

      {/* Design Annotation Tags */}
      <DesignAnnotation />

      {/* Collection dialog */}
      <Dialog
        isOpen={isCollectionDialogOpen}
        onClose={() => setIsCollectionDialogOpen(false)}
        title="Save to Collection"
      >
        <div className="space-y-4">
          {/* Existing collections */}
          {!isCreatingNew && sortedCollections.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-ink-secondary">
                Add to existing collection
              </label>
              <div className="max-h-[50vh] overflow-y-auto space-y-1">
                {sortedCollections.map((collection) => (
                  <button
                    key={collection.id}
                    onClick={() => setSelectedCollectionId(collection.id)}
                    className={clsx(
                      'w-full flex items-center justify-between px-3 py-2 rounded-lg text-left',
                      'transition-colors',
                      selectedCollectionId === collection.id
                        ? 'bg-brass-muted text-ink'
                        : 'hover:bg-canvas-muted text-ink-secondary'
                    )}
                  >
                    <div>
                      <p className="text-sm font-medium">{collection.name}</p>
                      <p className="text-xs text-ink-muted">
                        {collection.image_ids?.length || 0} images
                      </p>
                    </div>
                    {selectedCollectionId === collection.id && (
                      <Check size={16} className="text-brass-dark" />
                    )}
                  </button>
                ))}
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 py-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-ink-muted">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Create new button */}
              <button
                onClick={() => setIsCreatingNew(true)}
                className={clsx(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg',
                  'text-sm text-ink-secondary hover:bg-canvas-muted',
                  'transition-colors'
                )}
              >
                <Plus size={14} />
                Create new collection
              </button>
            </div>
          )}

          {/* Create new collection form */}
          {isCreatingNew && (
            <div className="space-y-3">
              {collections.length > 0 && (
                <button
                  onClick={() => setIsCreatingNew(false)}
                  className="text-xs text-ink-muted hover:text-ink-secondary"
                >
                  ← Back to existing collections
                </button>
              )}
              <Input
                label="Collection Name"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                placeholder="My Collection"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveToCollection();
                }}
              />
            </div>
          )}

          <div className="text-xs text-ink-muted">
            1 image will be added
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => setIsCollectionDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="brass"
              onClick={handleSaveToCollection}
              disabled={isCreatingNew ? !collectionName.trim() : !selectedCollectionId}
            >
              {isCreatingNew ? 'Create & Add' : 'Add to Collection'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
