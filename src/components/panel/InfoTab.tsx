import { useState, useEffect } from 'react';
import { Bookmark, Trash2 } from 'lucide-react';
import { useStore } from '../../store';
import { Badge, Button, Input, Textarea, Dialog } from '../ui';

export function InfoTab() {
  const currentPrompt = useStore((s) => s.getCurrentPrompt());
  const currentImage = useStore((s) => s.getCurrentImage());
  const updateImageNotes = useStore((s) => s.updateImageNotes);
  const deletePrompt = useStore((s) => s.deletePrompt);

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
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
            {currentPrompt.title}
          </h3>
          <Badge variant="brass">{currentPrompt.category}</Badge>
        </div>

        <div className="p-3 rounded-lg bg-canvas-subtle">
          <p className="text-xs font-[family-name:var(--font-mono)] text-ink-secondary leading-relaxed whitespace-pre-wrap">
            {currentPrompt.prompt}
          </p>
        </div>
      </section>

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
            onClick={() => {
              deletePrompt(currentPrompt.id);
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
