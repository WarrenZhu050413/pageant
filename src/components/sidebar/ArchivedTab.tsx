import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { Archive, ArchiveRestore, Trash2, CheckSquare, Square, X, ChevronDown, ChevronRight, Folder } from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';
import { Button, ConfirmDialog } from '../ui';

interface ArchivedPromptCardProps {
  prompt: {
    id: string;
    prompt: string;
    title: string;
    created_at: string;
    archived: boolean;
    images: Array<{
      id: string;
      image_path: string;
      archived?: boolean;
    }>;
  };
  isSelectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onUnarchive: (id: string) => void;
  onDelete: (id: string) => void;
}

function ArchivedPromptCard({
  prompt,
  isSelectionMode,
  isSelected,
  onToggleSelect,
  onUnarchive,
  onDelete,
}: ArchivedPromptCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const imageCount = prompt.images.length;

  return (
    <div
      className={clsx(
        'group border rounded-lg p-3 transition-colors',
        isSelected
          ? 'border-brass bg-brass/5'
          : 'border-border hover:border-border-strong'
      )}
    >
      <div className="flex items-start gap-2">
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
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <Archive size={12} className="flex-shrink-0 text-ink-muted" />
            <span className="text-sm font-medium text-ink truncate">
              {prompt.title || 'Untitled'}
            </span>
            <span className="text-[0.6rem] px-1.5 py-0.5 bg-canvas-subtle text-ink-muted rounded">
              {imageCount} image{imageCount !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Prompt text */}
          <p className="text-xs text-ink-muted line-clamp-2 mb-2">
            {prompt.prompt}
          </p>

          {/* Expandable images preview */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-[0.6rem] text-ink-muted hover:text-ink"
          >
            {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            {isExpanded ? 'Hide images' : 'Show images'}
          </button>

          {isExpanded && prompt.images.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {prompt.images.slice(0, 8).map((img) => (
                <img
                  key={img.id}
                  src={getImageUrl(img.image_path)}
                  alt=""
                  className="w-12 h-12 rounded object-cover border border-border"
                />
              ))}
              {prompt.images.length > 8 && (
                <span className="text-xs text-ink-muted self-center ml-1">
                  +{prompt.images.length - 8} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions - show on hover */}
        {!isSelectionMode && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onUnarchive(prompt.id);
              }}
              className="text-xs px-2 py-1"
              leftIcon={<ArchiveRestore size={12} />}
            >
              Restore
            </Button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(prompt.id);
              }}
              className="p-1 text-ink-muted hover:text-error transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Created date */}
      <div className="mt-2 text-[0.6rem] text-ink-muted">
        Archived from {new Date(prompt.created_at).toLocaleDateString()}
      </div>
    </div>
  );
}

export function ArchivedTab() {
  const archivedPrompts = useStore((s) => s.archivedPrompts);
  const unarchiveGeneration = useStore((s) => s.unarchiveGeneration);
  const deleteGeneration = useStore((s) => s.deleteGeneration);
  const refreshArchived = useStore((s) => s.refreshArchived);
  const currentSessionId = useStore((s) => s.currentSessionId);
  const sessions = useStore((s) => s.sessions);

  // Get current session name
  const currentSessionName = useMemo(() => {
    if (!currentSessionId) return null;
    const session = sessions.find((s) => s.id === currentSessionId);
    return session?.name || 'Unknown session';
  }, [currentSessionId, sessions]);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);
  const [isBatchRestoreOpen, setIsBatchRestoreOpen] = useState(false);

  const totalCount = archivedPrompts.length;
  const totalImages = useMemo(
    () => archivedPrompts.reduce((sum, p) => sum + p.images.length, 0),
    [archivedPrompts]
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
    if (selectedIds.size === archivedPrompts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(archivedPrompts.map((p) => p.id)));
    }
  };

  const handleBatchRestore = async () => {
    for (const id of selectedIds) {
      await unarchiveGeneration(id);
    }
    setSelectedIds(new Set());
    setIsBatchRestoreOpen(false);
    setIsSelectionMode(false);
  };

  const handleBatchDelete = async () => {
    for (const id of selectedIds) {
      await deleteGeneration(id);
    }
    await refreshArchived();
    setSelectedIds(new Set());
    setIsBatchDeleteOpen(false);
    setIsSelectionMode(false);
  };

  const handleSingleDelete = async () => {
    if (!deleteConfirmId) return;
    await deleteGeneration(deleteConfirmId);
    await refreshArchived();
    setDeleteConfirmId(null);
  };

  const allSelected = archivedPrompts.length > 0 && selectedIds.size === archivedPrompts.length;
  const selectedCount = selectedIds.size;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-ink">Archived</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-ink-muted">
              {totalCount} generation{totalCount !== 1 ? 's' : ''} · {totalImages} image{totalImages !== 1 ? 's' : ''}
            </p>
            {currentSessionName && (
              <span className="inline-flex items-center gap-1 text-[0.65rem] px-1.5 py-0.5 rounded bg-canvas-subtle text-ink-muted">
                <Folder size={9} />
                {currentSessionName}
              </span>
            )}
          </div>
        </div>
        {totalCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleSelectionMode}
            className={clsx(isSelectionMode && 'text-brass')}
          >
            {isSelectionMode ? <X size={14} /> : 'Select'}
          </Button>
        )}
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
          {selectedCount > 0 && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<ArchiveRestore size={12} />}
                onClick={() => setIsBatchRestoreOpen(true)}
              >
                Restore ({selectedCount})
              </Button>
              <Button
                size="sm"
                variant="danger"
                leftIcon={<Trash2 size={12} />}
                onClick={() => setIsBatchDeleteOpen(true)}
              >
                Delete ({selectedCount})
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {totalCount === 0 ? (
        <div className="text-center py-8">
          <Archive size={24} className="mx-auto text-ink-muted mb-2" />
          <p className="text-sm text-ink-secondary mb-2">No archived items</p>
          <p className="text-xs text-ink-muted">
            Archive generations to hide them from the main view while keeping them accessible.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {archivedPrompts.map((prompt) => (
            <ArchivedPromptCard
              key={prompt.id}
              prompt={prompt}
              isSelectionMode={isSelectionMode}
              isSelected={selectedIds.has(prompt.id)}
              onToggleSelect={() => handleToggleSelect(prompt.id)}
              onUnarchive={unarchiveGeneration}
              onDelete={(id) => setDeleteConfirmId(id)}
            />
          ))}
        </div>
      )}

      {/* Single delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleSingleDelete}
        title="Permanently Delete?"
        message="This will permanently delete this generation and all its images. This cannot be undone."
        confirmLabel="Delete Forever"
        variant="danger"
      />

      {/* Batch restore confirmation */}
      <ConfirmDialog
        isOpen={isBatchRestoreOpen}
        onClose={() => setIsBatchRestoreOpen(false)}
        onConfirm={handleBatchRestore}
        title="Restore Selected?"
        message={`Restore ${selectedCount} generation${selectedCount !== 1 ? "s" : ""} to the Generations tab?`}
        confirmLabel="Restore"
      />

      {/* Batch delete confirmation */}
      <ConfirmDialog
        isOpen={isBatchDeleteOpen}
        onClose={() => setIsBatchDeleteOpen(false)}
        onConfirm={handleBatchDelete}
        title="Permanently Delete Selected?"
        message={`This will permanently delete ${selectedCount} generation${selectedCount !== 1 ? "s" : ""} and all their images. This cannot be undone.`}
        confirmLabel="Delete Forever"
        variant="danger"
      />
    </div>
  );
}
