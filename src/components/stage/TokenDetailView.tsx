import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import {
  X,
  ExternalLink,
  RefreshCw,
  Trash2,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react';
import { useStore } from '../../store';
import { Button } from '../ui';
import type { DesignToken } from '../../types';

interface TokenDetailViewProps {
  token: DesignToken;
  onClose: () => void;
}

export function TokenDetailView({ token, onClose }: TokenDetailViewProps) {
  const prompts = useStore((s) => s.prompts);
  const setCurrentPromptId = useStore((s) => s.setCurrentPrompt);
  const setCurrentImageIndex = useStore((s) => s.setCurrentImageIndex);
  const setViewMode = useStore((s) => s.setViewMode);
  const generateTokenConcept = useStore((s) => s.generateTokenConcept);
  const deleteToken = useStore((s) => s.deleteToken);

  // Build image map for navigation
  const imageMap = useMemo(() => {
    const map = new Map<
      string,
      { promptId: string; imageIndex: number; imagePath?: string }
    >();
    prompts.forEach((prompt) => {
      prompt.images.forEach((img, idx) => {
        map.set(img.id, {
          promptId: prompt.id,
          imageIndex: idx,
          imagePath: img.image_path,
        });
      });
    });
    return map;
  }, [prompts]);

  // Get source image paths
  const sourceImages = useMemo(() => {
    return token.images.map((img) => {
      const found = imageMap.get(img.id);
      return {
        id: img.id,
        path: found?.imagePath || img.image_path,
        promptId: found?.promptId,
        imageIndex: found?.imageIndex,
      };
    });
  }, [token.images, imageMap]);

  const conceptImageUrl = token.concept_image_path
    ? `/images/${token.concept_image_path}`
    : null;

  // Navigate to source image in SingleView
  const handleViewSource = (imageId: string) => {
    const found = imageMap.get(imageId);
    if (found) {
      setCurrentPromptId(found.promptId);
      setCurrentImageIndex(found.imageIndex);
      setViewMode('single');
      onClose();
    }
  };

  // Regenerate concept image
  const handleRegenerateConcept = async () => {
    await generateTokenConcept(token.id);
  };

  // Delete token
  const handleDelete = async () => {
    if (confirm(`Delete token "${token.name}"?`)) {
      await deleteToken(token.id);
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-overlay z-50"
        onClick={onClose}
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
        style={{ width: 'min(90vw, 56rem)', maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <Sparkles size={18} className="text-brass" />
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
              {token.name}
            </h2>
            {token.category && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide bg-canvas-subtle text-ink-secondary">
                {token.category}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-ink-tertiary hover:text-ink hover:bg-canvas-muted transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Image comparison */}
          <div className="flex gap-4 p-5">
            {/* Concept image */}
            <div className="flex-1">
              <p className="text-xs text-ink-muted mb-2 uppercase tracking-wide">
                Concept Image
              </p>
              <div className="aspect-square rounded-lg bg-canvas-muted overflow-hidden relative">
                {conceptImageUrl ? (
                  <img
                    src={conceptImageUrl}
                    alt={`${token.name} concept`}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-ink-muted">
                    <Sparkles size={24} className="mb-2 opacity-30" />
                    <p className="text-xs">No concept image</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      leftIcon={<RefreshCw size={12} />}
                      onClick={handleRegenerateConcept}
                      className="mt-2"
                    >
                      Generate
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Source images */}
            <div className="flex-1">
              <p className="text-xs text-ink-muted mb-2 uppercase tracking-wide">
                Source Images ({sourceImages.length})
              </p>
              <div
                className={clsx(
                  'grid gap-2',
                  sourceImages.length === 1
                    ? 'grid-cols-1'
                    : sourceImages.length <= 4
                      ? 'grid-cols-2'
                      : 'grid-cols-3'
                )}
              >
                {sourceImages.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => handleViewSource(img.id)}
                    disabled={!img.promptId}
                    className={clsx(
                      'aspect-square rounded-lg bg-canvas-muted overflow-hidden relative group',
                      img.promptId && 'cursor-pointer hover:ring-2 hover:ring-brass/40'
                    )}
                    title={img.promptId ? 'Click to view source' : 'Source not found'}
                  >
                    {img.path ? (
                      <>
                        <img
                          src={`/images/${img.path}`}
                          alt="Source"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        {img.promptId && (
                          <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/30 transition-colors flex items-center justify-center">
                            <ExternalLink
                              size={20}
                              className="text-surface opacity-0 group-hover:opacity-100 transition-opacity"
                            />
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <ImageIcon size={20} className="text-ink-muted/30" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="px-5 pb-5 space-y-4">
            {/* Description */}
            {token.description && (
              <div>
                <p className="text-xs text-ink-muted mb-1 uppercase tracking-wide">
                  Description
                </p>
                <p className="text-sm text-ink-secondary">{token.description}</p>
              </div>
            )}

            {/* Generation prompt */}
            {token.extraction?.generation_prompt && (
              <div>
                <p className="text-xs text-ink-muted mb-1 uppercase tracking-wide">
                  Generation Prompt
                </p>
                <p className="text-sm text-ink-secondary font-mono bg-canvas-subtle p-3 rounded-lg">
                  {token.extraction.generation_prompt}
                </p>
              </div>
            )}

            {/* Tags */}
            {token.tags && token.tags.length > 0 && (
              <div>
                <p className="text-xs text-ink-muted mb-2 uppercase tracking-wide">
                  Tags
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {token.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 rounded-full text-xs bg-canvas-subtle text-ink-secondary"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Prompts */}
            {token.prompts && token.prompts.length > 0 && (
              <div>
                <p className="text-xs text-ink-muted mb-2 uppercase tracking-wide">
                  Prompts ({token.prompts.length})
                </p>
                <div className="space-y-2">
                  {token.prompts.map((prompt, idx) => (
                    <p
                      key={idx}
                      className="text-sm text-ink-secondary bg-canvas-subtle p-2 rounded"
                    >
                      {prompt}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border bg-canvas-subtle shrink-0">
          <div className="text-xs text-ink-muted">
            Used {token.use_count} time{token.use_count !== 1 ? 's' : ''}
            {token.last_used && (
              <span>
                {' '}
                · Last used {new Date(token.last_used).toLocaleDateString()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {conceptImageUrl && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<RefreshCw size={14} />}
                onClick={handleRegenerateConcept}
              >
                Regenerate
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Trash2 size={14} />}
              onClick={handleDelete}
              className="text-error hover:bg-error/10"
            >
              Delete
            </Button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
