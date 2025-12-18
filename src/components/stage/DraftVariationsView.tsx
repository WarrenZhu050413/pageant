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
  Sparkles,
  MessageSquare,
  Heart,
  Pencil,
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
  const generatingImageDraftIds = useStore((s) => s.generatingImageDraftIds);
  const prompts = useStore((s) => s.prompts);
  const streamingText = useStore((s) => s.streamingText);

  // Check if THIS draft is generating images
  const isGeneratingImages = generatingImageDraftIds.has(draft.id);
  const updateImageNotes = useStore((s) => s.updateImageNotes);
  // Polish workflow actions
  const updateDraftVariationNotes = useStore((s) => s.updateDraftVariationNotes);
  const toggleDraftVariationTag = useStore((s) => s.toggleDraftVariationTag);
  const polishDraftVariation = useStore((s) => s.polishDraftVariation);
  const polishDraftVariations = useStore((s) => s.polishDraftVariations);

  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [appliedAnnotations, setAppliedAnnotations] = useState<Set<string>>(new Set());
  const [polishingIds, setPolishingIds] = useState<Set<string>>(new Set());
  const [isPolishingAll, setIsPolishingAll] = useState(false);

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

  // Apply an annotation suggestion
  const handleApplyAnnotation = async (imageId: string, suggestedAnnotation: string) => {
    const img = findImageById(imageId);
    // updateImageNotes takes (imageId, notes, annotation) - keep existing notes, update annotation
    await updateImageNotes(imageId, img?.notes || '', suggestedAnnotation);
    setAppliedAnnotations((prev) => new Set(prev).add(imageId));
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

  // Polish single variation
  const handlePolishVariation = async (variationId: string) => {
    setPolishingIds((prev) => new Set(prev).add(variationId));
    try {
      await polishDraftVariation(draft.id, variationId);
    } finally {
      setPolishingIds((prev) => {
        const next = new Set(prev);
        next.delete(variationId);
        return next;
      });
    }
  };

  // Polish all variations
  const handlePolishAll = async () => {
    setIsPolishingAll(true);
    try {
      await polishDraftVariations(draft.id);
    } finally {
      setIsPolishingAll(false);
    }
  };

  // Check if any variation has notes or emphasized tags
  const hasAnnotations = draft.variations.some(
    (v) => (v.userNotes && v.userNotes.trim()) || (v.emphasizedTags && v.emphasizedTags.length > 0)
  );

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
              isGeneratingImages ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Wand2 size={14} />
              )
            }
            onClick={handleGenerate}
            disabled={draft.variations.length === 0 || isGeneratingImages || draft.isGenerating}
          >
            {isGeneratingImages ? 'Generating...' : 'Generate Images'}
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
        {draft.isGenerating && draft.variations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-ink-tertiary">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <p className="text-sm mb-3">Generating prompt variations...</p>
            {/* Show streaming text as it arrives */}
            {streamingText && (
              <div className="w-full max-w-2xl px-4">
                <div className="w-full bg-canvas-muted rounded-lg p-3 font-mono text-xs text-ink-secondary overflow-hidden max-h-32 overflow-y-auto">
                  <span className="opacity-50">Receiving:</span>
                  <pre className="w-full min-w-0 whitespace-pre-wrap break-words mt-1">{streamingText.slice(-500)}</pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Variations grid */}
        <div className="space-y-3">
          <AnimatePresence>
            {draft.variations.map((variation, index) => {
              const isRegenerating = regeneratingIds.has(variation.id);
              const isPolishing = polishingIds.has(variation.id);
              const isExpanded = expandedIds.has(variation.id);
              const hasNotes = variation.userNotes && variation.userNotes.trim();
              const hasEmphasizedTags = variation.emphasizedTags && variation.emphasizedTags.length > 0;

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
                    (isRegenerating || isPolishing) && 'opacity-60'
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
                      {/* Edited indicator */}
                      {variation.isEdited && (
                        <Badge variant="outline" size="sm" className="text-amber-600 border-amber-300 bg-amber-50">
                          <Pencil size={10} className="mr-0.5" />
                          edited
                        </Badge>
                      )}
                    </div>

                    <div className="flex-1" />

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Polish button */}
                      <button
                        onClick={() => handlePolishVariation(variation.id)}
                        disabled={isPolishing || isRegenerating || (!hasNotes && !hasEmphasizedTags)}
                        className={clsx(
                          'p-1.5 rounded-md transition-colors disabled:opacity-30',
                          hasNotes || hasEmphasizedTags
                            ? 'text-brass hover:text-brass hover:bg-brass/10'
                            : 'text-ink-tertiary hover:text-ink hover:bg-canvas-muted'
                        )}
                        title={hasNotes || hasEmphasizedTags ? 'Polish with notes/tags' : 'Add notes or emphasize tags to enable polish'}
                      >
                        {isPolishing ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Sparkles size={14} />
                        )}
                      </button>
                      <button
                        onClick={() => toggleExpand(variation.id)}
                        className="p-1.5 rounded-md text-ink-tertiary hover:text-ink hover:bg-canvas-muted transition-colors"
                        title={isExpanded ? 'Collapse' : 'Expand to edit'}
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      <button
                        onClick={() => handleRegenerate(variation.id)}
                        disabled={isRegenerating || isPolishing}
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

                  {/* Notes field - always visible */}
                  <div className="px-3 pb-2">
                    <div className="flex items-start gap-2">
                      <MessageSquare size={12} className="text-ink-tertiary mt-1.5 shrink-0" />
                      <textarea
                        value={variation.userNotes || ''}
                        onChange={(e) => updateDraftVariationNotes(draft.id, variation.id, e.target.value)}
                        className={clsx(
                          'flex-1 min-h-[40px] p-2 rounded-md text-xs',
                          'bg-canvas-muted/50 text-ink-secondary',
                          'border border-transparent focus:border-brass/50 focus:bg-canvas focus:outline-none',
                          'resize-y placeholder:text-ink-muted',
                          'transition-colors'
                        )}
                        placeholder="Add notes for AI refinement (e.g., 'make it warmer', 'add dramatic lighting')..."
                      />
                    </div>
                  </div>

                  {/* Design tags - clickable to emphasize */}
                  {variation.design && Object.keys(variation.design).length > 0 && (
                    <div className="px-3 pb-3 pt-1 border-t border-border/30">
                      <div className="space-y-1.5">
                        {Object.entries(variation.design).map(([axis, tags]) => (
                          <div key={axis} className="flex items-start gap-2">
                            <span className="text-[0.6rem] text-ink-muted w-16 shrink-0 pt-0.5 capitalize">
                              {axis}:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {(tags as string[]).map((tag) => {
                                const isEmphasized = variation.emphasizedTags?.includes(tag);
                                return (
                                  <button
                                    key={tag}
                                    onClick={() => toggleDraftVariationTag(draft.id, variation.id, tag)}
                                    className={clsx(
                                      'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[0.65rem] transition-all',
                                      isEmphasized
                                        ? 'bg-brass/20 text-brass border border-brass/40'
                                        : 'bg-canvas-muted text-ink-tertiary border border-transparent hover:bg-canvas-muted/80'
                                    )}
                                    title={isEmphasized ? 'Click to de-emphasize' : 'Click to emphasize in polish'}
                                  >
                                    {isEmphasized && <Heart size={8} className="fill-current" />}
                                    {tag}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Per-variation context images with inline annotation suggestions */}
                  {variation.recommended_context_ids && variation.recommended_context_ids.length > 0 && (
                    <div className="px-3 pb-3 pt-1 border-t border-border/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Image size={12} className="text-ink-tertiary shrink-0" />
                        <span className="text-[0.65rem] text-ink-muted shrink-0">Context:</span>
                        {variation.context_reasoning && (
                          <span
                            className="text-[0.6rem] text-ink-muted italic truncate flex-1"
                            title={variation.context_reasoning}
                          >
                            {variation.context_reasoning}
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {variation.recommended_context_ids.map((imgId) => {
                          const img = findImageById(imgId);
                          // Find suggestion for this image
                          const suggestion = draft.annotationSuggestions?.find(s => s.image_id === imgId);
                          const isApplied = appliedAnnotations.has(imgId);

                          return (
                            <div key={imgId} className="flex gap-2 items-start">
                              {img ? (
                                <img
                                  src={getImageUrl(img.image_path)}
                                  alt={img.annotation || 'Context image'}
                                  className="w-10 h-10 rounded object-cover border border-border/50 shrink-0"
                                  title={img.annotation || imgId}
                                />
                              ) : (
                                <div
                                  className="w-10 h-10 rounded bg-canvas-muted flex items-center justify-center shrink-0"
                                  title={`Image not found: ${imgId}`}
                                >
                                  <Image size={14} className="text-ink-muted" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                {/* Show annotation and suggestion side by side */}
                                {img?.annotation && (
                                  <p className="text-[0.65rem] text-ink-secondary line-clamp-3" title={img.annotation}>
                                    "{img.annotation}"
                                  </p>
                                )}
                                {/* Inline annotation suggestion */}
                                {suggestion && !isApplied && (
                                  <div className="mt-1 flex items-start gap-2 bg-amber-50/50 rounded p-1.5">
                                    <Sparkles size={10} className="text-amber-600 shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[0.65rem] text-amber-700">
                                        "{suggestion.suggested_annotation}"
                                      </p>
                                      {suggestion.reason && (
                                        <p className="text-[0.55rem] text-amber-600/70 mt-0.5">
                                          {suggestion.reason}
                                        </p>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => handleApplyAnnotation(imgId, suggestion.suggested_annotation)}
                                      className="shrink-0 px-1.5 py-0.5 rounded text-[0.6rem] bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                                    >
                                      Apply
                                    </button>
                                  </div>
                                )}
                                {isApplied && (
                                  <div className="mt-1 flex items-center gap-1 text-[0.6rem] text-green-600">
                                    <Check size={10} />
                                    Applied
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
            leftIcon={draft.isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            onClick={() => addMoreDraftVariations(draft.id, 2)}
            disabled={draft.isGenerating || isGeneratingImages || isPolishingAll}
          >
            Add More
          </Button>
          <span className="text-xs text-ink-tertiary">
            {draft.variations.length} variation{draft.variations.length !== 1 ? 's' : ''} ready
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Polish All button - only show when there are annotations */}
          {hasAnnotations && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={
                isPolishingAll ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Sparkles size={14} />
                )
              }
              onClick={handlePolishAll}
              disabled={isPolishingAll || isGeneratingImages || draft.isGenerating}
            >
              {isPolishingAll ? 'Polishing...' : 'Polish All'}
            </Button>
          )}
          <Button
            variant="brass"
            leftIcon={
              isGeneratingImages ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Wand2 size={16} />
              )
            }
            onClick={handleGenerate}
            disabled={draft.variations.length === 0 || isGeneratingImages || draft.isGenerating || isPolishingAll}
          >
            {isGeneratingImages ? 'Generating...' : 'Generate Images'}
          </Button>
        </div>
      </div>
    </div>
  );
}
