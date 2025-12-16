import { useState } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { BookmarkIcon, Trash2, ArrowRight } from 'lucide-react';
import { useStore } from '../../store';
import { Badge, Button, IconButton, Dialog } from '../ui';

export function TemplatesTab() {
  const templates = useStore((s) => s.templates);
  const deleteTemplate = useStore((s) => s.deleteTemplate);
  const useTemplate = useStore((s) => s.useTemplate);
  const setRightTab = useStore((s) => s.setRightTab);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleUseTemplate = async (templateId: string) => {
    const template = await useTemplate(templateId);
    if (template) {
      setRightTab('generate');
      // The generate tab will need to read from a temporary state
      // We'll dispatch a custom event for now
      setTimeout(() => {
        const event = new CustomEvent('use-template', { detail: template });
        document.dispatchEvent(event);
      }, 100);
    }
  };

  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <div className="w-12 h-12 rounded-full bg-canvas-muted flex items-center justify-center mb-3">
          <BookmarkIcon size={20} className="text-ink-muted" />
        </div>
        <p className="text-sm text-ink-secondary">No templates yet</p>
        <p className="text-xs text-ink-muted mt-1">
          Save prompts as templates for easy reuse
        </p>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1">
      {templates.map((template, index) => (
        <motion.div
          key={template.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.02 }}
          className={clsx(
            'group rounded-lg p-3',
            'hover:bg-canvas-subtle transition-colors'
          )}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-sm font-medium text-ink-secondary">
              {template.name}
            </h3>
            <Badge variant="brass">{template.category}</Badge>
          </div>

          <p className="text-xs text-ink-muted font-[family-name:var(--font-mono)] line-clamp-2 mb-2">
            {template.prompt}
          </p>

          {/* Tags */}
          {template.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {template.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[0.625rem] px-1.5 py-0.5 rounded bg-canvas-muted text-ink-tertiary"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between">
            <span className="text-[0.625rem] text-ink-muted">
              Used {template.use_count} time{template.use_count !== 1 ? 's' : ''}
            </span>

            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="sm"
                variant="secondary"
                rightIcon={<ArrowRight size={12} />}
                onClick={() => handleUseTemplate(template.id)}
              >
                Use
              </Button>
              <IconButton
                size="sm"
                variant="danger"
                tooltip="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteId(template.id);
                }}
              >
                <Trash2 size={14} />
              </IconButton>
            </div>
          </div>
        </motion.div>
      ))}

      {/* Delete Confirmation */}
      <Dialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Template"
      >
        <p className="text-sm text-ink-secondary mb-6">
          Are you sure you want to delete this template?
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDeleteId(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (deleteId) {
                deleteTemplate(deleteId);
                setDeleteId(null);
              }
            }}
          >
            Delete
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
