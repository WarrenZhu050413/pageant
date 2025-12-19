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
  CheckSquare,
  Square,
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
  const removeMultipleDraftVariations = useStore((s) => s.removeMultipleDraftVariations);
  const duplicateDraftVariation = useStore((s) => s.duplicateDraftVariation);
  const regenerateDraftVariation = useStore((s) => s.regenerateDraftVariation);
  const addMoreDraftVariations = useStore((s) => s.addMoreDraftVariations);
  const generateFromDraft = useStore((s) => s.generateFromDraft);
  const deleteDraft = useStore((s) => s.deleteDraft);
  const generatingImageDraftIds = useStore((s) => s.generatingImageDraftIds);
  const prompts = useStore((s) => s.generations);
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
  const [revertedAnnotations, setRevertedAnnotations] = useState<Set<string>>(new Set());
  const [polishingIds, setPolishingIds] = useState<Set<string>>(new Set());
  const [isPolishingAll, setIsPolishingAll] = useState(false);

  // Selection mode state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedVariationIds, setSelectedVariationIds] = useState<Set<string>>(new Set());

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

  // Revert to original annotation (undo auto-applied suggestion)
  const handleRevertAnnotation = async (imageId: string, originalAnnotation: string) => {
    const img = findImageById(imageId);
    // updateImageNotes takes (imageId, notes, annotation) - keep existing notes, revert annotation
    await updateImageNotes(imageId, img?.notes || '', originalAnnotation);
    setRevertedAnnotations((prev) => new Set(prev).add(imageId));
  };

  // Re-apply suggestion after reverting
  const handleReapplyAnnotation = async (imageId: string, suggestedAnnotation: string) => {
    const img = findImageById(imageId);
    await updateImageNotes(imageId, img?.notes || '', suggestedAnnotation);
    setRevertedAnnotations((prev) => {
      const next = new Set(prev);
      next.delete(imageId);
      return next;
    });
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

  // Selection helpers
  const toggleVariationSelection = (variationId: string) => {
    setSelectedVariationIds((prev) => {
      const next = new Set(prev);
      if (next.has(variationId)) {
        next.delete(variationId);
      } else {
        next.add(variationId);
      }
      return next;
    });
  };

  const allSelected = selectedVariationIds.size === draft.variations.length && draft.variations.length > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedVariationIds(new Set());
    } else {
      setSelectedVariationIds(new Set(draft.variations.map((v) => v.id)));
    }
  };

  const handleDeleteSelected = () => {
    // Cannot delete all variations - must keep at least 1
    if (selectedVariationIds.size >= draft.variations.length) {
      return;
    }
    removeMultipleDraftVariations(draft.id, Array.from(selectedVariationIds));
    setSelectedVariationIds(new Set());
    setIsSelectionMode(false);
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedVariationIds(new Set());
  };

  // Check if delete would remove all variations
  const wouldDeleteAll = selectedVariationIds.size >= draft.variations.length;

  return (
    <div className="flex flex-col h-full bg-canvas">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Selection toggle checkbox */}
          <button
            onClick={() => isSelectionMode ? exitSelectionMode() : setIsSelectionMode(true)}
            className={clsx(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
              isSelectionMode
                ? 'bg-brass/20 text-brass'
                : 'bg-brass/10 text-brass hover:bg-brass/20'
            )}
            title={isSelectionMode ? 'Exit selection mode' : 'Select variations to delete'}
          >
            {isSelectionMode ? <CheckSquare size={16} /> : <FileEdit size={16} />}
          </button>
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
          {!isSelectionMode && (
            <>
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
                Generate Images
              </Button>
            </>
          )}
          {isSelectionMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={exitSelectionMode}
            >
              <X size={14} className="mr-1" />
              Cancel
            </Button>
          )}
        </div>
      </header>

      {/* Selection bar - shows when in selection mode */}
      {isSelectionMode && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-brass/5 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink transition-colors"
            >
              {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-sm text-ink-tertiary">
              {selectedVariationIds.size} selected
            </span>
          </div>
          <Button
            variant="danger"
            size="sm"
            leftIcon={<Trash2 size={14} />}
            onClick={handleDeleteSelected}
            disabled={selectedVariationIds.size === 0 || wouldDeleteAll}
            title={wouldDeleteAll ? 'Cannot delete all variations' : 'Delete selected variations'}
          >
            Delete Selected
          </Button>
        </div>
      )}

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
          <div className="flex flex-col items-center justify-center py-8 text-ink-tertiary w-full">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <p className="text-sm mb-3">Generating prompt variations...</p>
            {/* Show streaming text as it arrives - fills most of stage */}
            {streamingText && (
              <div className="w-full self-stretch px-4 flex justify-center">
                <div className="w-full max-w-4xl bg-canvas-muted rounded-lg p-3 font-mono text-xs text-ink-secondary max-h-48 overflow-y-auto">
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
              const isSelected = selectedVariationIds.has(variation.id);

              return (
                <motion.div
                  key={variation.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className={clsx(
                    'border rounded-lg',
                    'bg-surface hover:bg-canvas-muted/30',
                    'transition-colors',
                    (isRegenerating || isPolishing) && 'opacity-60',
                    isSelectionMode && isSelected
                      ? 'border-brass bg-brass/5'
                      : 'border-border'
                  )}
                >
                  {/* Card header */}
                  <div className="flex items-start gap-3 p-3 pb-2">
                    {/* Selection checkbox */}
                    {isSelectionMode && (
                      <button
                        onClick={() => toggleVariationSelection(variation.id)}
                        className="shrink-0 mt-0.5"
                      >
                        {isSelected ? (
                          <CheckSquare size={16} className="text-brass" />
                        ) : (
                          <Square size={16} className="text-ink-tertiary hover:text-ink" />
                        )}
                      </button>
                    )}
                    <div className="flex items-center gap-2 shrink-0 min-w-0">
                      <span className="text-xs font-medium text-ink-tertiary shrink-0">
                        #{index + 1}
                      </span>
                      {variation.title && (
                        <span className="text-sm font-medium text-ink truncate" title={variation.title}>
                          {variation.title}
                        </span>
                      )}
                      {/* Edited indicator */}
                      {variation.isEdited && (
                        <Badge variant="outline" size="sm" className="text-warning border-warning/30 bg-warning-muted shrink-0">
                          <Pencil size={10} className="mr-0.5" />
                          edited
                        </Badge>
                      )}
                    </div>

                    <div className="flex-1" />

                    {/* Actions - hide in selection mode */}
                    {!isSelectionMode && (
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
                    )}
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

                  {/* Design tags and dimensions */}
                  {(variation.design && Object.keys(variation.design).length > 0) ||
                   (variation.design_dimensions && variation.design_dimensions.length > 0) ? (
                    <div className="px-3 pb-3 pt-1 border-t border-border/30">
                      <div className="flex gap-6">
                        {/* Design tags - clickable to emphasize */}
                        {variation.design && Object.keys(variation.design).length > 0 && (
                          <div className="flex-1 space-y-1.5">
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
                        )}

                        {/* Design dimensions - right side */}
                        {variation.design_dimensions && variation.design_dimensions.length > 0 && (
                          <div className="w-56 shrink-0 space-y-1.5">
                            {variation.design_dimensions.slice(0, 3).map((dim) => (
                              <div
                                key={dim.name}
                                className="text-[0.65rem] text-ink-secondary"
                                title={dim.description}
                              >
                                <span className="text-ink">{dim.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

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
                          const isReverted = revertedAnnotations.has(imgId);

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
                                {/* Show current annotation */}
                                {img?.annotation && (
                                  <p className="text-[0.65rem] text-ink-secondary line-clamp-2" title={img.annotation}>
                                    "{img.annotation}"
                                  </p>
                                )}
                                {/* Show liked axes preferences - compact horizontal layout */}
                                {img?.liked_axes && Object.keys(img.liked_axes).length > 0 && (
                                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                                    {Object.entries(img.liked_axes).flatMap(([axis, tags]) =>
                                      (tags as string[]).map((tag) => (
                                        <span
                                          key={`${axis}-${tag}`}
                                          className="inline-flex items-center gap-0.5 px-1 py-0 rounded text-[0.55rem] bg-brass/10 text-brass"
                                          title={`${axis}: ${tag}`}
                                        >
                                          <Heart size={5} className="fill-current" />
                                          {tag}
                                        </span>
                                      ))
                                    )}
                                  </div>
                                )}
                                {/* Auto-applied suggestion: show "Applied" with Revert option */}
                                {suggestion && !isReverted && (
                                  <div className="mt-1 flex items-start gap-2 bg-success-muted rounded p-1.5">
                                    <Check size={10} className="text-success shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[0.6rem] text-success">
                                        Auto-polished
                                      </p>
                                      {suggestion.original_annotation && (
                                        <p className="text-[0.55rem] text-ink-muted mt-0.5">
                                          Was: "{suggestion.original_annotation}"
                                        </p>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => handleRevertAnnotation(imgId, suggestion.original_annotation || '')}
                                      className="shrink-0 px-1.5 py-0.5 rounded text-[0.6rem] bg-canvas-muted text-ink-secondary hover:bg-canvas-subtle transition-colors"
                                    >
                                      Revert
                                    </button>
                                  </div>
                                )}
                                {/* Reverted: show option to re-apply */}
                                {suggestion && isReverted && (
                                  <div className="mt-1 flex items-start gap-2 bg-warning-muted rounded p-1.5">
                                    <Sparkles size={10} className="text-warning shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[0.6rem] text-warning">
                                        Reverted to original
                                      </p>
                                      <p className="text-[0.55rem] text-ink-muted mt-0.5">
                                        Suggested: "{suggestion.suggested_annotation}"
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => handleReapplyAnnotation(imgId, suggestion.suggested_annotation)}
                                      className="shrink-0 px-1.5 py-0.5 rounded text-[0.6rem] bg-warning-muted text-warning hover:bg-warning/20 transition-colors"
                                    >
                                      Re-apply
                                    </button>
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
            Generate Images
          </Button>
        </div>
      </div>
    </div>
  );
}
