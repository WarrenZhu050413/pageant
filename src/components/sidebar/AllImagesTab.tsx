import { useMemo, useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { Images, Check, Square, CheckSquare, Search, X, Loader2 } from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';
import { Button } from '../ui';
import type { ImageData } from '../../types';

type ConceptFilter = 'all' | 'concepts' | 'non-concepts';

// Debounce hook for search
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export function AllImagesTab() {
  const prompts = useStore((s) => s.generations);
  const selectionMode = useStore((s) => s.selectionMode);
  const selectedIds = useStore((s) => s.selectedIds);
  const setSelectionMode = useStore((s) => s.setSelectionMode);
  const toggleSelection = useStore((s) => s.toggleSelection);
  const setSelectedIds = useStore((s) => s.setSelectedIds);
  const clearSelection = useStore((s) => s.clearSelection);
  const setCurrentGeneration = useStore((s) => s.setCurrentGeneration);
  const setCurrentImageIndex = useStore((s) => s.setCurrentImageIndex);
  const setCurrentCollection = useStore((s) => s.setCurrentCollection);

  // Semantic search state from store
  const searchMode = useStore((s) => s.searchMode);
  const setSearchMode = useStore((s) => s.setSearchMode);
  const semanticResults = useStore((s) => s.semanticResults);
  const isSearching = useStore((s) => s.isSearching);
  const similarToImageId = useStore((s) => s.similarToImageId);
  const searchSemantic = useStore((s) => s.searchSemantic);
  const clearSemanticSearch = useStore((s) => s.clearSemanticSearch);
  const fetchIndexedIds = useStore((s) => s.fetchIndexedIds);
  const indexedImageIds = useStore((s) => s.indexedImageIds);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [conceptFilter, setConceptFilter] = useState<ConceptFilter>('all');

  // Debounce semantic search
  const debouncedQuery = useDebounce(searchQuery, 300);

  // Fetch indexed IDs on mount
  useEffect(() => {
    fetchIndexedIds();
  }, [fetchIndexedIds]);

  // Trigger semantic search when query changes (in semantic mode)
  useEffect(() => {
    if (searchMode === 'semantic' && debouncedQuery && !similarToImageId) {
      searchSemantic(debouncedQuery);
    }
  }, [debouncedQuery, searchMode, similarToImageId, searchSemantic]);

  // Flatten all images from all prompts, sorted by creation date (newest first)
  const allImages = useMemo(() => {
    const images: {
      image: ImageData;
      promptId: string;
      promptTitle: string;
      indexInPrompt: number;
      isConcept: boolean;
    }[] = [];
    for (const prompt of prompts) {
      prompt.images.forEach((image, index) => {
        images.push({
          image,
          promptId: prompt.id,
          promptTitle: prompt.title,
          indexInPrompt: index,
          isConcept: prompt.is_concept ?? false,
        });
      });
    }
    // Sort by generated_at descending (newest first)
    return images.sort((a, b) =>
      new Date(b.image.generated_at).getTime() - new Date(a.image.generated_at).getTime()
    );
  }, [prompts]);

  // Build a map from image ID to full image data for semantic results
  const imageDataMap = useMemo(() => {
    const map = new Map<string, typeof allImages[0]>();
    for (const item of allImages) {
      map.set(item.image.id, item);
    }
    return map;
  }, [allImages]);

  // Apply filters - different logic for semantic vs text search
  const filteredImages = useMemo(() => {
    // If we have semantic results (from search or find similar), use those
    if (searchMode === 'semantic' && (semanticResults || similarToImageId)) {
      if (!semanticResults) return [];

      // Convert semantic results to display format, adding similarity scores
      const results: (typeof allImages[0] & { score?: number })[] = [];

      // If in "Find Similar" mode, add the source image first with score 1.0
      if (similarToImageId) {
        const sourceItem = imageDataMap.get(similarToImageId);
        if (sourceItem) {
          results.push({ ...sourceItem, score: 1.0 });
        }
      }

      // Add semantic results
      for (const result of semanticResults) {
        const item = imageDataMap.get(result.id);
        if (item && result.id !== similarToImageId) {
          results.push({ ...item, score: result.score });
        }
      }

      // Apply concept filter
      return results.filter((item) => {
        if (conceptFilter === 'concepts' && !item.isConcept) return false;
        if (conceptFilter === 'non-concepts' && item.isConcept) return false;
        return true;
      });
    }

    // Text search mode - use local client-side filtering
    return allImages.filter((item) => {
      // Text search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matches =
          item.promptTitle.toLowerCase().includes(query) ||
          item.image.variation_title?.toLowerCase().includes(query) ||
          item.image.annotation?.toLowerCase().includes(query) ||
          item.image.varied_prompt?.toLowerCase().includes(query);
        if (!matches) return false;
      }

      // Concept filter
      if (conceptFilter === 'concepts' && !item.isConcept) return false;
      if (conceptFilter === 'non-concepts' && item.isConcept) return false;

      return true;
    });
  }, [allImages, imageDataMap, searchQuery, conceptFilter, searchMode, semanticResults, similarToImageId]);

  const isSelectMode = selectionMode === 'select';

  const handleImageClick = (item: typeof allImages[0]) => {
    if (isSelectMode) {
      toggleSelection(item.image.id);
    } else {
      // Navigate to the image in its prompt
      setCurrentCollection(null);
      setCurrentGeneration(item.promptId);
      setCurrentImageIndex(item.indexInPrompt);
    }
  };

  const handleToggleSelectMode = () => {
    if (isSelectMode) {
      clearSelection();
      setSelectionMode('none');
    } else {
      setSelectionMode('select');
    }
  };

  if (allImages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <div className="w-12 h-12 rounded-full bg-canvas-muted flex items-center justify-center mb-3">
          <Images size={20} className="text-ink-muted" />
        </div>
        <p className="text-sm text-ink-secondary">No images yet</p>
        <p className="text-xs text-ink-muted mt-1">
          Generate some images to see them here
        </p>
      </div>
    );
  }

  const hasActiveFilters = searchQuery || conceptFilter !== 'all';

  return (
    <div className="flex flex-col h-full">
      {/* Header with select mode toggle */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs text-ink-muted">
          {filteredImages.length}{hasActiveFilters ? ` of ${allImages.length}` : ''} image{filteredImages.length !== 1 ? 's' : ''}
          {isSelectMode && selectedIds.size > 0 && (
            <span className="ml-1 text-brass">
              ({selectedIds.size} selected)
            </span>
          )}
        </span>
        <div className="flex items-center gap-1">
          {isSelectMode && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (selectedIds.size === filteredImages.length) {
                  clearSelection();
                } else {
                  // Select all images visible in this view
                  setSelectedIds(filteredImages.map((item) => item.image.id));
                }
              }}
            >
              {selectedIds.size === filteredImages.length ? 'Deselect All' : 'Select All'}
            </Button>
          )}
          <Button
            size="sm"
            variant={isSelectMode ? 'primary' : 'secondary'}
            leftIcon={isSelectMode ? <CheckSquare size={12} /> : <Square size={12} />}
            onClick={handleToggleSelectMode}
          >
            {isSelectMode ? 'Done' : 'Select'}
          </Button>
        </div>
      </div>

      {/* Filter controls */}
      <div className="px-3 py-2 space-y-2 border-b border-border">
        {/* Similar to indicator */}
        {similarToImageId && (
          <div className="flex items-center gap-2 p-2 bg-brass/10 rounded border border-brass/20">
            <img
              src={getImageUrl(imageDataMap.get(similarToImageId)?.image.image_path || '')}
              alt=""
              className="w-8 h-8 object-cover rounded ring-2 ring-brass"
            />
            <span className="text-xs text-ink flex-1">Similar to this image</span>
            <button
              onClick={() => {
                clearSemanticSearch();
                setSearchQuery('');
              }}
              className="text-ink-muted hover:text-ink"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Search input */}
        {!similarToImageId && (
          <div className="relative">
            {isSearching ? (
              <Loader2 size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brass animate-spin" />
            ) : (
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
            )}
            <input
              type="text"
              placeholder={searchMode === 'semantic' ? 'Search by meaning...' : 'Search...'}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                // Clear semantic results when typing (will trigger new search via debounce)
                if (searchMode === 'semantic' && !e.target.value) {
                  clearSemanticSearch();
                }
              }}
              className={clsx(
                'w-full pl-8 pr-8 py-1.5 text-xs',
                'bg-canvas-muted border border-transparent rounded',
                'focus:outline-none focus:border-brass focus:bg-surface',
                'placeholder:text-ink-muted'
              )}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  clearSemanticSearch();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}

        {/* Search mode radio toggle */}
        {!similarToImageId && (
          <div className="flex items-center gap-3 text-[10px]">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="searchMode"
                checked={searchMode === 'text'}
                onChange={() => {
                  setSearchMode('text');
                  clearSemanticSearch();
                }}
                className="w-3 h-3 accent-brass"
              />
              <span className={searchMode === 'text' ? 'text-ink' : 'text-ink-muted'}>Text</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="searchMode"
                checked={searchMode === 'semantic'}
                onChange={() => setSearchMode('semantic')}
                className="w-3 h-3 accent-brass"
              />
              <span className={searchMode === 'semantic' ? 'text-ink' : 'text-ink-muted'}>Semantic</span>
            </label>
          </div>
        )}

        {/* Concept filter segment buttons */}
        <div className="flex gap-0.5 p-0.5 bg-canvas-muted rounded">
          {(['all', 'concepts', 'non-concepts'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setConceptFilter(filter)}
              className={clsx(
                'flex-1 px-2 py-1 text-[10px] font-medium rounded transition-colors',
                conceptFilter === filter
                  ? 'bg-surface text-ink shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              )}
            >
              {filter === 'all' ? 'All' : filter === 'concepts' ? 'Concepts' : 'Regular'}
            </button>
          ))}
        </div>
      </div>

      {/* Image Grid */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <p className="text-xs text-ink-muted">No matching images</p>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setConceptFilter('all');
                }}
                className="text-xs text-brass hover:underline mt-1"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
        <div className="grid grid-cols-3 gap-1">
          {filteredImages.map((item, index) => {
            const isSelected = selectedIds.has(item.image.id);
            const isSourceImage = similarToImageId === item.image.id;
            const score = (item as typeof item & { score?: number }).score;
            const isIndexed = indexedImageIds.has(item.image.id);
            return (
              <motion.div
                key={item.image.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(index * 0.01, 0.3) }}
                onClick={() => handleImageClick(item)}
                className={clsx(
                  'relative aspect-square overflow-hidden cursor-pointer group',
                  isSelected && 'ring-2 ring-brass ring-offset-1 ring-offset-surface',
                  isSourceImage && 'ring-2 ring-brass ring-offset-1 ring-offset-surface'
                )}
              >
                <img
                  src={getImageUrl(item.image.image_path)}
                  alt=""
                  className={clsx(
                    'w-full h-full object-cover transition-all',
                    'group-hover:brightness-90',
                    isSelected && 'brightness-90'
                  )}
                />
                {/* Selection checkbox */}
                {isSelectMode && (
                  <div className={clsx(
                    'absolute top-1 left-1 w-5 h-5 flex items-center justify-center transition-all',
                    isSelected
                      ? 'bg-brass text-surface'
                      : 'bg-ink/50 text-surface opacity-0 group-hover:opacity-100'
                  )}>
                    <Check size={12} />
                  </div>
                )}
                {/* Similarity score badge (semantic mode) */}
                {score !== undefined && !isSourceImage && (
                  <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-ink/70 text-surface text-[8px] font-medium rounded">
                    {Math.round(score * 100)}%
                  </div>
                )}
                {/* Source image indicator */}
                {isSourceImage && (
                  <div className="absolute top-1 right-1 px-1 py-0.5 bg-brass text-surface text-[8px] font-medium rounded">
                    Source
                  </div>
                )}
                {/* Unindexed indicator (small dot) */}
                {!isIndexed && !isSelectMode && !score && (
                  <div className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-ink/30" title="Not indexed" />
                )}
                {/* Hover overlay with prompt title */}
                {!isSelectMode && !score && (
                  <div className={clsx(
                    'absolute inset-x-0 bottom-0 p-1 bg-gradient-to-t from-ink/70 to-transparent',
                    'opacity-0 group-hover:opacity-100 transition-opacity'
                  )}>
                    <p className="text-[0.5rem] text-surface truncate">
                      {item.promptTitle}
                    </p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
}
