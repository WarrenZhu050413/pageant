import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  RefreshCw,
  Copy,
  Trash2,
  Loader2,
  Wand2,
  Plus,
  ChevronDown,
  ChevronUp,
  FileEdit,
  X,
} from 'lucide-react';
import { useStore } from '../../store';
import { Button, Badge } from '../ui';
import type { DraftPrompt } from '../../types';

interface DraftVariationsViewProps {
  draft: DraftPrompt;
}

export function DraftVariationsView({ draft }: DraftVariationsViewProps) {
  const updateDraftVariation = useStore((s) => s.updateDraftVariation);
  const removeDraftVariation = useStore((s) => s.removeDraftVariation);
  const duplicateDraftVariation = useStore((s) => s.duplicateDraftVariation);
  const regenerateDraftVariation = useStore((s) => s.regenerateDraftVariation);
  const addMoreDraftVariations = useStore((s) => s.addMoreDraftVariations);
  const generateFromDraft = useStore((s) => s.generateFromDraft);
  const deleteDraft = useStore((s) => s.deleteDraft);
  const isGeneratingVariations = useStore((s) => s.isGeneratingVariations);
  const isGenerating = useStore((s) => s.isGenerating);

  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const handleRegenerate = async (variationId: string) => {
    setRegeneratingIds((prev) => new Set(prev).add(variationId));
    try {
      await regenerateDraftVariation(draft.id, variationId);
    } finally {
      setRegeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(variationId);
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

  const handleGenerate = () => {
    generateFromDraft(draft.id);
  };

  const handleDelete = () => {
    deleteDraft(draft.id);
  };

  return (
    <div className="flex flex-col h-full bg-canvas">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-brass/10 flex items-center justify-center">
            <FileEdit size={16} className="text-brass" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-ink truncate">
                {draft.title}
              </h2>
              <Badge variant="secondary" size="sm">Draft</Badge>
            </div>
            <p className="text-xs text-ink-muted truncate max-w-md" title={draft.basePrompt}>
              {draft.variations.length} variation{draft.variations.length !== 1 ? 's' : ''} • Based on: "{draft.basePrompt.slice(0, 50)}{draft.basePrompt.length > 50 ? '...' : ''}"
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
          >
            <X size={14} className="mr-1" />
            Discard
          </Button>
          <Button
            variant="brass"
            size="sm"
            leftIcon={
              isGenerating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Wand2 size={14} />
              )
            }
            onClick={handleGenerate}
            disabled={draft.variations.length === 0 || isGenerating || isGeneratingVariations}
          >
            {isGenerating ? 'Generating...' : 'Generate Images'}
          </Button>
        </div>
      </header>

      {/* Base prompt summary */}
      <div className="px-4 py-3 border-b border-border bg-canvas-subtle shrink-0">
        <p className="text-xs text-ink-tertiary mb-1">Original prompt:</p>
        <p className="text-sm text-ink-secondary">
          "{draft.basePrompt}"
        </p>
      </div>

      {/* Variations list - scrollable */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Loading state when initially generating */}
        {isGeneratingVariations && draft.variations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-ink-tertiary">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <p className="text-sm">Generating prompt variations...</p>
          </div>
        )}

        {/* Variations grid */}
        <div className="space-y-3">
          <AnimatePresence>
            {draft.variations.map((variation, index) => {
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
                    'bg-surface hover:bg-canvas-muted/30',
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
                      {variation.mood && (
                        <Badge variant="secondary" size="sm">
                          {variation.mood}
                        </Badge>
                      )}
                      {variation.type && variation.type !== 'faithful' && (
                        <Badge variant="outline" size="sm">
                          {variation.type}
                        </Badge>
                      )}
                    </div>

                    <div className="flex-1" />

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => toggleExpand(variation.id)}
                        className="p-1.5 rounded-md text-ink-tertiary hover:text-ink hover:bg-canvas-muted transition-colors"
                        title={isExpanded ? 'Collapse' : 'Expand to edit'}
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
                        onClick={() => duplicateDraftVariation(draft.id, variation.id)}
                        className="p-1.5 rounded-md text-ink-tertiary hover:text-ink hover:bg-canvas-muted transition-colors"
                        title="Duplicate"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        onClick={() => removeDraftVariation(draft.id, variation.id)}
                        className="p-1.5 rounded-md text-ink-tertiary hover:text-error hover:bg-error/10 transition-colors"
                        title="Delete"
                        disabled={draft.variations.length <= 1}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Prompt text - editable when expanded */}
                  <div className="px-3 pb-3">
                    {isExpanded ? (
                      <textarea
                        value={variation.text}
                        onChange={(e) => updateDraftVariation(draft.id, variation.id, e.target.value)}
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
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={isGeneratingVariations ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            onClick={() => addMoreDraftVariations(draft.id, 2)}
            disabled={isGeneratingVariations || isGenerating}
          >
            Add More
          </Button>
          <span className="text-xs text-ink-tertiary">
            {draft.variations.length} variation{draft.variations.length !== 1 ? 's' : ''} ready
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="brass"
            leftIcon={
              isGenerating ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Wand2 size={16} />
              )
            }
            onClick={handleGenerate}
            disabled={draft.variations.length === 0 || isGenerating || isGeneratingVariations}
          >
            {isGenerating ? 'Generating...' : 'Generate Images'}
          </Button>
        </div>
      </div>
    </div>
  );
}
