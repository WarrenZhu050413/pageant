import { useMemo, useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  ScanSearch,
  Square,
  CheckSquare,
  Search,
  X,
  Folder,
  ChevronDown,
  Images,
} from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';
import { Button, IconButton, ImageContextMenu, type ContextMenuPosition } from '../ui';

type SessionFilter = 'current' | 'all' | string;

// Debounce hook for search
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export function AllImagesGalleryView() {
  // Store actions
  const setViewingAllImages = useStore((s) => s.setViewingAllImages);
  const getAllGenerations = useStore((s) => s.getAllGenerations);
  const prompts = getAllGenerations();
  const selectionMode = useStore((s) => s.selectionMode);
  const selectedIds = useStore((s) => s.selectedIds);
  const setSelectionMode = useStore((s) => s.setSelectionMode);
  const toggleSelection = useStore((s) => s.toggleSelection);
  const setSelectedIds = useStore((s) => s.setSelectedIds);
  const clearSelection = useStore((s) => s.clearSelection);
  const setCurrentGeneration = useStore((s) => s.setCurrentGeneration);
  const setCurrentImageIndex = useStore((s) => s.setCurrentImageIndex);
  const setCurrentCollection = useStore((s) => s.setCurrentCollection);
  const setViewMode = useStore((s) => s.setViewMode);
  const sessions = useStore((s) => s.sessions);
  const currentSessionId = useStore((s) => s.currentSessionId);
  const findSimilar = useStore((s) => s.findSimilar);
  const deleteImage = useStore((s) => s.deleteImage);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>('current');
  const [isSessionDropdownOpen, setIsSessionDropdownOpen] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 200);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    position: ContextMenuPosition;
    imageId: string;
    promptId: string;
    indexInPrompt: number;
  } | null>(null);

  // Ref for grid container
  const gridRef = useRef<HTMLDivElement>(null);

  // Build flattened list of all images with metadata
  const allImages = useMemo(() => {
    return prompts.flatMap((prompt) =>
      prompt.images.map((image, indexInPrompt) => ({
        image,
        promptId: prompt.id,
        promptTitle: prompt.title,
        sessionId: prompt.session_id,
        indexInPrompt,
        isConcept: prompt.is_concept ?? false,
      }))
    );
  }, [prompts]);

  // Get session name by ID
  const getSessionName = (sessionId: string | undefined | null): string => {
    if (!sessionId) return 'No session';
    const session = sessions.find((s) => s.id === sessionId);
    return session?.name || 'Unknown session';
  };

  // Get current filter label
  const getFilterLabel = (): string => {
    if (sessionFilter === 'all') {
      return 'All sessions';
    }
    const targetSessionId = sessionFilter === 'current' ? currentSessionId : sessionFilter;
    return targetSessionId ? getSessionName(targetSessionId) : 'All sessions';
  };

  // Session filter matcher
  const matchesSessionFilter = (item: typeof allImages[0]): boolean => {
    if (sessionFilter === 'all') return true;
    const targetSessionId = sessionFilter === 'current' ? currentSessionId : sessionFilter;
    return item.sessionId === targetSessionId;
  };

  // Filter images
  const filteredImages = useMemo(() => {
    return allImages.filter((item) => {
      // Session filter
      if (!matchesSessionFilter(item)) return false;

      // Text search
      if (debouncedSearch) {
        const query = debouncedSearch.toLowerCase();
        const matches =
          item.promptTitle.toLowerCase().includes(query) ||
          item.image.variation_title?.toLowerCase().includes(query) ||
          item.image.annotation?.toLowerCase().includes(query) ||
          item.image.varied_prompt?.toLowerCase().includes(query);
        if (!matches) return false;
      }

      return true;
    });
  }, [allImages, debouncedSearch, sessionFilter, currentSessionId]);

  const isSelectMode = selectionMode === 'select';

  const handleImageClick = (item: typeof allImages[0]) => {
    if (isSelectMode) {
      toggleSelection(item.image.id);
    } else {
      // Navigate to the image in its prompt
      setViewingAllImages(false);
      setCurrentCollection(null);
      setCurrentGeneration(item.promptId);
      setCurrentImageIndex(item.indexInPrompt);
      setViewMode('single');
    }
  };

  const handleContextMenu = (e: React.MouseEvent, item: typeof allImages[0]) => {
    e.preventDefault();
    setContextMenu({
      position: { x: e.clientX, y: e.clientY },
      imageId: item.image.id,
      promptId: item.promptId,
      indexInPrompt: item.indexInPrompt,
    });
  };

  const handleToggleSelectMode = () => {
    if (isSelectMode) {
      clearSelection();
      setSelectionMode('none');
    } else {
      setSelectionMode('select');
    }
  };

  const hasActiveFilters = searchQuery || sessionFilter !== 'current';

  return (
    <div className="flex flex-col h-full bg-canvas">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
        <div className="flex items-center gap-3 min-w-0">
          <IconButton
            size="sm"
            variant="ghost"
            tooltip="Exit gallery"
            onClick={() => setViewingAllImages(false)}
          >
            <ArrowLeft size={16} />
          </IconButton>
          <div className="flex items-center gap-2">
            <Images size={16} className="text-brass" />
            <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-ink">
              All Images
            </h2>
          </div>
          <span className="text-xs text-ink-muted">
            {filteredImages.length}{hasActiveFilters ? ` of ${allImages.length}` : ''} image{filteredImages.length !== 1 ? 's' : ''}
            {isSelectMode && selectedIds.size > 0 && (
              <span className="ml-1 text-brass">
                ({selectedIds.size} selected)
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Search input */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              placeholder="Search images..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={clsx(
                'w-48 pl-8 pr-8 py-1.5 text-sm rounded-md',
                'bg-canvas-subtle border border-border',
                'focus:outline-none focus:ring-2 focus:ring-brass/50',
                'placeholder:text-ink-muted'
              )}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Session filter dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsSessionDropdownOpen(!isSessionDropdownOpen)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm',
                'bg-canvas-subtle border border-border',
                'hover:bg-canvas transition-colors',
                isSessionDropdownOpen && 'bg-canvas'
              )}
            >
              <Folder size={14} className="text-ink-muted" />
              <span className="text-ink-secondary">{getFilterLabel()}</span>
              <ChevronDown
                size={12}
                className={clsx(
                  'text-ink-muted transition-transform duration-200',
                  isSessionDropdownOpen && 'rotate-180'
                )}
              />
            </button>

            {isSessionDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 min-w-[160px] bg-surface border border-border rounded-md shadow-lg py-1">
                <button
                  onClick={() => {
                    setSessionFilter('all');
                    setIsSessionDropdownOpen(false);
                  }}
                  className={clsx(
                    'w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left',
                    'hover:bg-canvas-subtle transition-colors',
                    sessionFilter === 'all' && 'text-brass font-medium'
                  )}
                >
                  <span>All sessions</span>
                  {sessionFilter === 'all' && <span className="ml-auto text-brass">✓</span>}
                </button>

                {sessions.length > 0 && <div className="h-px bg-border my-1" />}

                {sessions.map((session) => {
                  const isSelected = sessionFilter === session.id ||
                    (sessionFilter === 'current' && session.id === currentSessionId);
                  return (
                    <button
                      key={session.id}
                      onClick={() => {
                        setSessionFilter(session.id);
                        setIsSessionDropdownOpen(false);
                      }}
                      className={clsx(
                        'w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left',
                        'hover:bg-canvas-subtle transition-colors',
                        isSelected && 'text-brass font-medium'
                      )}
                    >
                      <span className="truncate">{session.name}</span>
                      {isSelected && <span className="ml-auto text-brass">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-border" />

          {/* Selection controls */}
          {isSelectMode && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (selectedIds.size === filteredImages.length) {
                  clearSelection();
                } else {
                  setSelectedIds(filteredImages.map((item) => item.image.id));
                }
              }}
            >
              {selectedIds.size === filteredImages.length ? 'Deselect All' : 'Select All'}
            </Button>
          )}

          <Button
            size="sm"
            variant={isSelectMode ? 'brass' : 'secondary'}
            leftIcon={isSelectMode ? <CheckSquare size={14} /> : <Square size={14} />}
            onClick={handleToggleSelectMode}
          >
            {isSelectMode ? 'Done' : 'Select (S)'}
          </Button>
        </div>
      </header>

      {/* Content */}
      {filteredImages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center p-6">
          <div className="w-12 h-12 rounded-full bg-canvas-muted flex items-center justify-center mb-3">
            <Images size={20} className="text-ink-muted" />
          </div>
          <p className="text-sm text-ink-secondary">No images found</p>
          {hasActiveFilters && (
            <p className="text-xs text-ink-muted mt-1">
              Try adjusting your search or filters
            </p>
          )}
        </div>
      ) : (
        <div ref={gridRef} className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {filteredImages.map((item, index) => {
              const isSelected = selectedIds.has(item.image.id);

              return (
                <motion.div
                  key={item.image.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.01, 0.3) }}
                  className={clsx(
                    'group relative aspect-square overflow-hidden rounded-lg',
                    'bg-canvas-muted cursor-pointer',
                    'transition-all duration-200',
                    isSelected
                      ? 'ring-4 ring-brass shadow-lg scale-[0.98]'
                      : 'hover:shadow-lg hover:scale-[1.02]'
                  )}
                  onClick={() => handleImageClick(item)}
                  onContextMenu={(e) => handleContextMenu(e, item)}
                >
                  <img
                    src={getImageUrl(item.image.image_path)}
                    alt={item.promptTitle}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />

                  {/* Hover overlay */}
                  <div
                    className={clsx(
                      'absolute inset-0 bg-ink/20',
                      'opacity-0 group-hover:opacity-100 transition-opacity'
                    )}
                  />

                  {/* Find Similar button (on hover) */}
                  {!isSelectMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        findSimilar(item.image.id);
                      }}
                      className={clsx(
                        'absolute top-2 left-2 w-7 h-7 rounded-full',
                        'flex items-center justify-center',
                        'transition-all duration-200',
                        'bg-surface/80 text-ink-muted opacity-0 group-hover:opacity-100 hover:text-brass'
                      )}
                      title="Find similar"
                    >
                      <ScanSearch size={14} />
                    </button>
                  )}

                  {/* Selection indicator */}
                  {isSelectMode && (
                    <div
                      className={clsx(
                        'absolute top-2 left-2 w-5 h-5 rounded-full border-2',
                        'flex items-center justify-center transition-all',
                        isSelected
                          ? 'bg-brass border-brass text-surface'
                          : 'bg-surface/80 border-ink-muted opacity-0 group-hover:opacity-100'
                      )}
                    >
                      {isSelected && <Check size={12} strokeWidth={3} />}
                    </div>
                  )}

                  {/* Prompt title tooltip on hover */}
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[0.625rem] text-white truncate">
                      {item.image.variation_title || item.promptTitle}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Navigation hint */}
          <div className="flex items-center justify-center gap-2 py-4 text-ink-muted">
            <span className="text-xs">Click an image to view it</span>
          </div>
        </div>
      )}

      {/* Context Menu */}
      <ImageContextMenu
        position={contextMenu?.position ?? null}
        onClose={() => setContextMenu(null)}
        onFindSimilar={
          contextMenu
            ? () => findSimilar(contextMenu.imageId)
            : undefined
        }
        onDelete={
          contextMenu
            ? () => deleteImage(contextMenu.imageId)
            : undefined
        }
      />
    </div>
  );
}
