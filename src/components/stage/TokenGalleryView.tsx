import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  X,
  Sparkles,
  Grid,
  Maximize2,
  Square,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';
import { Button, IconButton, Dialog } from '../ui';
import { TokenDetailView } from './TokenDetailView';
import type { DesignToken } from '../../types';

type TokenViewMode = 'single' | 'grid';

// Compact token card - image-focused with title, expandable for details
function TokenCard({
  token,
  isSelectionMode,
  isSelected,
  isExpanded,
  onClick,
  onToggleSelect,
  onToggleExpand,
}: {
  token: DesignToken;
  isSelectionMode: boolean;
  isSelected: boolean;
  isExpanded: boolean;
  onClick: () => void;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
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

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand();
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={clsx(
        'group relative rounded-lg overflow-hidden',
        'bg-canvas-subtle border',
        isSelected
          ? 'border-brass ring-2 ring-brass/30'
          : 'border-border/50 hover:border-brass/40',
        'hover:shadow-lg',
        'transition-all duration-200'
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

      {/* Image area - clickable */}
      <button
        onClick={handleClick}
        className="w-full aspect-square relative bg-canvas-muted cursor-pointer"
      >
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
            'absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent',
            'opacity-0 group-hover:opacity-100 transition-opacity'
          )}
        />

        {/* Category badge */}
        {token.category && (
          <span
            className={clsx(
              'absolute top-2 right-2 px-2 py-0.5 rounded-full',
              'text-[0.6rem] font-medium uppercase tracking-wide',
              'bg-surface/90 text-ink-secondary backdrop-blur-sm'
            )}
          >
            {token.category}
          </span>
        )}
      </button>

      {/* Compact info bar - just title + expand */}
      <div className="flex items-center justify-between px-2 py-1.5 gap-1">
        <h3 className="font-medium text-xs text-ink truncate flex-1">
          {token.name}
        </h3>
        <button
          onClick={handleExpandClick}
          className="p-0.5 rounded hover:bg-canvas-muted transition-colors shrink-0"
          title={isExpanded ? 'Collapse' : 'Expand details'}
        >
          {isExpanded ? (
            <ChevronUp size={14} className="text-ink-muted" />
          ) : (
            <ChevronDown size={14} className="text-ink-muted" />
          )}
        </button>
      </div>

      {/* Expandable details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border/30"
          >
            <div className="px-2 py-2 space-y-1.5">
              {token.description && (
                <p className="text-[0.65rem] text-ink-secondary line-clamp-3">
                  {token.description}
                </p>
              )}
              {token.prompts.length > 0 && (
                <div className="text-[0.6rem] text-ink-tertiary">
                  <span className="font-medium">Prompts:</span>{' '}
                  {token.prompts.slice(0, 2).join(', ')}
                  {token.prompts.length > 2 && ` +${token.prompts.length - 2}`}
                </div>
              )}
              {token.tags && token.tags.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {token.tags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="text-[0.55rem] px-1 py-0.5 rounded bg-canvas-muted text-ink-tertiary"
                    >
                      {tag}
                    </span>
                  ))}
                  {token.tags.length > 4 && (
                    <span className="text-[0.55rem] text-ink-muted">
                      +{token.tags.length - 4}
                    </span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
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
  const addContextImage = useStore((s) => s.addContextImage);
  const setCurrentGenerationId = useStore((s) => s.setCurrentGeneration);
  const setCurrentImageIndex = useStore((s) => s.setCurrentImageIndex);

  // Internal state for token gallery
  const [tokenViewMode, setTokenViewMode] = useState<TokenViewMode>('grid');
  const [currentTokenIndex, setCurrentTokenIndex] = useState(0);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // Selection mode state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);

  // Expanded cards state (for showing details)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

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

  // Handle add - add concept image to context
  const handleAddToken = useCallback(
    async (token: DesignToken) => {
      await markTokenUsed(token.id);

      // Add concept image to context (if available) - no annotation override
      if (token.concept_image_id) {
        addContextImage(token.concept_image_id);
      }

      // Switch to Generate tab
      setRightTab('generate');
    },
    [markTokenUsed, addContextImage, setRightTab]
  );

  // Navigate to concept prompt (exits token gallery, shows prompt in SingleView)
  const handleNavigateToConcept = useCallback(
    (token: DesignToken) => {
      if (token.concept_prompt_id) {
        setCurrentGenerationId(token.concept_prompt_id);
        setCurrentImageIndex(0);
        setViewMode('single');
      }
    },
    [setCurrentGenerationId, setCurrentImageIndex, setViewMode]
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

  // Expand/collapse handlers
  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
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
      {/* Sticky header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface shrink-0 z-10">
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
              tooltipPosition="bottom"
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
              tooltipPosition="bottom"
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
                onOpenDetail={() => {
                  // Navigate to concept prompt if available
                  if (currentToken.concept_prompt_id) {
                    handleNavigateToConcept(currentToken);
                  } else {
                    setSelectedTokenId(currentToken.id);
                  }
                }}
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
                  {filteredTokens.map((token) => (
                    <TokenCard
                      key={token.id}
                      token={token}
                      isSelectionMode={isSelectionMode}
                      isSelected={selectedIds.has(token.id)}
                      isExpanded={expandedIds.has(token.id)}
                      onClick={() => {
                        // Navigate directly to concept prompt if available
                        if (token.concept_prompt_id) {
                          handleNavigateToConcept(token);
                        } else {
                          // Fallback to detail modal for tokens without concept
                          setSelectedTokenId(token.id);
                        }
                      }}
                      onToggleSelect={() => handleToggleSelect(token.id)}
                      onToggleExpand={() => handleToggleExpand(token.id)}
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
