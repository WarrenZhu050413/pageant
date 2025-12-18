import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { X, Pencil, Undo2, Check } from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';
import { Button } from '../ui';

interface ContextAnnotationModalProps {
  isOpen: boolean;
  imageId: string | null;
  onClose: () => void;
}

export function ContextAnnotationModal({ isOpen, imageId, onClose }: ContextAnnotationModalProps) {
  const prompts = useStore((s) => s.prompts);
  const contextAnnotationOverrides = useStore((s) => s.contextAnnotationOverrides);
  const setContextAnnotationOverride = useStore((s) => s.setContextAnnotationOverride);
  const clearContextAnnotationOverride = useStore((s) => s.clearContextAnnotationOverride);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Find the image by ID across all prompts
  const imageData = useMemo(() => {
    if (!imageId) return null;
    for (const prompt of prompts) {
      const image = prompt.images.find((img) => img.id === imageId);
      if (image) {
        return { image, promptTitle: prompt.title };
      }
    }
    return null;
  }, [imageId, prompts]);

  const originalAnnotation = imageData?.image.annotation || '';
  const overrideAnnotation = imageId ? contextAnnotationOverrides[imageId] : undefined;

  // Local state for the textarea - reset when modal opens/closes or imageId changes
  const [localAnnotation, setLocalAnnotation] = useState('');
  const [saved, setSaved] = useState(false);

  // Reset local state when modal opens or imageId changes
  useEffect(() => {
    if (isOpen && imageId) {
      setLocalAnnotation(overrideAnnotation ?? originalAnnotation);
      setSaved(false);
      // Auto-focus textarea after a brief delay for animation
      setTimeout(() => {
        textareaRef.current?.focus();
        // Move cursor to end of text
        textareaRef.current?.setSelectionRange(
          textareaRef.current.value.length,
          textareaRef.current.value.length
        );
      }, 50);
    }
  }, [isOpen, imageId, overrideAnnotation, originalAnnotation]);

  const hasChanges = localAnnotation !== (overrideAnnotation ?? originalAnnotation);
  const isOverridden = localAnnotation !== originalAnnotation;

  const handleUseBase = () => {
    if (imageId) {
      clearContextAnnotationOverride(imageId);
    }
    onClose();
  };

  const handleSaveOverride = () => {
    if (imageId && localAnnotation !== originalAnnotation) {
      setContextAnnotationOverride(imageId, localAnnotation);
      setSaved(true);
      setTimeout(() => {
        onClose();
      }, 300);
    } else if (imageId && localAnnotation === originalAnnotation) {
      // If annotation matches original, clear the override
      clearContextAnnotationOverride(imageId);
      onClose();
    }
  };

  const handleRevert = () => {
    setLocalAnnotation(originalAnnotation);
  };

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Escape to close
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    // Cmd/Ctrl+Enter to save
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (isOverridden || hasChanges) {
        handleSaveOverride();
      }
      return;
    }
  }, [onClose, isOverridden, hasChanges]);

  // Global keyboard listener for modal
  useEffect(() => {
    if (!isOpen) return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imageData) return null;

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1 }}
        className="fixed inset-0 bg-overlay z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.1, ease: 'easeOut' }}
        className={clsx(
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          'bg-surface rounded-xl shadow-xl',
          'flex flex-col',
          'z-50'
        )}
        style={{ width: 'min(90vw, 48rem)', maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Pencil size={18} className="text-brass" />
            <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-ink">
              Edit Context Annotation
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-ink-tertiary hover:text-ink hover:bg-canvas-muted transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex gap-4">
            {/* Left: Image Preview */}
            <div className="w-64 shrink-0">
              <img
                src={getImageUrl(imageData.image.image_path)}
                alt=""
                className="w-full rounded-lg object-cover max-h-64"
              />
              <p className="mt-2 text-xs text-ink-muted truncate">
                {imageData.promptTitle}
              </p>
            </div>

            {/* Right: Annotation Editor */}
            <div className="flex-1 flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-ink-secondary uppercase tracking-wide">
                  Annotation for this generation
                </label>
                <textarea
                  ref={textareaRef}
                  value={localAnnotation}
                  onChange={(e) => setLocalAnnotation(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe what should be referenced from this image..."
                  rows={5}
                  className={clsx(
                    'w-full mt-1.5 px-3 py-2 rounded-lg resize-none',
                    'bg-canvas-subtle border border-border/50',
                    'text-sm text-ink placeholder:text-ink-muted/60',
                    'focus:outline-none focus:ring-1 focus:ring-brass/30 focus:border-brass/50',
                    'transition-all'
                  )}
                />
                {/* Helper row */}
                <div className="mt-1.5 flex items-center justify-between text-[0.6rem] text-ink-muted">
                  <span className="flex items-center gap-3">
                    <span>
                      <kbd className="px-1 py-0.5 rounded bg-canvas-muted border border-border/50 font-mono">⌘↵</kbd>
                      {' '}save
                    </span>
                    <span>
                      <kbd className="px-1 py-0.5 rounded bg-canvas-muted border border-border/50 font-mono">esc</kbd>
                      {' '}close
                    </span>
                    {isOverridden && (
                      <button
                        onClick={handleRevert}
                        className="flex items-center gap-0.5 text-brass hover:text-brass-dark transition-colors"
                      >
                        <Undo2 size={10} />
                        <span>revert</span>
                      </button>
                    )}
                  </span>
                  {saved && (
                    <span className="text-success flex items-center gap-0.5">
                      <Check size={10} /> saved
                    </span>
                  )}
                </div>
              </div>

              {/* Base annotation reference */}
              {originalAnnotation && (
                <div className="mt-2">
                  <label className="text-xs font-medium text-ink-muted uppercase tracking-wide">
                    Base annotation (original)
                  </label>
                  <div className="mt-1 px-3 py-2 rounded-lg bg-canvas-muted border border-border/30 text-sm text-ink-secondary">
                    {originalAnnotation}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border shrink-0">
          <div className="text-xs text-ink-muted">
            {overrideAnnotation ? (
              <span className="text-brass">Override active</span>
            ) : (
              <span>Using base annotation</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleUseBase}>
              Use Base
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveOverride}
              disabled={!hasChanges && !isOverridden}
            >
              {isOverridden ? 'Save Override' : 'No Changes'}
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
