import { useState, useEffect, useMemo } from 'react';
import { clsx } from 'clsx';
import { Bookmark, Trash2, Image as ImageIcon, Type, Palette, FileText } from 'lucide-react';
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
  const currentPrompt = useStore((s) => s.getCurrentPrompt());
  const currentImage = useStore((s) => s.getCurrentImage());
  const updateImageNotes = useStore((s) => s.updateImageNotes);
  const deletePrompt = useStore((s) => s.deletePrompt);
  const prompts = useStore((s) => s.prompts);
  const setCurrentPrompt = useStore((s) => s.setCurrentPrompt);
  const setCurrentImageIndex = useStore((s) => s.setCurrentImageIndex);

  // Find reference images for this prompt
  const referenceImages = useMemo(() => {
    if (!currentPrompt) return [];

    const contextIds = currentPrompt.context_image_ids || [];
    const inputId = currentPrompt.input_image_id;

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
  }, [currentPrompt, prompts]);

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
      data.text = libraryItemContent || currentPrompt?.prompt || '';
    } else if (libraryItemType === 'preset') {
      data.style_tags = libraryItemTags.split(',').map((t) => t.trim()).filter(Boolean);
    } else if (libraryItemType === 'template') {
      data.prompt = libraryItemContent || currentPrompt?.prompt || '';
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
      if (currentPrompt) {
        setLibraryItemContent(currentPrompt.prompt);
        setLibraryItemName(currentPrompt.title);
      }
      setIsSaveToLibraryDialogOpen(true);
    };
    document.addEventListener('save-template', handler);
    return () => document.removeEventListener('save-template', handler);
  }, [currentPrompt]);

  if (!currentPrompt) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-sm text-ink-secondary">No prompt selected</p>
          <p className="text-xs text-ink-muted mt-1">
            Select a prompt from the sidebar to view details
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Prompt Info */}
      <section>
        <div className="mb-2">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
            {currentPrompt.title}
          </h3>
        </div>

        <div className="p-3 rounded-lg bg-canvas-subtle">
          <p className="text-xs font-[family-name:var(--font-mono)] text-ink-secondary leading-relaxed whitespace-pre-wrap">
            {currentPrompt.prompt}
          </p>
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

      {/* Image-specific info */}
      {currentImage && (
        <>
          {/* Varied prompt */}
          {currentImage.varied_prompt && currentImage.varied_prompt !== currentPrompt.prompt && (
            <section>
              <h4 className="text-xs font-medium text-ink-tertiary uppercase tracking-wide mb-2">
                Image Variation
              </h4>
              <div className="p-3 rounded-lg bg-brass-muted/50">
                <p className="text-xs font-[family-name:var(--font-mono)] text-brass-dark leading-relaxed">
                  {currentImage.varied_prompt}
                </p>
              </div>
              {(currentImage.mood || currentImage.variation_type) && (
                <div className="flex gap-2 mt-2">
                  {currentImage.mood && (
                    <Badge>{currentImage.mood}</Badge>
                  )}
                  {currentImage.variation_type && (
                    <Badge>{currentImage.variation_type}</Badge>
                  )}
                </div>
              )}
            </section>
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

          {/* Caption */}
          <section>
            <Input
              label="Caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Short caption for this image"
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
            if (currentPrompt) {
              setLibraryItemContent(currentPrompt.prompt);
              setLibraryItemName(currentPrompt.title);
            }
            setIsSaveToLibraryDialogOpen(true);
          }}
          className="w-full justify-center"
        >
          Save to Library
        </Button>

        <Button
          variant="danger"
          size="sm"
          leftIcon={<Trash2 size={14} />}
          onClick={() => setIsDeleteDialogOpen(true)}
          className="w-full justify-center"
        >
          Delete Prompt
        </Button>
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
              {new Date(currentPrompt.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Images</dt>
            <dd className="text-ink-secondary">{currentPrompt.images.length}</dd>
          </div>
          {currentImage && (
            <div className="flex justify-between">
              <dt className="text-ink-muted">Image ID</dt>
              <dd className="text-ink-secondary font-[family-name:var(--font-mono)]">
                {currentImage.id.slice(0, 12)}...
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* Delete prompt dialog */}
      <Dialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        title="Delete Prompt"
      >
        <p className="text-sm text-ink-secondary mb-6">
          Are you sure you want to delete "{currentPrompt.title}" and all its images?
          This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              await deletePrompt(currentPrompt.id);
              setIsDeleteDialogOpen(false);
            }}
          >
            Delete
          </Button>
        </div>
      </Dialog>

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
