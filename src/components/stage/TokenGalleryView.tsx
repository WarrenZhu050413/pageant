import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  X,
  Sparkles,
  Image as ImageIcon,
  Tag,
  Grid,
  Maximize2,
  Square,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Trash2,
  FileText,
  Plus,
} from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';
import { Button, IconButton, Dialog } from '../ui';
import { TokenDetailView } from './TokenDetailView';
import type { DesignToken } from '../../types';

type TokenViewMode = 'single' | 'grid';

// Token card component for the gallery grid
function TokenCard({
  token,
  isSelectionMode,
  isSelected,
  onClick,
  onToggleSelect,
}: {
  token: DesignToken;
  isSelectionMode: boolean;
  isSelected: boolean;
  onClick: () => void;
  onToggleSelect: () => void;
}) {
  const hasConcept = !!token.concept_image_path;
  const conceptImageUrl = hasConcept
    ? getImageUrl(token.concept_image_path!)
    : null;

  // Get first source image path
  const firstSourceImage = token.images[0]?.image_path;
  const sourceImageUrl = firstSourceImage
    ? getImageUrl(firstSourceImage)
    : null;

  // Display concept image if available, otherwise fall back to source
  const displayImageUrl = conceptImageUrl || sourceImageUrl;

  const handleClick = () => {
    if (isSelectionMode) {
      onToggleSelect();
    } else {
      onClick();
    }
  };

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      onClick={handleClick}
      className={clsx(
        'group relative rounded-lg overflow-hidden',
        'bg-canvas-subtle border',
        isSelected
          ? 'border-brass ring-2 ring-brass/30'
          : 'border-border/50 hover:border-brass/40',
        'hover:shadow-lg',
        'transition-all duration-200',
        'text-left w-full'
      )}
    >
      {/* Selection checkbox overlay */}
      {isSelectionMode && (
        <div className="absolute top-2 left-2 z-20">
          {isSelected ? (
            <CheckSquare size={20} className="text-brass drop-shadow-md" />
          ) : (
            <Square
              size={20}
              className="text-surface drop-shadow-md opacity-70 group-hover:opacity-100"
            />
          )}
        </div>
      )}

      {/* Image area */}
      <div className="aspect-square relative bg-canvas-muted">
        {displayImageUrl ? (
          <img
            src={displayImageUrl}
            alt={token.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles size={24} className="text-ink-muted/30" />
          </div>
        )}

        {/* Hover overlay */}
        <div
          className={clsx(
            'absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent',
            'opacity-0 group-hover:opacity-100 transition-opacity'
          )}
        />

        {/* Category badge */}
        {token.category && (
          <span
            className={clsx(
              'absolute top-2 right-2 px-2 py-0.5 rounded-full',
              'text-[0.65rem] font-medium uppercase tracking-wide',
              'bg-surface/90 text-ink-secondary backdrop-blur-sm'
            )}
          >
            {token.category}
          </span>
        )}

        {/* Concept badge - shown when displaying actual concept image */}
        {hasConcept && (
          <span
            className={clsx(
              'absolute bottom-2 right-2 px-2 py-0.5 rounded-full',
              'text-[0.6rem] font-medium',
              'bg-brass/90 text-surface backdrop-blur-sm'
            )}
          >
            Concept
          </span>
        )}

        {/* Source badge - shown when using source image as fallback */}
        {!hasConcept && sourceImageUrl && (
          <span
            className={clsx(
              'absolute bottom-2 right-2 px-2 py-0.5 rounded-full',
              'text-[0.6rem] font-medium',
              'bg-ink/60 text-surface backdrop-blur-sm'
            )}
          >
            Source
          </span>
        )}

        {/* Source image thumbnail - shown in bottom left when concept exists */}
        {hasConcept && sourceImageUrl && (
          <div className="absolute bottom-2 left-2">
            <img
              src={sourceImageUrl}
              alt="Source"
              className="w-8 h-8 rounded border border-surface/50 object-cover shadow-sm"
            />
          </div>
        )}
      </div>

      {/* Info area */}
      <div className="p-3">
        <h3 className="font-medium text-sm text-ink truncate">{token.name}</h3>
        {token.description && (
          <p className="text-xs text-ink-tertiary line-clamp-2 mt-1">
            {token.description}
          </p>
        )}

        {/* Tags */}
        {token.tags && token.tags.length > 0 && (
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            <Tag size={10} className="text-ink-muted shrink-0" />
            {token.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[0.6rem] px-1.5 py-0.5 rounded bg-canvas-muted text-ink-tertiary"
              >
                {tag}
              </span>
            ))}
            {token.tags.length > 3 && (
              <span className="text-[0.6rem] text-ink-muted">
                +{token.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Source count */}
        <div className="flex items-center gap-2 mt-2 text-[0.6rem] text-ink-muted">
          <ImageIcon size={10} />
          <span>
            {token.images.length} source{token.images.length !== 1 ? 's' : ''}
          </span>
          {token.prompts.length > 0 && (
            <>
              <FileText size={10} />
              <span>
                {token.prompts.length} prompt
                {token.prompts.length !== 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>
      </div>
    </motion.button>
  );
}

// Single token view component
function TokenSingleView({
  token,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  onOpenDetail,
}: {
  token: DesignToken;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onOpenDetail: () => void;
}) {
  const hasConcept = !!token.concept_image_path;
  const conceptImageUrl = hasConcept
    ? getImageUrl(token.concept_image_path!)
    : null;
  const firstSourceImage = token.images[0]?.image_path;
  const sourceImageUrl = firstSourceImage
    ? getImageUrl(firstSourceImage)
    : null;
  const displayImageUrl = conceptImageUrl || sourceImageUrl;

  return (
    <div className="flex flex-col h-full">
      {/* Main image area */}
      <div className="flex-1 relative flex items-center justify-center p-8">
        {/* Navigation arrows */}
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          className={clsx(
            'absolute left-4 top-1/2 -translate-y-1/2 z-10',
            'w-10 h-10 rounded-full flex items-center justify-center',
            'bg-surface/80 backdrop-blur-sm border border-border',
            'hover:bg-surface hover:border-border-strong',
            'disabled:opacity-30 disabled:cursor-not-allowed',
            'transition-all'
          )}
        >
          <ChevronLeft size={20} />
        </button>

        <button
          onClick={onNext}
          disabled={!hasNext}
          className={clsx(
            'absolute right-4 top-1/2 -translate-y-1/2 z-10',
            'w-10 h-10 rounded-full flex items-center justify-center',
            'bg-surface/80 backdrop-blur-sm border border-border',
            'hover:bg-surface hover:border-border-strong',
            'disabled:opacity-30 disabled:cursor-not-allowed',
            'transition-all'
          )}
        >
          <ChevronRight size={20} />
        </button>

        {/* Token image */}
        <div
          className="relative max-w-full max-h-full cursor-pointer group"
          onClick={onOpenDetail}
        >
          {displayImageUrl ? (
            <motion.img
              key={token.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              src={displayImageUrl}
              alt={token.name}
              className="max-w-full max-h-[calc(100vh-300px)] rounded-xl shadow-2xl object-contain"
            />
          ) : (
            <div className="w-96 h-96 rounded-xl bg-canvas-subtle flex items-center justify-center">
              <Sparkles size={48} className="text-ink-muted/30" />
            </div>
          )}

          {/* Click to view detail overlay */}
          <div
            className={clsx(
              'absolute inset-0 rounded-xl flex items-center justify-center',
              'bg-ink/30 opacity-0 group-hover:opacity-100 transition-opacity'
            )}
          >
            <span className="px-4 py-2 bg-surface/90 rounded-lg text-sm font-medium">
              Click to view details
            </span>
          </div>

          {/* Concept badge */}
          {hasConcept && (
            <span
              className={clsx(
                'absolute top-4 right-4 px-3 py-1 rounded-full',
                'text-xs font-medium',
                'bg-brass/90 text-surface backdrop-blur-sm'
              )}
            >
              Concept
            </span>
          )}

          {/* Source thumbnail */}
          {hasConcept && sourceImageUrl && (
            <div className="absolute bottom-4 left-4">
              <img
                src={sourceImageUrl}
                alt="Source"
                className="w-16 h-16 rounded-lg border-2 border-surface/80 object-cover shadow-lg"
              />
            </div>
          )}
        </div>
      </div>

      {/* Token info bar */}
      <div className="px-8 py-4 border-t border-border bg-surface">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-brass shrink-0" />
              <h3 className="text-lg font-semibold text-ink truncate">
                {token.name}
              </h3>
              {token.category && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-canvas-subtle text-ink-secondary capitalize">
                  {token.category}
                </span>
              )}
            </div>
            {token.description && (
              <p className="text-sm text-ink-secondary mt-1 line-clamp-2">
                {token.description}
              </p>
            )}
            {token.tags && token.tags.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {token.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 rounded bg-canvas-muted text-ink-tertiary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <Button variant="brass" size="sm" onClick={onOpenDetail}>
            View Details
          </Button>
        </div>
      </div>
    </div>
  );
}

export function TokenGalleryView() {
  const designTokens = useStore((s) => s.designTokens);
  const deleteToken = useStore((s) => s.deleteToken);
  const setViewMode = useStore((s) => s.setViewMode);
  const markTokenUsed = useStore((s) => s.useToken);
  const setRightTab = useStore((s) => s.setRightTab);

  // Internal state for token gallery
  const [tokenViewMode, setTokenViewMode] = useState<TokenViewMode>('grid');
  const [currentTokenIndex, setCurrentTokenIndex] = useState(0);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // Selection mode state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);

  // Get unique categories for filter
  const categories = useMemo(() => {
    const cats = new Set<string>();
    designTokens.forEach((token) => {
      if (token.category) cats.add(token.category);
    });
    return Array.from(cats).sort();
  }, [designTokens]);

  // Filter tokens by category
  const filteredTokens = useMemo(() => {
    if (!categoryFilter) return designTokens;
    return designTokens.filter((t) => t.category === categoryFilter);
  }, [designTokens, categoryFilter]);

  const selectedToken = useMemo(
    () => designTokens.find((t) => t.id === selectedTokenId) || null,
    [designTokens, selectedTokenId]
  );

  const currentToken = filteredTokens[currentTokenIndex] || null;

  // Keep currentTokenIndex in bounds when tokens change (intentional sync)
  useEffect(() => {
    if (currentTokenIndex >= filteredTokens.length && filteredTokens.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentTokenIndex(filteredTokens.length - 1);
    }
  }, [filteredTokens.length, currentTokenIndex]);

  // Handle add - insert token's prompts/tags into generate field
  const handleAddToken = useCallback(
    async (token: DesignToken) => {
      await markTokenUsed(token.id);

      // Build insertable content from prompts and tags
      const content = [...token.prompts, ...(token.tags || [])].join(', ');

      if (content) {
        window.dispatchEvent(
          new CustomEvent('library-insert', {
            detail: { content, type: 'design-token', item: token },
          })
        );
        // Switch to Generate tab
        setRightTab('generate');
        // Close the gallery
        setViewMode('single');
      }
    },
    [markTokenUsed, setRightTab, setViewMode]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case '1':
          e.preventDefault();
          setTokenViewMode('single');
          break;
        case '2':
          e.preventDefault();
          setTokenViewMode('grid');
          break;
        case 's':
          e.preventDefault();
          setIsSelectionMode((prev) => !prev);
          if (isSelectionMode) {
            setSelectedIds(new Set());
          }
          break;
        case 'escape':
          e.preventDefault();
          if (selectedTokenId) {
            setSelectedTokenId(null);
          } else if (isSelectionMode) {
            setIsSelectionMode(false);
            setSelectedIds(new Set());
          } else {
            setViewMode('single');
          }
          break;
        case 'arrowleft':
          e.preventDefault();
          if (tokenViewMode === 'single' && currentTokenIndex > 0) {
            setCurrentTokenIndex((prev) => prev - 1);
          }
          break;
        case 'arrowright':
          e.preventDefault();
          if (
            tokenViewMode === 'single' &&
            currentTokenIndex < filteredTokens.length - 1
          ) {
            setCurrentTokenIndex((prev) => prev + 1);
          }
          break;
        case 'enter':
          e.preventDefault();
          if (tokenViewMode === 'single' && currentToken) {
            setSelectedTokenId(currentToken.id);
          }
          break;
        case 'a':
          if (e.metaKey || e.ctrlKey) {
            // Select all with Cmd/Ctrl+A
            if (isSelectionMode) {
              e.preventDefault();
              if (selectedIds.size === filteredTokens.length) {
                setSelectedIds(new Set());
              } else {
                setSelectedIds(new Set(filteredTokens.map((t) => t.id)));
              }
            }
          } else if (currentToken && !isSelectionMode) {
            // Add current token
            e.preventDefault();
            handleAddToken(currentToken);
          }
          break;
        case 'backspace':
        case 'delete':
          if (isSelectionMode && selectedIds.size > 0) {
            e.preventDefault();
            setIsBatchDeleteOpen(true);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    tokenViewMode,
    currentTokenIndex,
    filteredTokens,
    currentToken,
    selectedTokenId,
    isSelectionMode,
    selectedIds.size,
    setViewMode,
    handleAddToken,
  ]);

  // Selection handlers
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = () => {
    if (selectedIds.size === filteredTokens.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTokens.map((t) => t.id)));
    }
  };

  const handleBatchDelete = async () => {
    for (const id of selectedIds) {
      await deleteToken(id);
    }
    setSelectedIds(new Set());
    setIsBatchDeleteOpen(false);
    setIsSelectionMode(false);
  };

  // Handle close - return to single view
  const handleClose = () => {
    setViewMode('single');
  };

  const allSelected =
    filteredTokens.length > 0 && selectedIds.size === filteredTokens.length;

  return (
    <div className="flex flex-col h-full bg-canvas">
      {/* Header - matches MainStage exactly */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Sparkles size={18} className="text-brass shrink-0" />
          <div className="min-w-0">
            <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-ink">
              Design Tokens
            </h2>
            <p className="text-xs text-ink-muted">
              {tokenViewMode === 'single' && filteredTokens.length > 0
                ? `${currentTokenIndex + 1} of ${filteredTokens.length} tokens`
                : `${filteredTokens.length} token${filteredTokens.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Category filter */}
          {categories.length > 0 && (
            <>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCategoryFilter(null)}
                  className={clsx(
                    'px-2 py-1 rounded text-xs transition-colors',
                    !categoryFilter
                      ? 'bg-brass/15 text-brass-dark'
                      : 'text-ink-tertiary hover:text-ink'
                  )}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={clsx(
                      'px-2 py-1 rounded text-xs capitalize transition-colors',
                      categoryFilter === cat
                        ? 'bg-brass/15 text-brass-dark'
                        : 'text-ink-tertiary hover:text-ink'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="w-px h-6 bg-border" />
            </>
          )}

          {/* View mode toggles */}
          <div className="flex items-center gap-1 p-1 bg-canvas-subtle rounded-lg">
            <IconButton
              size="sm"
              variant={tokenViewMode === 'single' ? 'default' : 'ghost'}
              tooltip="Single view (1)"
              onClick={() => setTokenViewMode('single')}
              className={clsx(
                tokenViewMode === 'single' && 'bg-surface shadow-sm'
              )}
            >
              <Maximize2 size={16} />
            </IconButton>
            <IconButton
              size="sm"
              variant={tokenViewMode === 'grid' ? 'default' : 'ghost'}
              tooltip="Grid view (2)"
              onClick={() => setTokenViewMode('grid')}
              className={clsx(tokenViewMode === 'grid' && 'bg-surface shadow-sm')}
            >
              <Grid size={16} />
            </IconButton>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-border" />

          {/* Add button - only enabled when a token is available */}
          <Button
            size="sm"
            variant="brass"
            leftIcon={<Plus size={14} />}
            onClick={() => currentToken && handleAddToken(currentToken)}
            disabled={!currentToken || isSelectionMode}
          >
            Add (A)
          </Button>

          {/* Selection mode toggle */}
          <Button
            size="sm"
            variant={isSelectionMode ? 'brass' : 'secondary'}
            leftIcon={<Square size={14} />}
            onClick={() => {
              if (isSelectionMode) {
                setSelectedIds(new Set());
              }
              setIsSelectionMode(!isSelectionMode);
            }}
          >
            Select (S)
          </Button>

          {/* Close button */}
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<X size={14} />}
            onClick={handleClose}
          >
            Close
          </Button>
        </div>
      </header>

      {/* Selection toolbar */}
      {isSelectionMode && (
        <div className="px-4 py-2 bg-canvas-subtle border-b border-border flex items-center justify-between">
          <button
            onClick={handleSelectAll}
            className="flex items-center gap-1.5 text-xs text-ink-secondary hover:text-ink"
          >
            {allSelected ? (
              <CheckSquare size={14} className="text-brass" />
            ) : (
              <Square size={14} />
            )}
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-muted">
                {selectedIds.size} selected
              </span>
              <Button
                size="sm"
                variant="danger"
                leftIcon={<Trash2 size={12} />}
                onClick={() => setIsBatchDeleteOpen(true)}
              >
                Delete
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {filteredTokens.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full text-ink-muted"
            >
              <Sparkles size={32} className="mb-3 opacity-30" />
              <p className="text-sm">No design tokens yet</p>
              <p className="text-xs mt-1 text-ink-tertiary">
                Extract tokens from images using the sparkles icon on dimensions
              </p>
            </motion.div>
          ) : tokenViewMode === 'single' && currentToken ? (
            <motion.div
              key="single"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              <TokenSingleView
                token={currentToken}
                onPrev={() => setCurrentTokenIndex((prev) => prev - 1)}
                onNext={() => setCurrentTokenIndex((prev) => prev + 1)}
                hasPrev={currentTokenIndex > 0}
                hasNext={currentTokenIndex < filteredTokens.length - 1}
                onOpenDetail={() => setSelectedTokenId(currentToken.id)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full overflow-y-auto p-4"
            >
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                <AnimatePresence mode="popLayout">
                  {filteredTokens.map((token, index) => (
                    <TokenCard
                      key={token.id}
                      token={token}
                      isSelectionMode={isSelectionMode}
                      isSelected={selectedIds.has(token.id)}
                      onClick={() => {
                        if (tokenViewMode === 'grid') {
                          setSelectedTokenId(token.id);
                        } else {
                          setCurrentTokenIndex(index);
                          setTokenViewMode('single');
                        }
                      }}
                      onToggleSelect={() => handleToggleSelect(token.id)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Batch delete confirmation dialog */}
      <Dialog
        isOpen={isBatchDeleteOpen}
        onClose={() => setIsBatchDeleteOpen(false)}
        title="Delete Selected Tokens"
      >
        <p className="text-sm text-ink-secondary mb-6">
          Are you sure you want to delete {selectedIds.size} design token
          {selectedIds.size !== 1 ? 's' : ''}? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setIsBatchDeleteOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleBatchDelete}>
            Delete {selectedIds.size} Token{selectedIds.size !== 1 ? 's' : ''}
          </Button>
        </div>
      </Dialog>

      {/* Token detail modal */}
      <AnimatePresence>
        {selectedToken && (
          <TokenDetailView
            token={selectedToken}
            onClose={() => setSelectedTokenId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
