import { useState, useEffect, useMemo } from 'react';
import { clsx } from 'clsx';
import { Bookmark, Trash2, Image as ImageIcon, Type, Palette, FileText, GitBranch } from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';
import { Badge, Button, Input, Textarea, Dialog } from '../ui';
import type { LibraryItemType } from '../../types';

const TYPE_CONFIG: Record<LibraryItemType, { label: string; icon: React.ReactNode; description: string }> = {
  fragment: { label: 'Fragment', icon: <Type size={14} />, description: 'A reusable text snippet' },
  preset: { label: 'Preset', icon: <Palette size={14} />, description: 'Style tags for quick application' },
  template: { label: 'Template', icon: <FileText size={14} />, description: 'Full prompt template' },
};

export function InfoTab() {
  // Select primitive values to avoid infinite re-renders
  const prompts = useStore((s) => s.prompts);
  const collections = useStore((s) => s.collections);
  const currentPromptId = useStore((s) => s.currentPromptId);
  const currentCollectionId = useStore((s) => s.currentCollectionId);
  const currentImageIndex = useStore((s) => s.currentImageIndex);
  const updateImageNotes = useStore((s) => s.updateImageNotes);
  const deletePrompt = useStore((s) => s.deletePrompt);
  const setCurrentPrompt = useStore((s) => s.setCurrentPrompt);
  const setCurrentImageIndex = useStore((s) => s.setCurrentImageIndex);

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

  // Get current image - works for both prompt and collection viewing
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

  // Find reference images for this prompt (use imagePrompt for collection viewing)
  const referenceImages = useMemo(() => {
    const prompt = imagePrompt;
    if (!prompt) return [];

    const contextIds = prompt.context_image_ids || [];
    const inputId = prompt.input_image_id;

    // Combine input_image_id with context_image_ids (input first if it exists)
    const allIds = inputId && !contextIds.includes(inputId)
      ? [inputId, ...contextIds]
      : contextIds;

    // Find the actual images across all prompts
    return allIds
      .map((id) => {
        for (const p of prompts) {
          const img = p.images.find((i) => i.id === id);
          if (img) {
            return { image: img, promptId: p.id, promptTitle: p.title };
          }
        }
        return null;
      })
      .filter(Boolean) as { image: { id: string; image_path: string }; promptId: string; promptTitle: string }[];
  }, [imagePrompt, prompts]);

  // Build the prompt evolution chain by tracing parent_prompt_id
  const promptEvolutionChain = useMemo(() => {
    const prompt = imagePrompt;
    if (!prompt) return [];

    const chain: { id: string; title: string; prompt: string }[] = [];
    let current = prompt;

    // First, add current prompt
    chain.unshift({ id: current.id, title: current.title, prompt: current.prompt });

    // Then trace back through parents
    while (current.parent_prompt_id) {
      const parent = prompts.find((p) => p.id === current.parent_prompt_id);
      if (parent) {
        chain.unshift({ id: parent.id, title: parent.title, prompt: parent.prompt });
        current = parent;
      } else {
        break;
      }
    }

    // Only return if there's more than just the current prompt (meaning there's evolution)
    return chain.length > 1 ? chain : [];
  }, [imagePrompt, prompts]);

  const handleReferenceImageClick = (promptId: string, imageId: string) => {
    setCurrentPrompt(promptId);
    const prompt = prompts.find((p) => p.id === promptId);
    if (prompt) {
      const index = prompt.images.findIndex((img) => img.id === imageId);
      if (index !== -1) {
        setCurrentImageIndex(index);
      }
    }
  };

  const [notes, setNotes] = useState('');
  const [caption, setCaption] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSaveToLibraryDialogOpen, setIsSaveToLibraryDialogOpen] = useState(false);
  const [libraryItemType, setLibraryItemType] = useState<LibraryItemType>('template');
  const [libraryItemName, setLibraryItemName] = useState('');
  const [libraryItemContent, setLibraryItemContent] = useState('');
  const [libraryItemTags, setLibraryItemTags] = useState('');

  const createLibraryItem = useStore((s) => s.createLibraryItem);

  // Sync local state with current image
  useEffect(() => {
    if (currentImage) {
      setNotes(currentImage.notes || '');
      setCaption(currentImage.caption || '');
    }
  }, [currentImage?.id]);

  // Save notes on blur
  const handleNotesBlur = () => {
    if (currentImage && (notes !== currentImage.notes || caption !== currentImage.caption)) {
      updateImageNotes(currentImage.id, notes, caption);
    }
  };

  const handleSaveToLibrary = async () => {
    if (!libraryItemName.trim()) return;

    const data: Parameters<typeof createLibraryItem>[0] = {
      type: libraryItemType,
      name: libraryItemName.trim(),
    };

    if (libraryItemType === 'fragment') {
      data.text = libraryItemContent || imagePrompt?.prompt || '';
    } else if (libraryItemType === 'preset') {
      data.style_tags = libraryItemTags.split(',').map((t) => t.trim()).filter(Boolean);
    } else if (libraryItemType === 'template') {
      data.prompt = libraryItemContent || imagePrompt?.prompt || '';
    }

    await createLibraryItem(data);
    setLibraryItemName('');
    setLibraryItemContent('');
    setLibraryItemTags('');
    setIsSaveToLibraryDialogOpen(false);
  };

  // Listen for save-template event from keyboard shortcut
  useEffect(() => {
    const handler = () => {
      // Pre-fill with current prompt content
      if (imagePrompt) {
        setLibraryItemContent(imagePrompt.prompt);
        setLibraryItemName(imagePrompt.title);
      }
      setIsSaveToLibraryDialogOpen(true);
    };
    document.addEventListener('save-template', handler);
    return () => document.removeEventListener('save-template', handler);
  }, [imagePrompt]);

  // Show empty state only if there's no image to display
  if (!currentImage || !imagePrompt) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-sm text-ink-secondary">No image selected</p>
          <p className="text-xs text-ink-muted mt-1">
            Select a prompt or collection to view details
          </p>
        </div>
      </div>
    );
  }

  // Viewing mode - either prompt or collection
  const isViewingCollection = !currentPrompt && !!currentCollection;

  return (
    <div className="p-4 space-y-6">
      {/* Prompt Info */}
      <section>
        <div className="mb-2">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
            {imagePrompt.title}
          </h3>
          {isViewingCollection && (
            <p className="text-xs text-ink-muted">
              From collection: {currentCollection?.name}
            </p>
          )}
        </div>

        <div className="p-3 rounded-lg bg-canvas-subtle">
          <p className="text-xs font-[family-name:var(--font-mono)] text-ink-secondary leading-relaxed whitespace-pre-wrap">
            {currentImage.varied_prompt || imagePrompt.prompt}
          </p>
          {currentImage.varied_prompt && currentImage.varied_prompt !== imagePrompt.prompt && (
            <p className="text-[0.6rem] text-ink-muted mt-2 italic">
              Varied from base prompt
            </p>
          )}
        </div>
      </section>

      {/* Reference Images */}
      {referenceImages.length > 0 && (
        <section>
          <h4 className="text-xs font-medium text-ink-tertiary uppercase tracking-wide mb-2">
            <ImageIcon size={12} className="inline mr-1" />
            Reference Images ({referenceImages.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {referenceImages.map(({ image, promptId, promptTitle }) => (
              <button
                key={image.id}
                onClick={() => handleReferenceImageClick(promptId, image.id)}
                className={clsx(
                  'relative w-16 h-16 rounded-lg overflow-hidden',
                  'bg-canvas-muted',
                  'ring-2 ring-brass/30 hover:ring-brass',
                  'transition-all hover:scale-105',
                  'group'
                )}
                title={promptTitle}
              >
                <img
                  src={getImageUrl(image.image_path)}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/20 transition-colors" />
              </button>
            ))}
          </div>
          <p className="text-[0.65rem] text-ink-muted mt-2">
            These images were used as context for generation. Click to view.
          </p>
        </section>
      )}

      {/* Prompt Evolution Chain */}
      {promptEvolutionChain.length > 0 && (
        <section>
          <h4 className="text-xs font-medium text-ink-tertiary uppercase tracking-wide mb-2">
            <GitBranch size={12} className="inline mr-1" />
            Prompt Evolution
          </h4>
          <div className="space-y-2">
            {promptEvolutionChain.map((step, index) => {
              const isCurrent = step.id === imagePrompt?.id;
              return (
                <div key={step.id} className="flex items-start gap-2">
                  {/* Step indicator */}
                  <div className="flex flex-col items-center pt-1">
                    <div
                      className={clsx(
                        'w-2.5 h-2.5 rounded-full border-2',
                        isCurrent
                          ? 'bg-brass border-brass'
                          : 'bg-canvas-muted border-ink-muted'
                      )}
                    />
                    {index < promptEvolutionChain.length - 1 && (
                      <div className="w-px h-full min-h-[24px] bg-ink-muted/30 my-1" />
                    )}
                  </div>
                  {/* Step content */}
                  <button
                    onClick={() => !isCurrent && setCurrentPrompt(step.id)}
                    className={clsx(
                      'flex-1 text-left p-2 rounded-md transition-colors',
                      isCurrent
                        ? 'bg-brass-muted/50 cursor-default'
                        : 'bg-canvas-subtle hover:bg-canvas-muted cursor-pointer'
                    )}
                  >
                    <p className="text-[0.65rem] text-ink-muted font-medium">
                      {index === 0 ? 'Original' : `Iteration ${index}`}
                      {isCurrent && ' (Current)'}
                    </p>
                    <p className="text-xs text-ink-secondary font-[family-name:var(--font-mono)] line-clamp-2">
                      {step.prompt.slice(0, 80)}...
                    </p>
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-[0.65rem] text-ink-muted mt-2">
            Click to navigate to a previous iteration.
          </p>
        </section>
      )}

      {/* Image-specific info */}
      {currentImage && (
        <>
          {/* Variation badges */}
          {(currentImage.mood || currentImage.variation_type) && (
            <div className="flex gap-2 -mt-4">
              {currentImage.mood && (
                <Badge>{currentImage.mood}</Badge>
              )}
              {currentImage.variation_type && (
                <Badge>{currentImage.variation_type}</Badge>
              )}
            </div>
          )}

          {/* Notes */}
          <section>
            <Textarea
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Add notes about this image..."
              className="min-h-[80px]"
            />
          </section>

          {/* Annotation */}
          <section>
            <Input
              label="Annotation"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Short annotation for AI context"
            />
          </section>
        </>
      )}

      {/* Actions */}
      <section className="pt-4 border-t border-border space-y-2">
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Bookmark size={14} />}
          onClick={() => {
            // Pre-fill with current prompt content
            if (imagePrompt) {
              setLibraryItemContent(imagePrompt.prompt);
              setLibraryItemName(imagePrompt.title);
            }
            setIsSaveToLibraryDialogOpen(true);
          }}
          className="w-full justify-center"
        >
          Save to Library
        </Button>

        {/* Only show delete button when viewing a prompt (not a collection) */}
        {!isViewingCollection && (
          <Button
            variant="danger"
            size="sm"
            leftIcon={<Trash2 size={14} />}
            onClick={() => setIsDeleteDialogOpen(true)}
            className="w-full justify-center"
          >
            Delete Prompt
          </Button>
        )}
      </section>

      {/* Metadata */}
      <section className="pt-4 border-t border-border">
        <h4 className="text-xs font-medium text-ink-tertiary uppercase tracking-wide mb-2">
          Metadata
        </h4>
        <dl className="space-y-1 text-xs">
          <div className="flex justify-between">
            <dt className="text-ink-muted">Created</dt>
            <dd className="text-ink-secondary">
              {new Date(imagePrompt.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Images in prompt</dt>
            <dd className="text-ink-secondary">{imagePrompt.images.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Image ID</dt>
            <dd className="text-ink-secondary font-[family-name:var(--font-mono)]">
              {currentImage.id.slice(0, 12)}...
            </dd>
          </div>
        </dl>
      </section>

      {/* Delete prompt dialog - only shown when viewing a prompt */}
      {!isViewingCollection && (
        <Dialog
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          title="Delete Prompt"
        >
          <p className="text-sm text-ink-secondary mb-6">
            Are you sure you want to delete "{imagePrompt.title}" and all its images?
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await deletePrompt(imagePrompt.id);
                setIsDeleteDialogOpen(false);
              }}
            >
              Delete
            </Button>
          </div>
        </Dialog>
      )}

      {/* Save to Library dialog */}
      <Dialog
        isOpen={isSaveToLibraryDialogOpen}
        onClose={() => setIsSaveToLibraryDialogOpen(false)}
        title="Save to Library"
      >
        <div className="space-y-4">
          {/* Type selector */}
          <div>
            <label className="text-xs font-medium text-ink-secondary block mb-2">Type</label>
            <div className="flex gap-2">
              {(['fragment', 'preset', 'template'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setLibraryItemType(type)}
                  className={clsx(
                    'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                    libraryItemType === type
                      ? 'bg-brass text-surface'
                      : 'bg-canvas-subtle text-ink-secondary hover:bg-canvas-muted'
                  )}
                >
                  {TYPE_CONFIG[type].icon}
                  {TYPE_CONFIG[type].label}
                </button>
              ))}
            </div>
            <p className="text-[0.65rem] text-ink-muted mt-1.5">
              {TYPE_CONFIG[libraryItemType].description}
            </p>
          </div>

          {/* Name */}
          <Input
            label="Name"
            value={libraryItemName}
            onChange={(e) => setLibraryItemName(e.target.value)}
            placeholder={
              libraryItemType === 'fragment'
                ? 'e.g., Warm lighting'
                : libraryItemType === 'preset'
                  ? 'e.g., Elegant minimal'
                  : 'e.g., Product shot base'
            }
            autoFocus
          />

          {/* Content based on type */}
          {libraryItemType === 'fragment' && (
            <Textarea
              label="Text"
              value={libraryItemContent}
              onChange={(e) => setLibraryItemContent(e.target.value)}
              placeholder="e.g., warm wood tones, soft lighting, natural shadows"
              className="min-h-[80px]"
            />
          )}

          {libraryItemType === 'preset' && (
            <Input
              label="Style Tags (comma-separated)"
              value={libraryItemTags}
              onChange={(e) => setLibraryItemTags(e.target.value)}
              placeholder="e.g., sans-serif, elegant, minimal, cool"
            />
          )}

          {libraryItemType === 'template' && (
            <Textarea
              label="Full Prompt"
              value={libraryItemContent}
              onChange={(e) => setLibraryItemContent(e.target.value)}
              placeholder="Enter the complete prompt template..."
              className="min-h-[100px]"
            />
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setIsSaveToLibraryDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brass"
              onClick={handleSaveToLibrary}
              disabled={!libraryItemName.trim()}
            >
              Save to Library
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
