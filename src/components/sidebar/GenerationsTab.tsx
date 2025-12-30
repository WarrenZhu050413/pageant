import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { Loader2, ImageIcon, Trash2, CheckSquare, Square, X, FileEdit, Sparkles, Plus, RotateCcw, EyeOff, Eye, ChevronDown, ExternalLink, Folder, Pencil, Check, ArrowRightLeft, Filter, MoreHorizontal } from 'lucide-react';
import type { GenerationAction } from '../../types';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';
import { Button, ConfirmDialog } from '../ui';

export function GenerationsTab() {
  // Use filtered generations for display (respects session filter)
  const getFilteredGenerations = useStore((s) => s.getFilteredGenerations);
  const generations = getFilteredGenerations();
  const pendingGenerations = useStore((s) => s.pendingGenerations);
  const draftPrompts = useStore((s) => s.draftPrompts);
  const generatingImageDraftIds = useStore((s) => s.generatingImageDraftIds);
  const pendingCount = pendingGenerations.size;
  const currentGenerationId = useStore((s) => s.currentGenerationId);
  const currentDraftId = useStore((s) => s.currentDraftId);
  const setCurrentGeneration = useStore((s) => s.setCurrentGeneration);
  const setCurrentDraft = useStore((s) => s.setCurrentDraft);
  const selectedGenerationIds = useStore((s) => s.selectedGenerationIds);
  const toggleGenerationSelection = useStore((s) => s.toggleGenerationSelection);
  const selectAllGenerations = useStore((s) => s.selectAllGenerations);
  const clearGenerationSelection = useStore((s) => s.clearGenerationSelection);
  const batchDeleteGenerations = useStore((s) => s.batchDeleteGenerations);
  const hideGeneration = useStore((s) => s.hideGeneration);
  const hideSelectedGenerations = useStore((s) => s.hideSelectedGenerations);
  const unhideGeneration = useStore((s) => s.unhideGeneration);
  const moveGenerationToSession = useStore((s) => s.moveGenerationToSession);
  const deleteDraft = useStore((s) => s.deleteDraft);
  const generationFilter = useStore((s) => s.generationFilter);
  const setGenerationFilter = useStore((s) => s.setGenerationFilter);
  const conceptFilter = useStore((s) => s.conceptFilter);
  const setConceptFilter = useStore((s) => s.setConceptFilter);
  const setCurrentCollection = useStore((s) => s.setCurrentCollection);
  const setViewMode = useStore((s) => s.setViewMode);
  const pendingConceptGenerations = useStore((s) => s.pendingConceptGenerations);
  const pendingConceptCount = pendingConceptGenerations.size;
  const addContextImages = useStore((s) => s.addContextImages);
  const setRightTab = useStore((s) => s.setRightTab);
  const setReeditData = useStore((s) => s.setReeditData);
  const currentPendingId = useStore((s) => s.currentPendingId);
  const setCurrentPending = useStore((s) => s.setCurrentPending);
  const sessions = useStore((s) => s.sessions);
  const currentSessionId = useStore((s) => s.currentSessionId);
  const sessionFilter = useStore((s) => s.sessionFilter);
  const setSessionFilter = useStore((s) => s.setSessionFilter);
  const switchSession = useStore((s) => s.switchSession);
  const createSession = useStore((s) => s.createSession);
  const renameSession = useStore((s) => s.renameSession);
  const deleteSession = useStore((s) => s.deleteSession);

  const generationActionPrefs = useStore((s) => s.generationActionPrefs);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isSessionDropdownOpen, setIsSessionDropdownOpen] = useState(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [moveMenuOpenFor, setMoveMenuOpenFor] = useState<string | null>(null);
  const [overflowMenuOpenFor, setOverflowMenuOpenFor] = useState<string | null>(null);

  // Helper to check if an action should be shown as a primary button
  const isPrimaryAction = (action: GenerationAction) =>
    generationActionPrefs.primaryActions.includes(action);

  // Check if there are any actions in the overflow menu
  const hasOverflowActions = !isPrimaryAction('openLink') || !isPrimaryAction('moveToSession');

  // Session edit/delete state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionName, setEditingSessionName] = useState('');
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);

  // Count concept images for the pinned Design Library entry
  const conceptCount = useMemo(() => {
    return generations
      .filter((g) => g.is_concept)
      .reduce((sum, g) => sum + g.images.length, 0);
  }, [generations]);

  // Check if Design Library is currently active
  const isDesignLibraryActive = conceptFilter === 'concepts' && !currentGenerationId && !currentDraftId;

  // Combine drafts, pending, and actual prompts
  type PromptItem = {
    id: string;
    title: string;
    count: number;
    itemType: 'draft' | 'pending' | 'prompt';
    created_at: string;
    prompt?: string;
    basePrompt?: string; // Original user input (for reedit)
    thumbnail?: string;
    variationCount?: number;
    isGenerating?: boolean; // Per-draft generating variations state
    isGeneratingImages?: boolean; // Per-draft generating images state
    imageIds?: string[]; // Image IDs for "Add to Context" action
    contextImageIds?: string[]; // Context image IDs used for generation
    session_id?: string; // Session this generation belongs to
    hidden?: boolean; // Whether this generation is hidden
  };

  const allItems: PromptItem[] = [
    // Draft prompts always at very top
    ...draftPrompts.map((d) => ({
      id: d.id,
      title: d.title,
      count: d.variations.length,
      itemType: 'draft' as const,
      created_at: d.createdAt,
      prompt: d.basePrompt,
      basePrompt: d.basePrompt,
      variationCount: d.variations.length,
      isGenerating: d.isGenerating,
      isGeneratingImages: generatingImageDraftIds.has(d.id),
    })),
    // Pending prompts at top (below drafts)
    ...Array.from(pendingGenerations.entries()).map(([id, data]) => ({
      id,
      title: data.title || 'Generating...',
      count: data.count,
      itemType: 'pending' as const,
      created_at: new Date().toISOString(),
      prompt: data.prompt,
    })),
    // Sort actual generations by created_at descending (newest first)
    // Filter out concepts - they appear in the pinned Design Library entry
    ...generations
      .filter((g: { is_concept?: boolean }) => !g.is_concept)
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((g) => ({
        id: g.id,
        title: g.title,
        prompt: g.prompt,
        basePrompt: g.basePrompt,
        count: g.images.length,
        itemType: 'prompt' as const,
        created_at: g.created_at,
        thumbnail: g.images[0]?.image_path,
        imageIds: g.images.map((img) => img.id),
        contextImageIds: g.context_image_ids,
        session_id: g.session_id,
        hidden: g.hidden,
      })),
  ];

  const selectableItems = allItems.filter((item) => item.itemType === 'prompt' || item.itemType === 'draft');
  const allSelected = selectableItems.length > 0 && selectedGenerationIds.size === selectableItems.length;

  const handleToggleSelectionMode = () => {
    if (isSelectionMode) {
      clearGenerationSelection();
    }
    setIsSelectionMode(!isSelectionMode);
  };

  const handleDeleteSelected = async () => {
    const selectedIds = Array.from(selectedGenerationIds);

    // Separate drafts from prompts
    const draftIds = selectedIds.filter(id =>
      allItems.find(item => item.id === id)?.itemType === 'draft'
    );
    const promptIds = selectedIds.filter(id =>
      allItems.find(item => item.id === id)?.itemType === 'prompt'
    );

    // Delete drafts (local state only)
    for (const draftId of draftIds) {
      deleteDraft(draftId);
    }

    // Delete prompts (API + refresh)
    if (promptIds.length > 0) {
      await batchDeleteGenerations(promptIds);
    }

    setIsDeleteDialogOpen(false);
    setIsSelectionMode(false);
  };

  // Show empty state only if no items AND no concept images
  const showEmptyState = allItems.length === 0 && conceptCount === 0;

  // Get session name by ID
  const getSessionName = (sessionId: string | undefined | null): string => {
    if (!sessionId) return 'No session';
    const session = sessions.find((s) => s.id === sessionId);
    return session?.name || 'Unknown session';
  };

  // Get current session filter label
  const getSessionFilterLabel = (): string => {
    if (sessionFilter === 'all') {
      return 'All sessions';
    }
    // For 'current' or specific session ID
    const targetSessionId = sessionFilter === 'current' ? currentSessionId : sessionFilter;
    return targetSessionId ? getSessionName(targetSessionId) : 'All sessions';
  };

  // Get current visibility filter label
  const getVisibilityFilterLabel = (): string => {
    switch (generationFilter) {
      case 'all': return 'All';
      case 'active': return 'Active';
      case 'hidden': return 'Hidden';
      default: return 'Active';
    }
  };

  const handleCreateSession = async () => {
    if (newSessionName.trim()) {
      await createSession(newSessionName.trim());
      setNewSessionName('');
      setIsCreatingSession(false);
      setIsSessionDropdownOpen(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Selection mode header */}
      <div className="p-2 border-b border-border flex items-center justify-between">
        {/* Pending generations indicator */}
        {pendingCount > 0 && !isSelectionMode && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-generating/15 text-generating text-xs font-medium">
            <Loader2 size={12} className="animate-spin" />
            {pendingCount} generating
          </div>
        )}
        {isSelectionMode ? (
          <>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                leftIcon={allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                onClick={() => (allSelected ? clearGenerationSelection() : selectAllGenerations())}
              >
                {allSelected ? 'None' : 'All'}
              </Button>
              <span className="text-xs text-ink-muted">
                {selectedGenerationIds.size} selected
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<EyeOff size={14} />}
                onClick={async () => {
                  await hideSelectedGenerations();
                  setIsSelectionMode(false);
                }}
                disabled={selectedGenerationIds.size === 0}
              >
                Hide
              </Button>
              <Button
                size="sm"
                variant="danger"
                leftIcon={<Trash2 size={14} />}
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={selectedGenerationIds.size === 0}
              >
                Delete
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleToggleSelectionMode}
              >
                <X size={14} />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-1 ml-auto">
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<Square size={14} />}
              onClick={() => {
                setIsSelectionMode(true);
                selectAllGenerations();
              }}
            >
              All
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleToggleSelectionMode}
            >
              Select
            </Button>
          </div>
        )}
      </div>

      {/* Session and visibility filters */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border">
        {/* Session filter dropdown */}
        <div className="relative flex-1">
          <button
            onClick={() => {
              setIsSessionDropdownOpen(!isSessionDropdownOpen);
              setIsFilterDropdownOpen(false);
            }}
            className={clsx(
              'w-full flex items-center justify-between px-2 py-1 rounded-md',
              'text-xs text-ink-secondary',
              'hover:bg-canvas-subtle transition-colors',
              isSessionDropdownOpen && 'bg-canvas-subtle'
            )}
          >
            <div className="flex items-center gap-1.5">
              <Folder size={12} className="text-ink-muted" />
              <span className="truncate">{getSessionFilterLabel()}</span>
            </div>
            <ChevronDown
              size={12}
              className={clsx(
                'text-ink-muted transition-transform duration-200 flex-shrink-0',
                isSessionDropdownOpen && 'rotate-180'
              )}
            />
          </button>

        {isSessionDropdownOpen && (
          <div className="absolute left-2 right-2 top-full mt-1 z-10 bg-surface border border-border rounded-md shadow-lg py-1">
            {/* All sessions */}
            <button
              onClick={() => {
                setSessionFilter('all');
                setIsSessionDropdownOpen(false);
              }}
              className={clsx(
                'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left',
                'hover:bg-canvas-subtle transition-colors',
                sessionFilter === 'all' && 'text-brass font-medium'
              )}
            >
              <span>All sessions</span>
              {sessionFilter === 'all' && <span className="ml-auto text-brass">✓</span>}
            </button>

            {/* Divider if there are sessions */}
            {sessions.length > 0 && <div className="h-px bg-border my-1" />}

            {/* Individual sessions */}
            {sessions.map((session) => {
              const isSelected = sessionFilter === session.id ||
                (sessionFilter === 'current' && currentSessionId === session.id);
              const isEditing = editingSessionId === session.id;

              return (
                <div
                  key={session.id}
                  className={clsx(
                    'flex items-center gap-1 px-3 py-1.5',
                    'hover:bg-canvas-subtle transition-colors',
                    isSelected && 'text-brass font-medium'
                  )}
                >
                  {isEditing ? (
                    // Editing mode
                    <div className="flex-1 flex items-center gap-1">
                      <input
                        type="text"
                        value={editingSessionName}
                        onChange={(e) => setEditingSessionName(e.target.value)}
                        autoFocus
                        className={clsx(
                          'flex-1 px-2 py-0.5 text-xs rounded',
                          'bg-canvas-muted border border-transparent',
                          'focus:outline-none focus:border-brass focus:bg-surface'
                        )}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && editingSessionName.trim()) {
                            renameSession(session.id, editingSessionName.trim());
                            setEditingSessionId(null);
                          }
                          if (e.key === 'Escape') {
                            setEditingSessionId(null);
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          if (editingSessionName.trim()) {
                            renameSession(session.id, editingSessionName.trim());
                          }
                          setEditingSessionId(null);
                        }}
                        className="p-1 rounded text-success hover:bg-success/10"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        onClick={() => setEditingSessionId(null)}
                        className="p-1 rounded text-ink-muted hover:bg-canvas-muted"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    // Normal mode
                    <>
                      <button
                        onClick={() => {
                          switchSession(session.id);
                          setIsSessionDropdownOpen(false);
                        }}
                        className="flex-1 flex items-center gap-2 text-xs text-left min-w-0"
                      >
                        <span className="truncate">{session.name}</span>
                        {isSelected && <Check size={12} className="text-brass flex-shrink-0" />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingSessionId(session.id);
                          setEditingSessionName(session.name);
                        }}
                        className="p-1 rounded text-ink-muted hover:text-ink hover:bg-canvas-muted transition-colors"
                        title="Rename session"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteSessionId(session.id);
                        }}
                        className="p-1 rounded text-ink-muted hover:text-error hover:bg-error/10 transition-colors"
                        title="Delete session"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              );
            })}

            {/* Divider before new session */}
            <div className="h-px bg-border my-1" />

            {/* New session */}
            {isCreatingSession ? (
              <div className="px-2 py-1.5 flex items-center gap-1">
                <input
                  type="text"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  placeholder="Session name"
                  autoFocus
                  className={clsx(
                    'flex-1 px-2 py-1 text-xs rounded',
                    'bg-canvas-muted border border-transparent',
                    'focus:outline-none focus:border-brass focus:bg-surface',
                    'placeholder:text-ink-muted'
                  )}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateSession();
                    if (e.key === 'Escape') {
                      setIsCreatingSession(false);
                      setNewSessionName('');
                    }
                  }}
                />
                <button
                  onClick={handleCreateSession}
                  disabled={!newSessionName.trim()}
                  className="p-1 rounded text-success hover:bg-success/10 disabled:opacity-50"
                >
                  <Plus size={14} />
                </button>
                <button
                  onClick={() => {
                    setIsCreatingSession(false);
                    setNewSessionName('');
                  }}
                  className="p-1 rounded text-ink-muted hover:text-ink hover:bg-canvas-muted"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsCreatingSession(true)}
                className={clsx(
                  'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left',
                  'text-ink-muted hover:bg-canvas-subtle hover:text-ink transition-colors'
                )}
              >
                <Plus size={12} />
                <span>New session</span>
              </button>
            )}
          </div>
        )}
        </div>

        {/* Visibility filter dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setIsFilterDropdownOpen(!isFilterDropdownOpen);
              setIsSessionDropdownOpen(false);
            }}
            className={clsx(
              'flex items-center gap-1 px-2 py-1 rounded-md',
              'text-xs text-ink-secondary',
              'hover:bg-canvas-subtle transition-colors',
              isFilterDropdownOpen && 'bg-canvas-subtle',
              generationFilter === 'hidden' && 'text-warning'
            )}
            title="Filter by visibility"
          >
            <Filter size={12} className="text-ink-muted" />
            <span>{getVisibilityFilterLabel()}</span>
          </button>

          {isFilterDropdownOpen && (
            <div className="absolute right-0 top-full mt-1 z-10 bg-surface border border-border rounded-md shadow-lg py-1 min-w-[100px]">
              <button
                onClick={() => {
                  setGenerationFilter('active');
                  setIsFilterDropdownOpen(false);
                }}
                className={clsx(
                  'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left',
                  'hover:bg-canvas-subtle transition-colors',
                  generationFilter === 'active' && 'text-brass font-medium'
                )}
              >
                <Eye size={12} />
                <span>Active</span>
                {generationFilter === 'active' && <Check size={12} className="ml-auto text-brass" />}
              </button>
              <button
                onClick={() => {
                  setGenerationFilter('hidden');
                  setIsFilterDropdownOpen(false);
                }}
                className={clsx(
                  'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left',
                  'hover:bg-canvas-subtle transition-colors',
                  generationFilter === 'hidden' && 'text-warning font-medium'
                )}
              >
                <EyeOff size={12} />
                <span>Hidden</span>
                {generationFilter === 'hidden' && <Check size={12} className="ml-auto text-warning" />}
              </button>
              <button
                onClick={() => {
                  setGenerationFilter('all');
                  setIsFilterDropdownOpen(false);
                }}
                className={clsx(
                  'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left',
                  'hover:bg-canvas-subtle transition-colors',
                  generationFilter === 'all' && 'text-brass font-medium'
                )}
              >
                <span className="w-3" />
                <span>All</span>
                {generationFilter === 'all' && <Check size={12} className="ml-auto text-brass" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Prompts list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Pinned Design Library entry */}
        <button
          onClick={() => {
            setCurrentGeneration(null);
            setCurrentDraft(null);
            setCurrentCollection(null);
            setConceptFilter('concepts');
            setViewMode('grid');
          }}
          className={clsx(
            'w-full flex items-center gap-3 p-2.5 rounded-lg',
            'transition-all duration-150',
            isDesignLibraryActive
              ? 'bg-brass-muted ring-1 ring-brass/30'
              : 'hover:bg-canvas-subtle'
          )}
        >
          <div
            className={clsx(
              'w-12 h-12 rounded-md flex-shrink-0 flex items-center justify-center',
              isDesignLibraryActive ? 'bg-brass/20' : 'bg-brass/10'
            )}
          >
            {pendingConceptCount > 0 ? (
              <Loader2 size={20} className="text-brass animate-spin" />
            ) : (
              <Sparkles size={20} className="text-brass" />
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center justify-between gap-2">
              <h3
                className={clsx(
                  'text-sm font-medium',
                  isDesignLibraryActive ? 'text-ink' : 'text-ink-secondary'
                )}
              >
                Design Library
              </h3>
              <div className="flex items-center gap-1.5">
                {pendingConceptCount > 0 && (
                  <span className="flex-shrink-0 text-[0.625rem] font-medium px-1.5 py-0.5 rounded bg-brass/30 text-brass animate-pulse">
                    +{pendingConceptCount}
                  </span>
                )}
                <span className="flex-shrink-0 text-[0.625rem] font-medium px-1.5 py-0.5 rounded bg-brass/15 text-brass">
                  {conceptCount}
                </span>
              </div>
            </div>
            <p className="text-[0.625rem] text-ink-muted mt-0.5">
              {pendingConceptCount > 0
                ? `Generating ${pendingConceptCount} concept${pendingConceptCount !== 1 ? 's' : ''}...`
                : 'Concept images from design tokens'}
            </p>
          </div>
        </button>

        {/* Empty state */}
        {showEmptyState && (
          <div className="flex flex-col items-center justify-center text-center p-6 mt-4">
            <div className="w-12 h-12 rounded-full bg-canvas-muted flex items-center justify-center mb-3">
              <ImageIcon size={20} className="text-ink-muted" />
            </div>
            <p className="text-sm text-ink-secondary">No prompts yet</p>
            <p className="text-xs text-ink-muted mt-1">
              Generate your first images to get started
            </p>
          </div>
        )}

        {/* Separator */}
        {allItems.length > 0 && (
          <div className="h-px bg-border my-2" />
        )}

        {allItems.map((item, index) => {
          const isDraft = item.itemType === 'draft';
          const isPending = item.itemType === 'pending';
          const isPrompt = item.itemType === 'prompt';
          const isActive = isDraft
            ? item.id === currentDraftId
            : isPending
            ? item.id === currentPendingId
            : item.id === currentGenerationId;
          const isSelected = selectedGenerationIds.has(item.id);
          const isSelectable = isPrompt || isDraft;

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
              className={clsx(
                'group relative rounded-lg overflow-hidden',
                'transition-all duration-150',
                isPending && !isActive && 'shimmer',
                isDraft && 'border border-dashed border-brass/40',
                isActive && !isSelectionMode
                  ? isDraft
                    ? 'bg-brass/10 ring-1 ring-brass/40'
                    : isPending
                    ? 'bg-generating/15 ring-1 ring-generating/30'
                    : 'bg-brass-muted ring-1 ring-brass/30'
                  : 'hover:bg-canvas-subtle',
                isSelected && 'bg-brass-muted/50'
              )}
            >
              {/* Main row: checkbox + content */}
              <div className="flex items-center gap-2">
              {/* Checkbox (only in selection mode, for prompts and drafts) */}
              {isSelectionMode && isSelectable && (
                <button
                  onClick={() => toggleGenerationSelection(item.id)}
                  className="pl-2 py-2.5"
                >
                  <div
                    className={clsx(
                      'w-5 h-5 rounded border-2 flex items-center justify-center',
                      'transition-all',
                      isSelected
                        ? 'bg-brass border-brass text-surface'
                        : 'border-ink-muted'
                    )}
                  >
                    {isSelected && (
                      <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </button>
              )}

              {/* Main content button */}
              <button
                onClick={() => {
                  if (isSelectionMode && isSelectable) {
                    toggleGenerationSelection(item.id);
                  } else if (isDraft) {
                    setCurrentDraft(item.id);
                  } else if (isPending) {
                    setCurrentPending(item.id);
                    setCurrentDraft(null);
                    setGenerationFilter('all');
                  } else if (isPrompt) {
                    setCurrentDraft(null); // Clear any selected draft
                    setGenerationFilter('all'); // Clear concepts filter when selecting a prompt
                    setCurrentGeneration(item.id);
                  }
                }}
                className="flex-1 text-left"
              >
                <div className="flex gap-3 p-2.5 pl-0">
                  {/* Thumbnail */}
                  <div
                    className={clsx(
                      'w-12 h-12 rounded-md flex-shrink-0 overflow-hidden',
                      isDraft ? 'bg-brass/10 border border-dashed border-brass/30' : 'bg-canvas-muted',
                      !isSelectionMode && 'ml-2.5'
                    )}
                  >
                    {isDraft ? (
                      // Draft: show edit icon or loading spinner
                      <div className="w-full h-full flex items-center justify-center">
                        {(item.isGenerating || item.isGeneratingImages) ? (
                          <Loader2 size={16} className="text-brass animate-spin" />
                        ) : (
                          <FileEdit size={16} className="text-brass" />
                        )}
                      </div>
                    ) : isPending ? (
                      // Single spinner for generating images
                      <div className="w-full h-full flex items-center justify-center bg-generating/10">
                        <Loader2 size={16} className="text-generating animate-spin" />
                      </div>
                    ) : item.thumbnail ? (
                      <img
                        src={getImageUrl(item.thumbnail)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon size={16} className="text-ink-muted" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Title row with metadata */}
                    <div className="flex items-center justify-between gap-2">
                      <h3
                        className={clsx(
                          'text-sm font-medium truncate',
                          isActive ? 'text-ink' : 'text-ink-secondary'
                        )}
                      >
                        {item.title}
                      </h3>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Count badge */}
                        <span
                          className={clsx(
                            'text-[0.625rem] font-medium px-1.5 py-0.5 rounded',
                            isDraft
                              ? 'bg-brass/15 text-brass'
                              : isPending
                              ? 'bg-generating/15 text-generating'
                              : 'bg-canvas-muted text-ink-tertiary'
                          )}
                        >
                          {isDraft ? 'Draft' : item.count}
                        </span>
                        {/* Date/status */}
                        <span className="text-[0.625rem] text-ink-muted">
                          {isDraft
                            ? item.isGeneratingImages
                              ? 'Generating...'
                              : item.isGenerating
                              ? 'Creating...'
                              : `${item.variationCount}v`
                            : isPending
                            ? 'Generating...'
                            : new Date(item.created_at).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
              </div>

              {/* Discard button for drafts (on hover) */}
              {isDraft && !isSelectionMode && (
                <div className="overflow-hidden transition-all duration-200 max-h-0 group-hover:max-h-10 opacity-0 group-hover:opacity-100 ml-[62px] -mt-1">
                  <div className="flex items-center gap-0.5 pt-1 pb-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteDraft(item.id);
                      }}
                      title="Discard draft"
                      className="p-1.5 rounded hover:bg-error/20 text-ink-muted hover:text-error transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons (prompts only, on hover) - row below title */}
              {isPrompt && item.imageIds && item.imageIds.length > 0 && !isSelectionMode && (
                <div className="overflow-hidden transition-all duration-200 max-h-0 group-hover:max-h-10 opacity-0 group-hover:opacity-100 ml-[62px] -mt-1">
                  <div className="flex items-center gap-0.5 pt-1 pb-2">
                    {/* Go to session button - only show if viewing all sessions or a different session */}
                    {isPrimaryAction('openLink') && item.session_id && item.session_id !== currentSessionId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          switchSession(item.session_id!);
                        }}
                        title={`Go to ${getSessionName(item.session_id)}`}
                        className="p-1.5 rounded hover:bg-canvas-subtle text-ink-muted hover:text-ink transition-colors"
                      >
                        <ExternalLink size={14} />
                      </button>
                    )}
                    {/* Reedit button - loads base prompt + context into Generate tab */}
                    {isPrimaryAction('reedit') && (item.basePrompt || item.prompt) && item.contextImageIds && item.contextImageIds.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setReeditData(item.basePrompt || item.prompt!, item.contextImageIds!);
                          setRightTab('generate');
                        }}
                        title="Reedit"
                        className="p-1.5 rounded hover:bg-canvas-subtle text-ink-muted hover:text-ink transition-colors"
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                    {/* Add to Context button */}
                    {isPrimaryAction('addToContext') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addContextImages(item.imageIds!);
                          setRightTab('generate');
                        }}
                        title="Add to Context"
                        className="p-1.5 rounded hover:bg-brass/20 text-brass hover:text-brass transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                    )}
                    {/* Move to session button (primary) */}
                    {isPrimaryAction('moveToSession') && (
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMoveMenuOpenFor(moveMenuOpenFor === item.id ? null : item.id);
                            setOverflowMenuOpenFor(null);
                          }}
                          title="Move to session"
                          className="p-1.5 rounded hover:bg-canvas-subtle text-ink-muted hover:text-ink transition-colors"
                        >
                          <ArrowRightLeft size={14} />
                        </button>
                        {moveMenuOpenFor === item.id && (
                          <div className="absolute right-full top-0 mr-1 bg-surface border border-border rounded-md shadow-lg py-1 min-w-[140px] z-20">
                            <div className="px-2 py-1 text-[0.625rem] text-ink-muted font-medium border-b border-border mb-1">
                              Move to session
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                moveGenerationToSession(item.id, null);
                                setMoveMenuOpenFor(null);
                              }}
                              className={clsx(
                                'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left',
                                'hover:bg-canvas-subtle transition-colors',
                                !item.session_id && 'text-brass font-medium'
                              )}
                            >
                              <span>No session</span>
                              {!item.session_id && <Check size={10} className="ml-auto text-brass" />}
                            </button>
                            {sessions.map((session) => (
                              <button
                                key={session.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveGenerationToSession(item.id, session.id);
                                  setMoveMenuOpenFor(null);
                                }}
                                className={clsx(
                                  'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left',
                                  'hover:bg-canvas-subtle transition-colors',
                                  item.session_id === session.id && 'text-brass font-medium'
                                )}
                              >
                                <span className="truncate">{session.name}</span>
                                {item.session_id === session.id && <Check size={10} className="ml-auto text-brass flex-shrink-0" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Hide/Unhide button */}
                    {isPrimaryAction('hide') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (item.hidden) {
                            unhideGeneration(item.id);
                          } else {
                            hideGeneration(item.id);
                          }
                        }}
                        title={item.hidden ? "Unhide" : "Hide"}
                        className={clsx(
                          "p-1.5 rounded transition-colors",
                          item.hidden
                            ? "hover:bg-success/20 text-success hover:text-success"
                            : "hover:bg-canvas-subtle text-ink-muted hover:text-ink"
                        )}
                      >
                        {item.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                    )}
                    {/* Overflow menu for non-primary actions */}
                    {hasOverflowActions && (
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOverflowMenuOpenFor(overflowMenuOpenFor === item.id ? null : item.id);
                            setMoveMenuOpenFor(null);
                          }}
                          title="More actions"
                          className="p-1.5 rounded hover:bg-canvas-subtle text-ink-muted hover:text-ink transition-colors"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                        {overflowMenuOpenFor === item.id && (
                          <div className="absolute right-full top-0 mr-1 bg-surface border border-border rounded-md shadow-lg py-1 min-w-[160px] z-20">
                            {/* Go to session (overflow) */}
                            {!isPrimaryAction('openLink') && item.session_id && item.session_id !== currentSessionId && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  switchSession(item.session_id!);
                                  setOverflowMenuOpenFor(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-canvas-subtle transition-colors"
                              >
                                <ExternalLink size={12} />
                                <span>Go to {getSessionName(item.session_id)}</span>
                              </button>
                            )}
                            {/* Reedit (overflow) */}
                            {!isPrimaryAction('reedit') && (item.basePrompt || item.prompt) && item.contextImageIds && item.contextImageIds.length > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReeditData(item.basePrompt || item.prompt!, item.contextImageIds!);
                                  setRightTab('generate');
                                  setOverflowMenuOpenFor(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-canvas-subtle transition-colors"
                              >
                                <RotateCcw size={12} />
                                <span>Reedit</span>
                              </button>
                            )}
                            {/* Add to Context (overflow) */}
                            {!isPrimaryAction('addToContext') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addContextImages(item.imageIds!);
                                  setRightTab('generate');
                                  setOverflowMenuOpenFor(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-canvas-subtle transition-colors text-brass"
                              >
                                <Plus size={12} />
                                <span>Add to Context</span>
                              </button>
                            )}
                            {/* Move to session (overflow) - opens submenu */}
                            {!isPrimaryAction('moveToSession') && (
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMoveMenuOpenFor(moveMenuOpenFor === `overflow-${item.id}` ? null : `overflow-${item.id}`);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-canvas-subtle transition-colors"
                                >
                                  <ArrowRightLeft size={12} />
                                  <span>Move to session</span>
                                  <ChevronDown size={10} className="ml-auto -rotate-90" />
                                </button>
                                {moveMenuOpenFor === `overflow-${item.id}` && (
                                  <div className="absolute right-full top-0 mr-1 bg-surface border border-border rounded-md shadow-lg py-1 min-w-[140px] z-30">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        moveGenerationToSession(item.id, null);
                                        setMoveMenuOpenFor(null);
                                        setOverflowMenuOpenFor(null);
                                      }}
                                      className={clsx(
                                        'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left',
                                        'hover:bg-canvas-subtle transition-colors',
                                        !item.session_id && 'text-brass font-medium'
                                      )}
                                    >
                                      <span>No session</span>
                                      {!item.session_id && <Check size={10} className="ml-auto text-brass" />}
                                    </button>
                                    {sessions.map((session) => (
                                      <button
                                        key={session.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          moveGenerationToSession(item.id, session.id);
                                          setMoveMenuOpenFor(null);
                                          setOverflowMenuOpenFor(null);
                                        }}
                                        className={clsx(
                                          'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left',
                                          'hover:bg-canvas-subtle transition-colors',
                                          item.session_id === session.id && 'text-brass font-medium'
                                        )}
                                      >
                                        <span className="truncate">{session.name}</span>
                                        {item.session_id === session.id && <Check size={10} className="ml-auto text-brass flex-shrink-0" />}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            {/* Hide/Unhide (overflow) */}
                            {!isPrimaryAction('hide') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (item.hidden) {
                                    unhideGeneration(item.id);
                                  } else {
                                    hideGeneration(item.id);
                                  }
                                  setOverflowMenuOpenFor(null);
                                }}
                                className={clsx(
                                  "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors",
                                  item.hidden
                                    ? "hover:bg-success/20 text-success"
                                    : "hover:bg-canvas-subtle"
                                )}
                              >
                                {item.hidden ? <Eye size={12} /> : <EyeOff size={12} />}
                                <span>{item.hidden ? "Unhide" : "Hide"}</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteSelected}
        title="Delete Prompts"
        message={`Are you sure you want to delete ${selectedGenerationIds.size} prompt${selectedGenerationIds.size !== 1 ? 's' : ''} and all their images? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Delete session confirmation dialog */}
      <ConfirmDialog
        isOpen={!!deleteSessionId}
        onClose={() => setDeleteSessionId(null)}
        onConfirm={() => {
          if (deleteSessionId) {
            deleteSession(deleteSessionId, true);
            setDeleteSessionId(null);
          }
        }}
        title="Delete Session"
        message="Are you sure you want to delete this session and all its generations? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
