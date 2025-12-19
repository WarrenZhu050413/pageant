import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { AnimatePresence } from 'framer-motion';
import {
  Trash2,
  ChevronDown,
  Sparkles,
  Image as ImageIcon,
  FileText,
  LayoutGrid,
  Square,
  CheckSquare,
  X,
} from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';
import { Button, Badge, Dialog } from '../ui';
import { TokenDetailView } from '../stage/TokenDetailView';
import type { DesignToken } from '../../types';

interface TokenCardProps {
  token: DesignToken;
  isSelectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onInsert: (token: DesignToken) => void;
  onDelete: (id: string) => void;
  onClick: () => void;
}

function TokenCard({
  token,
  isSelectionMode,
  isSelected,
  onToggleSelect,
  onInsert,
  onDelete,
  onClick,
}: TokenCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get display content
  const hasPrompts = token.prompts && token.prompts.length > 0;
  const hasImages = token.images && token.images.length > 0;
  const hasConcept = !!token.concept_image_path;

  const handleCardClick = () => {
    if (isSelectionMode) {
      onToggleSelect();
    } else {
      onClick();
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={clsx(
        'group border rounded-lg p-3 transition-colors cursor-pointer',
        isSelected
          ? 'border-brass bg-brass/5'
          : 'border-border hover:border-border-strong'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Selection checkbox */}
        {isSelectionMode && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            className="mt-0.5 shrink-0"
          >
            {isSelected ? (
              <CheckSquare size={16} className="text-brass" />
            ) : (
              <Square size={16} className="text-ink-muted" />
            )}
          </button>
        )}

        <div className="flex-1 min-w-0">
          {/* Header with name and category */}
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={12} className="flex-shrink-0 text-brass" />
            <span className="text-sm font-medium text-ink truncate">
              {token.name}
            </span>
            {token.category && (
              <span className="text-[0.6rem] px-1.5 py-0.5 bg-canvas-subtle text-ink-muted rounded capitalize">
                {token.category}
              </span>
            )}
          </div>

          {/* Description */}
          {token.description && (
            <p className="text-xs text-ink-muted line-clamp-2 mb-2">
              {token.description}
            </p>
          )}

          {/* Concept image thumbnail */}
          {hasConcept && (
            <div className="mb-2">
              <img
                src={getImageUrl(token.concept_image_path!)}
                alt={token.name}
                className="w-16 h-16 rounded-lg object-cover border border-border"
              />
            </div>
          )}

          {/* Tags */}
          {token.tags && token.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {token.tags.slice(0, 4).map((tag) => (
                <Badge key={tag} variant="brass" className="text-[0.6rem]">
                  {tag}
                </Badge>
              ))}
              {token.tags.length > 4 && (
                <span className="text-[0.6rem] text-ink-muted">
                  +{token.tags.length - 4}
                </span>
              )}
            </div>
          )}

          {/* Content indicators */}
          <div className="flex items-center gap-2 text-[0.6rem] text-ink-muted">
            {hasImages && (
              <span className="flex items-center gap-0.5">
                <ImageIcon size={10} />
                {token.images.length} image{token.images.length !== 1 ? 's' : ''}
              </span>
            )}
            {hasPrompts && (
              <span className="flex items-center gap-0.5">
                <FileText size={10} />
                {token.prompts.length} prompt
                {token.prompts.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Expandable details */}
          {(hasPrompts || (hasImages && token.images.length > 0)) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="flex items-center gap-1 text-[0.6rem] text-ink-muted hover:text-ink mt-1"
            >
              <ChevronDown
                size={10}
                className={clsx('transition-transform', isExpanded && 'rotate-180')}
              />
              {isExpanded ? 'Show less' : 'Show details'}
            </button>
          )}

          {isExpanded && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="mt-2 p-2 rounded bg-canvas-subtle space-y-2"
            >
              {/* Prompts */}
              {hasPrompts && (
                <div>
                  <span className="text-[0.6rem] text-ink-tertiary uppercase">
                    Prompts
                  </span>
                  <div className="mt-1 space-y-1">
                    {token.prompts.map((prompt, i) => (
                      <p key={i} className="text-xs text-ink-secondary">
                        {prompt}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Source images */}
              {hasImages && (
                <div>
                  <span className="text-[0.6rem] text-ink-tertiary uppercase">
                    Source Images
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {token.images.slice(0, 6).map(
                      (img) =>
                        img.image_path && (
                          <img
                            key={img.id}
                            src={getImageUrl(img.image_path)}
                            alt=""
                            className="w-10 h-10 rounded object-cover border border-border"
                          />
                        )
                    )}
                    {token.images.length > 6 && (
                      <span className="text-xs text-ink-muted self-center">
                        +{token.images.length - 6} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions - only show when not in selection mode */}
        {!isSelectionMode && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="brass"
              onClick={(e) => {
                e.stopPropagation();
                onInsert(token);
              }}
              className="text-xs px-2 py-1"
            >
              Insert
            </Button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(token.id);
              }}
              className="p-1 text-ink-muted hover:text-error transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Use count */}
      {token.use_count > 0 && (
        <div className="mt-2 text-[0.6rem] text-ink-muted">
          Used {token.use_count} time{token.use_count !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

export function LibraryTab() {
  const designTokens = useStore((s) => s.designTokens);
  const deleteToken = useStore((s) => s.deleteToken);
  const markTokenUsed = useStore((s) => s.useToken);
  const setRightTab = useStore((s) => s.setRightTab);
  const setViewMode = useStore((s) => s.setViewMode);

  const [filter, setFilter] = useState<string>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);

  // Selection mode state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);

  // Get unique categories for filtering
  const categories = useMemo(() => {
    const cats = new Set<string>();
    designTokens.forEach((t) => {
      if (t.category) cats.add(t.category);
    });
    return Array.from(cats).sort();
  }, [designTokens]);

  // Filter tokens by category
  const filteredTokens = useMemo(() => {
    if (filter === 'all') return designTokens;
    return designTokens.filter((t) => t.category === filter);
  }, [designTokens, filter]);

  // Get the selected token for detail view
  const selectedToken = useMemo(
    () => designTokens.find((t) => t.id === selectedTokenId) || null,
    [designTokens, selectedTokenId]
  );

  const handleToggleSelectionMode = () => {
    if (isSelectionMode) {
      setSelectedIds(new Set());
    }
    setIsSelectionMode(!isSelectionMode);
  };

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

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

  const handleInsert = async (token: DesignToken) => {
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
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deleteToken(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  const totalCount = designTokens.length;
  const allSelected =
    filteredTokens.length > 0 && selectedIds.size === filteredTokens.length;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-ink">Design Library</h3>
          <p className="text-xs text-ink-muted">
            {totalCount} token{totalCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleSelectionMode}
            className={clsx(isSelectionMode && 'text-brass')}
          >
            {isSelectionMode ? <X size={14} /> : 'Select'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<LayoutGrid size={14} />}
            onClick={() => setViewMode('token-gallery')}
            disabled={totalCount === 0}
          >
            Gallery
          </Button>
        </div>
      </div>

      {/* Selection mode actions */}
      {isSelectionMode && (
        <div className="flex items-center justify-between p-2 bg-canvas-subtle rounded-lg">
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
            <Button
              size="sm"
              variant="danger"
              leftIcon={<Trash2 size={12} />}
              onClick={() => setIsBatchDeleteOpen(true)}
            >
              Delete ({selectedIds.size})
            </Button>
          )}
        </div>
      )}

      {/* Category filter (only show if we have categories) */}
      {categories.length > 0 && (
        <div className="flex gap-1 p-1 rounded-lg bg-canvas-subtle overflow-x-auto">
          <button
            onClick={() => setFilter('all')}
            className={clsx(
              'flex-shrink-0 px-2 py-1.5 text-xs font-medium rounded-md transition-colors',
              filter === 'all'
                ? 'bg-surface text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink'
            )}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={clsx(
                'flex-shrink-0 px-2 py-1.5 text-xs font-medium rounded-md transition-colors capitalize',
                filter === cat
                  ? 'bg-surface text-ink shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Tokens list */}
      {totalCount === 0 ? (
        <div className="text-center py-8">
          <Sparkles size={24} className="mx-auto text-ink-muted mb-2" />
          <p className="text-sm text-ink-secondary mb-2">No design tokens yet</p>
          <p className="text-xs text-ink-muted">
            Select images and use "Extract Token" to save design dimensions for
            reuse.
          </p>
        </div>
      ) : filteredTokens.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-ink-muted">No tokens in this category</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTokens.map((token) => (
            <TokenCard
              key={token.id}
              token={token}
              isSelectionMode={isSelectionMode}
              isSelected={selectedIds.has(token.id)}
              onToggleSelect={() => handleToggleSelect(token.id)}
              onInsert={handleInsert}
              onDelete={(id) => setDeleteConfirmId(id)}
              onClick={() => setSelectedTokenId(token.id)}
            />
          ))}
        </div>
      )}

      {/* Single delete confirmation dialog */}
      <Dialog
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete Token"
      >
        <p className="text-sm text-ink-secondary mb-6">
          Are you sure you want to delete this design token? This action cannot
          be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDeleteConfirmId(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </Dialog>

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
