import { useState, useMemo, useCallback } from 'react';
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
  Image,
  Check,
  AlertCircle,
} from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';
import { Button, Badge } from '../ui';
import type { DraftPrompt, ImageData } from '../../types';

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
  const prompts = useStore((s) => s.prompts);
  const updateImageNotes = useStore((s) => s.updateImageNotes);

  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [appliedCaptions, setAppliedCaptions] = useState<Set<string>>(new Set());

  // Build a map of image ID to image data for quick lookup
  const imageMap = useMemo(() => {
    const map = new Map<string, ImageData>();
    for (const prompt of prompts) {
      for (const image of prompt.images) {
        map.set(image.id, image);
      }
    }
    return map;
  }, [prompts]);

  const findImageById = useCallback((id: string) => imageMap.get(id), [imageMap]);

  // Apply a caption suggestion
  const handleApplyCaption = async (imageId: string, suggestedCaption: string) => {
    const img = findImageById(imageId);
    // updateImageNotes takes (imageId, notes, caption) - keep existing notes, update caption
    await updateImageNotes(imageId, img?.notes || '', suggestedCaption);
    setAppliedCaptions((prev) => new Set(prev).add(imageId));
  };

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
                  <div className="px-3 pb-2">
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

                  {/* Per-variation context images */}
                  {variation.recommended_context_ids && variation.recommended_context_ids.length > 0 && (
                    <div className="px-3 pb-3 pt-1 border-t border-border/30">
                      <div className="flex items-center gap-2">
                        <Image size={12} className="text-ink-tertiary shrink-0" />
                        <span className="text-[0.65rem] text-ink-muted shrink-0">Context:</span>
                        <div className="flex gap-1.5 flex-wrap">
                          {variation.recommended_context_ids.map((imgId) => {
                            const img = findImageById(imgId);
                            return img ? (
                              <img
                                key={imgId}
                                src={getImageUrl(img.image_path)}
                                alt={img.caption || 'Context image'}
                                className="w-7 h-7 rounded object-cover border border-border/50"
                                title={variation.context_reasoning || img.caption || imgId}
                              />
                            ) : (
                              <div
                                key={imgId}
                                className="w-7 h-7 rounded bg-canvas-muted flex items-center justify-center"
                                title={`Image not found: ${imgId}`}
                              >
                                <Image size={12} className="text-ink-muted" />
                              </div>
                            );
                          })}
                        </div>
                        {variation.context_reasoning && (
                          <span
                            className="text-[0.6rem] text-ink-muted italic truncate flex-1 ml-1"
                            title={variation.context_reasoning}
                          >
                            {variation.context_reasoning}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Caption Suggestions Section */}
      {draft.captionSuggestions && draft.captionSuggestions.length > 0 && (
        <div className="px-4 py-3 border-t border-border bg-amber-50/50 shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={14} className="text-amber-600" />
            <span className="text-xs font-medium text-amber-700">
              Caption Improvements Suggested
            </span>
            <span className="text-[0.65rem] text-amber-600/70">
              Better captions help AI generate more relevant images
            </span>
          </div>
          <div className="space-y-2">
            {draft.captionSuggestions.map((suggestion) => {
              const img = findImageById(suggestion.image_id);
              const isApplied = appliedCaptions.has(suggestion.image_id);
              return (
                <div
                  key={suggestion.image_id}
                  className={clsx(
                    'flex gap-3 items-start p-2 rounded-md',
                    isApplied ? 'bg-green-50/50' : 'bg-white/50'
                  )}
                >
                  {img ? (
                    <img
                      src={getImageUrl(img.image_path)}
                      alt={suggestion.original_caption || 'Image'}
                      className="w-10 h-10 rounded object-cover border border-border/50 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded bg-canvas-muted flex items-center justify-center shrink-0">
                      <Image size={14} className="text-ink-muted" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {suggestion.original_caption && (
                      <p className="text-[0.65rem] text-ink-muted line-through mb-0.5">
                        {suggestion.original_caption}
                      </p>
                    )}
                    <p className="text-xs text-ink-secondary">
                      "{suggestion.suggested_caption}"
                    </p>
                    {suggestion.reason && (
                      <p className="text-[0.6rem] text-amber-600/80 mt-0.5 italic">
                        {suggestion.reason}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleApplyCaption(suggestion.image_id, suggestion.suggested_caption)}
                    disabled={isApplied}
                    className={clsx(
                      'shrink-0 px-2 py-1 rounded text-xs transition-colors',
                      isApplied
                        ? 'bg-green-100 text-green-700 cursor-default'
                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    )}
                  >
                    {isApplied ? (
                      <span className="flex items-center gap-1">
                        <Check size={12} />
                        Applied
                      </span>
                    ) : (
                      'Apply'
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
