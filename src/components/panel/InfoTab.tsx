import { useState, useEffect, useMemo } from 'react';
import { clsx } from 'clsx';
import { Bookmark, Trash2, Image as ImageIcon } from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';
import { Badge, Button, Input, Textarea, Dialog } from '../ui';

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
  const [isSaveTemplateDialogOpen, setIsSaveTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateTags, setTemplateTags] = useState('');

  const createTemplate = useStore((s) => s.createTemplate);

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

  const handleSaveTemplate = () => {
    if (currentPrompt && templateName.trim()) {
      createTemplate({
        name: templateName.trim(),
        prompt: currentPrompt.prompt,
        category: currentPrompt.category,
        tags: templateTags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      setTemplateName('');
      setTemplateTags('');
      setIsSaveTemplateDialogOpen(false);
    }
  };

  // Listen for save-template event from keyboard shortcut
  useEffect(() => {
    const handler = () => setIsSaveTemplateDialogOpen(true);
    document.addEventListener('save-template', handler);
    return () => document.removeEventListener('save-template', handler);
  }, []);

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
          onClick={() => setIsSaveTemplateDialogOpen(true)}
          className="w-full justify-center"
        >
          Save as Template
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

      {/* Save template dialog */}
      <Dialog
        isOpen={isSaveTemplateDialogOpen}
        onClose={() => setIsSaveTemplateDialogOpen(false)}
        title="Save as Template"
      >
        <div className="space-y-4">
          <Input
            label="Template Name"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder={currentPrompt.title}
            autoFocus
          />
          <Input
            label="Tags (comma-separated)"
            value={templateTags}
            onChange={(e) => setTemplateTags(e.target.value)}
            placeholder="portrait, creative, moody"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setIsSaveTemplateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brass"
              onClick={handleSaveTemplate}
              disabled={!templateName.trim()}
            >
              Save Template
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
