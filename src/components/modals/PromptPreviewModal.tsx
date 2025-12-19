import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  X,
  RefreshCw,
  Copy,
  Trash2,
  Loader2,
  Wand2,
  Plus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useStore } from '../../store';
import { Button } from '../ui';

export function PromptPreviewModal() {
  const showPromptPreview = useStore((s) => s.showPromptPreview);
  const promptVariations = useStore((s) => s.promptVariations);
  const isGeneratingVariations = useStore((s) => s.isGeneratingVariations);
  const isGenerating = useStore((s) => s.isGenerating);
  const variationsBasePrompt = useStore((s) => s.variationsBasePrompt);
  const updateVariation = useStore((s) => s.updateVariation);
  const removeVariation = useStore((s) => s.removeVariation);
  const duplicateVariation = useStore((s) => s.duplicateVariation);
  const regenerateSingleVariation = useStore((s) => s.regenerateSingleVariation);
  const generateFromVariations = useStore((s) => s.generateFromVariations);
  const addMoreVariations = useStore((s) => s.addMoreVariations);
  const clearVariations = useStore((s) => s.clearVariations);
  const setShowPromptPreview = useStore((s) => s.setShowPromptPreview);

  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const handleClose = () => {
    setShowPromptPreview(false);
  };

  const handleRegenerate = async (id: string) => {
    setRegeneratingIds((prev) => new Set(prev).add(id));
    try {
      await regenerateSingleVariation(id);
    } finally {
      setRegeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (!showPromptPreview) return null;

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-overlay z-50"
        onClick={handleClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={clsx(
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          'bg-surface rounded-xl shadow-xl',
          'flex flex-col',
          'z-50'
        )}
        style={{ width: 'min(90vw, 48rem)', maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
            Review Prompt Variations
          </h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-ink-tertiary hover:text-ink hover:bg-canvas-muted transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Base prompt summary */}
        <div className="px-5 py-3 border-b border-border bg-canvas-subtle shrink-0">
          <p className="text-xs text-ink-tertiary mb-1">Based on:</p>
          <p className="text-sm text-ink-secondary line-clamp-2">
            "{variationsBasePrompt}"
          </p>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {/* Loading state */}
          {isGeneratingVariations && promptVariations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-ink-tertiary">
              <Loader2 className="w-8 h-8 animate-spin mb-3" />
              <p className="text-sm">Generating prompt variations...</p>
            </div>
          )}

          {/* Variations list */}
          <AnimatePresence>
            {promptVariations.map((variation, index) => {
              const isRegenerating = regeneratingIds.has(variation.id);
              const isExpanded = expandedIds.has(variation.id);

              return (
                <motion.div
                  key={variation.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className={clsx(
                    'border border-border rounded-lg',
                    'bg-canvas-subtle hover:bg-canvas-muted/50',
                    'transition-colors',
                    isRegenerating && 'opacity-60'
                  )}
                >
                  {/* Card header */}
                  <div className="flex items-start gap-3 p-3 pb-2">
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-medium text-ink-tertiary">
                        #{index + 1}
                      </span>
                    </div>

                    <div className="flex-1" />

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => toggleExpand(variation.id)}
                        className="p-1.5 rounded-md text-ink-tertiary hover:text-ink hover:bg-canvas-muted transition-colors"
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      <button
                        onClick={() => handleRegenerate(variation.id)}
                        disabled={isRegenerating}
                        className="p-1.5 rounded-md text-ink-tertiary hover:text-ink hover:bg-canvas-muted transition-colors disabled:opacity-50"
                        title="Regenerate"
                      >
                        <RefreshCw size={14} className={isRegenerating ? 'animate-spin' : ''} />
                      </button>
                      <button
                        onClick={() => duplicateVariation(variation.id)}
                        className="p-1.5 rounded-md text-ink-tertiary hover:text-ink hover:bg-canvas-muted transition-colors"
                        title="Duplicate"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        onClick={() => removeVariation(variation.id)}
                        className="p-1.5 rounded-md text-ink-tertiary hover:text-error hover:bg-error/10 transition-colors"
                        title="Delete"
                        disabled={promptVariations.length <= 1}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Prompt text - editable */}
                  <div className="px-3 pb-3">
                    {isExpanded ? (
                      <textarea
                        value={variation.text}
                        onChange={(e) => updateVariation(variation.id, e.target.value)}
                        className={clsx(
                          'w-full min-h-[120px] p-3 rounded-md',
                          'bg-canvas text-sm text-ink',
                          'border border-border/50 focus:border-brass focus:outline-none',
                          'resize-y',
                          'transition-colors'
                        )}
                        placeholder="Enter prompt text..."
                      />
                    ) : (
                      <p
                        className="text-sm text-ink-secondary line-clamp-3 cursor-pointer"
                        onClick={() => toggleExpand(variation.id)}
                      >
                        {variation.text}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border bg-canvas-subtle shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Plus size={14} />}
              onClick={() => addMoreVariations(2)}
              disabled={isGeneratingVariations || isGenerating}
            >
              Add More
            </Button>
            <span className="text-xs text-ink-tertiary">
              {promptVariations.length} variation{promptVariations.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={clearVariations}>
              Cancel
            </Button>
            <Button
              variant="brass"
              leftIcon={
                isGenerating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Wand2 size={16} />
                )
              }
              onClick={generateFromVariations}
              disabled={
                promptVariations.length === 0 || isGenerating || isGeneratingVariations
              }
            >
              {isGenerating ? 'Generating...' : 'Generate Images'}
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
