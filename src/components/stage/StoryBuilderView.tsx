import { useState, useMemo, useCallback } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Plus,
  Trash2,
  Edit3,
  Image as ImageIcon,
  Sparkles,
  Loader2,
  Wand2,
  X,
  Palette,
  ChevronDown,
  ChevronRight,
  Heart,
  Download,
  Lightbulb,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl, storySuggestChapters, storyRewriteNarrative } from '../../api';
import type { ChapterSuggestion } from '../../api';
import { Button, IconButton, Dialog } from '../ui';
import { buildStoryChapterContext, aggregateStoryDesignInfo } from '../../prompts';
import type { Story, Chapter, ImageData } from '../../types';

interface StoryBuilderViewProps {
  story: Story;
}

export function StoryBuilderView({ story }: StoryBuilderViewProps) {
  const getAllGenerations = useStore((s) => s.getAllGenerations);
  const allPrompts = getAllGenerations();
  const addChapter = useStore((s) => s.addChapter);
  const updateChapter = useStore((s) => s.updateChapter);
  const deleteChapter = useStore((s) => s.deleteChapter);
  const currentChapterId = useStore((s) => s.currentChapterId);
  const setCurrentChapter = useStore((s) => s.setCurrentChapter);
  const setCurrentStory = useStore((s) => s.setCurrentStory);

  // For "Generate for Chapter" functionality
  const characters = useStore((s) => s.characters);
  const clearContextImages = useStore((s) => s.clearContextImages);
  const setContextImages = useStore((s) => s.setContextImages);
  const setContextAnnotationOverride = useStore((s) => s.setContextAnnotationOverride);
  const setRightTab = useStore((s) => s.setRightTab);

  // For auto-chain generation
  const generateStoryChapters = useStore((s) => s.generateStoryChapters);
  const cancelStoryGeneration = useStore((s) => s.cancelStoryGeneration);
  const isGeneratingStory = useStore((s) => s.isGeneratingStory);
  const generatingStoryProgress = useStore((s) => s.generatingStoryProgress);

  const [isAddingChapter, setIsAddingChapter] = useState(false);
  const [isAutoChainDialogOpen, setIsAutoChainDialogOpen] = useState(false);
  const [autoChainPrompt, setAutoChainPrompt] = useState('');
  const [autoChainImagesPerChapter, setAutoChainImagesPerChapter] = useState(1);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newChapterText, setNewChapterText] = useState('');
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editText, setEditText] = useState('');
  const [deleteChapterId, setDeleteChapterId] = useState<string | null>(null);
  const [isDesignMomentumOpen, setIsDesignMomentumOpen] = useState(false);
  const [stylePrompt, setStylePrompt] = useState(story.design_momentum?.style_prompt || '');
  const updateStory = useStore((s) => s.updateStory);

  // AI chapter suggestion state
  const [isSuggestDialogOpen, setIsSuggestDialogOpen] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [chapterSuggestions, setChapterSuggestions] = useState<ChapterSuggestion[]>([]);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  // Narrative rewrite state
  const [isRewritingNarrative, setIsRewritingNarrative] = useState(false);

  // Helper to get image data by ID
  const getImageById = (imageId: string) => {
    for (const p of allPrompts) {
      const img = p.images.find((i) => i.id === imageId);
      if (img) return img;
    }
    return null;
  };

  // Get current chapter
  const currentChapter = useMemo(() => {
    return story.chapters.find((ch) => ch.id === currentChapterId) || null;
  }, [story.chapters, currentChapterId]);

  // Get images for current chapter
  const currentChapterImages = useMemo(() => {
    if (!currentChapter) return [];
    return currentChapter.image_ids
      .map((id) => getImageById(id))
      .filter(Boolean);
  }, [currentChapter, allPrompts]);

  // Aggregate design info from all chapter images
  const designInfo = useMemo(() => {
    return aggregateStoryDesignInfo({
      story,
      getImageData: getImageById as (id: string) => ImageData | null,
    });
  }, [story, allPrompts]);

  // Handler to save style prompt
  const handleSaveStylePrompt = useCallback(async () => {
    await updateStory(story.id, {
      design_momentum: {
        ...story.design_momentum,
        style_prompt: stylePrompt.trim() || undefined,
      },
    });
  }, [story.id, story.design_momentum, stylePrompt, updateStory]);

  // Get all story images for export
  const allStoryImages = useMemo(() => {
    const images: { chapterIndex: number; chapterTitle: string; imageId: string; imagePath: string }[] = [];
    for (let i = 0; i < story.chapters.length; i++) {
      const chapter = story.chapters[i];
      for (const imageId of chapter.image_ids) {
        const img = getImageById(imageId);
        if (img) {
          images.push({
            chapterIndex: i + 1,
            chapterTitle: chapter.title || `Chapter ${i + 1}`,
            imageId,
            imagePath: img.image_path,
          });
        }
      }
    }
    return images;
  }, [story, allPrompts]);

  // State for export
  const [isExporting, setIsExporting] = useState(false);

  // Handler to export all images
  const handleExportImages = useCallback(async () => {
    if (allStoryImages.length === 0) return;

    setIsExporting(true);
    try {
      // For simplicity, download each image sequentially
      // In a production app, you might want to use JSZip to create a ZIP file
      for (const img of allStoryImages) {
        const response = await fetch(getImageUrl(img.imagePath));
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Name format: StoryTitle_Ch01_ImageTitle.jpg
        const safeName = story.title.replace(/[^a-zA-Z0-9]/g, '_');
        const ext = img.imagePath.split('.').pop() || 'jpg';
        a.download = `${safeName}_Ch${String(img.chapterIndex).padStart(2, '0')}_${img.imageId.slice(-8)}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Small delay to prevent browser from blocking downloads
        await new Promise((r) => setTimeout(r, 200));
      }
    } finally {
      setIsExporting(false);
    }
  }, [story.title, allStoryImages]);

  const handleAddChapter = async () => {
    if (!newChapterTitle.trim()) return;
    await addChapter(story.id, {
      title: newChapterTitle.trim(),
      text: newChapterText.trim(),
      image_ids: [],
      layout: 'text_below',
    });
    setNewChapterTitle('');
    setNewChapterText('');
    setIsAddingChapter(false);
  };

  const handleStartEdit = (chapter: Chapter) => {
    setEditingChapterId(chapter.id);
    setEditTitle(chapter.title);
    setEditText(chapter.text);
  };

  const handleSaveEdit = async () => {
    if (!editingChapterId) return;
    await updateChapter(story.id, editingChapterId, {
      title: editTitle.trim(),
      text: editText.trim(),
    });
    setEditingChapterId(null);
    setEditTitle('');
    setEditText('');
  };

  const handleDeleteChapter = async () => {
    if (!deleteChapterId) return;
    await deleteChapter(story.id, deleteChapterId);
    setDeleteChapterId(null);
    if (currentChapterId === deleteChapterId) {
      setCurrentChapter(null);
    }
  };

  // Handle auto-chain generation for all chapters
  const handleStartAutoChain = useCallback(async () => {
    setIsAutoChainDialogOpen(false);
    await generateStoryChapters({
      storyId: story.id,
      basePrompt: autoChainPrompt.trim() || undefined,
      imagesPerChapter: autoChainImagesPerChapter,
    });
  }, [story.id, autoChainPrompt, autoChainImagesPerChapter, generateStoryChapters]);

  // Handle "Generate for Chapter" - sets up context and navigates to Generate tab
  const handleGenerateForChapter = useCallback(() => {
    if (!currentChapter) return;

    const chapterIndex = story.chapters.findIndex((ch) => ch.id === currentChapter.id);
    if (chapterIndex === -1) return;

    // Build story context with semantic labels
    const storyContextResult = buildStoryChapterContext({
      story,
      chapterIndex,
      characters,
      getImageData: getImageById,
    });

    // Show warning if context was truncated
    if (storyContextResult.truncated) {
      const { breakdown } = storyContextResult;
      console.warn(
        `Context truncated: ${storyContextResult.originalCount} → ${storyContextResult.images.length} images. ` +
        `Characters: ${breakdown.characters.included}/${breakdown.characters.total}, ` +
        `Previous: ${breakdown.previous.included}/${breakdown.previous.total}, ` +
        `Next: ${breakdown.next.included}/${breakdown.next.total}`
      );
      // Alert user about truncation
      alert(
        `Note: Context has been limited to 14 images (was ${storyContextResult.originalCount}).\n\n` +
        `Included:\n` +
        `• ${breakdown.characters.included}/${breakdown.characters.total} character reference images\n` +
        `• ${breakdown.previous.included}/${breakdown.previous.total} previous chapter images\n` +
        `• ${breakdown.next.included}/${breakdown.next.total} next chapter images\n\n` +
        `Priority: Characters > Previous Chapter > Next Chapter`
      );
    }

    // Clear existing context and set new context with overrides
    clearContextImages();

    // Set context images and their annotation overrides
    const contextIds: string[] = [];
    for (const { imageId, annotation } of storyContextResult.images) {
      contextIds.push(imageId);
      setContextAnnotationOverride(imageId, annotation);
    }
    setContextImages(contextIds);

    // Navigate to Generate tab
    setRightTab('generate');
  }, [
    currentChapter,
    story,
    characters,
    getImageById,
    clearContextImages,
    setContextImages,
    setContextAnnotationOverride,
    setRightTab,
  ]);

  // Handle AI chapter suggestions
  const handleSuggestChapters = useCallback(async () => {
    setIsLoadingSuggestions(true);
    setSuggestionError(null);
    setChapterSuggestions([]);

    try {
      // Get character names for the story
      const storyCharacterIds = story.character_ids || [];
      const characterNames = characters
        .filter((c) => storyCharacterIds.includes(c.id))
        .map((c) => c.name);

      const response = await storySuggestChapters({
        story_title: story.title,
        story_description: story.description,
        existing_chapters: story.chapters.map((ch) => ({
          title: ch.title,
          text: ch.text,
        })),
        character_names: characterNames,
        num_suggestions: 3,
      });

      if (response.success) {
        setChapterSuggestions(response.suggestions);
        setIsSuggestDialogOpen(true);
      } else {
        setSuggestionError(response.error || 'Failed to generate suggestions');
      }
    } catch (error) {
      setSuggestionError((error as Error).message);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [story, characters]);

  // Handle using a suggestion to create a new chapter
  const handleUseSuggestion = useCallback(async (suggestion: ChapterSuggestion) => {
    await addChapter(story.id, {
      title: suggestion.title,
      text: suggestion.narrative,
      image_ids: [],
      layout: 'text_below',
    });
    setIsSuggestDialogOpen(false);
    setChapterSuggestions([]);
  }, [story.id, addChapter]);

  // Handle AI narrative rewrite
  const handleRewriteNarrative = useCallback(async () => {
    if (!editText.trim()) return;

    setIsRewritingNarrative(true);
    try {
      const response = await storyRewriteNarrative({
        narrative: editText,
        chapter_title: editTitle || undefined,
        story_context: story.description || story.title,
      });

      if (response.success && response.narrative) {
        setEditText(response.narrative);
      }
    } catch (error) {
      console.error('Narrative rewrite failed:', error);
    } finally {
      setIsRewritingNarrative(false);
    }
  }, [editText, editTitle, story.description, story.title]);

  return (
    <div className="flex flex-col h-full bg-canvas">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
        <div className="flex items-center gap-3 min-w-0">
          <IconButton
            size="sm"
            variant="ghost"
            tooltip="Exit story"
            onClick={() => setCurrentStory(null)}
          >
            <ArrowLeft size={16} />
          </IconButton>
          <BookOpen size={18} className="text-brass flex-shrink-0" />
          <div className="min-w-0">
            <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-ink truncate">
              {story.title}
            </h2>
            {story.description && (
              <p className="text-xs text-ink-tertiary truncate">{story.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-muted">
            {story.chapters.length} chapter{story.chapters.length !== 1 ? 's' : ''}
          </span>

          {/* Export button */}
          <Button
            size="sm"
            variant="secondary"
            leftIcon={isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            onClick={handleExportImages}
            disabled={isExporting || allStoryImages.length === 0}
          >
            {isExporting ? 'Exporting...' : `Export (${allStoryImages.length})`}
          </Button>

          {/* Generation progress or button */}
          {isGeneratingStory ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-generating/10 rounded-lg">
              <Loader2 size={14} className="text-generating animate-spin" />
              <span className="text-xs text-generating font-medium">
                Generating {generatingStoryProgress?.current}/{generatingStoryProgress?.total}...
              </span>
              <button
                onClick={cancelStoryGeneration}
                className="p-0.5 rounded hover:bg-generating/20 text-generating"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="brass"
              leftIcon={<Wand2 size={14} />}
              onClick={() => setIsAutoChainDialogOpen(true)}
              disabled={story.chapters.length === 0}
            >
              Generate All
            </Button>
          )}
        </div>
      </header>

      {/* Design Momentum Section - Collapsible */}
      {designInfo.imagesWithDesign > 0 && (
        <div className="border-b border-border bg-canvas-subtle">
          <button
            onClick={() => setIsDesignMomentumOpen(!isDesignMomentumOpen)}
            className="w-full px-4 py-2 flex items-center gap-2 text-left hover:bg-canvas-muted/50 transition-colors"
          >
            {isDesignMomentumOpen ? (
              <ChevronDown size={14} className="text-ink-muted" />
            ) : (
              <ChevronRight size={14} className="text-ink-muted" />
            )}
            <Palette size={14} className="text-brass" />
            <span className="text-sm font-medium text-ink">Design Momentum</span>
            <span className="text-xs text-ink-muted ml-2">
              {designInfo.imagesWithDesign} images with design data
            </span>
          </button>

          {isDesignMomentumOpen && (
            <div className="px-4 pb-4 space-y-4">
              {/* Style Prompt */}
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Global Style Prompt
                </label>
                <div className="flex gap-2">
                  <textarea
                    value={stylePrompt}
                    onChange={(e) => setStylePrompt(e.target.value)}
                    placeholder="e.g., watercolor style, warm lighting, vintage film aesthetic..."
                    rows={2}
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-surface text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brass/50 resize-none"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleSaveStylePrompt}
                    disabled={stylePrompt === (story.design_momentum?.style_prompt || '')}
                  >
                    Save
                  </Button>
                </div>
                <p className="text-xs text-ink-muted mt-1">
                  Applied to all chapter generations for visual consistency
                </p>
              </div>

              {/* Aggregated Liked Design Elements */}
              {Object.keys(designInfo.likedTagCounts).length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-ink-secondary mb-2 flex items-center gap-1">
                    <Heart size={12} className="text-brass" />
                    Liked Design Tags
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(designInfo.likedTagCounts).map(([axis, tagCounts]) => (
                      <div key={axis} className="flex items-center gap-1">
                        <span className="text-xs text-ink-muted">{axis}:</span>
                        {Object.entries(tagCounts)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 3)
                          .map(([tag, count]) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 text-xs rounded-full bg-brass/10 text-brass-dark border border-brass/20"
                            >
                              {tag} ({count})
                            </span>
                          ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Aggregated Liked Dimensions */}
              {Object.keys(designInfo.likedDimensionCounts).length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-ink-secondary mb-2 flex items-center gap-1">
                    <Sparkles size={12} className="text-brass" />
                    Liked Design Dimensions
                  </h4>
                  <div className="space-y-1">
                    {Object.entries(designInfo.likedDimensionCounts)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 3)
                      .map(([axis, count]) => {
                        const dimension = designInfo.topDimensions[axis];
                        return (
                          <div key={axis} className="flex items-start gap-2 text-sm">
                            <span className="text-xs text-ink-muted w-20 shrink-0">{axis}:</span>
                            <div>
                              <span className="text-ink font-medium">
                                {dimension?.name || axis}
                              </span>
                              <span className="text-xs text-ink-muted ml-1">({count}×)</span>
                              {dimension?.description && (
                                <p className="text-xs text-ink-muted mt-0.5 line-clamp-1">
                                  {dimension.description}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {Object.keys(designInfo.likedTagCounts).length === 0 &&
                Object.keys(designInfo.likedDimensionCounts).length === 0 && (
                  <p className="text-xs text-ink-muted italic">
                    Like design elements on chapter images to build visual momentum.
                    Liked elements will be used as context for future generations.
                  </p>
                )}
            </div>
          )}
        </div>
      )}

      {/* Main content - split view */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chapters timeline (left side) */}
        <div className="w-64 border-r border-border bg-surface overflow-y-auto">
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-ink-secondary uppercase tracking-wide">
                Chapters
              </h3>
              <div className="flex gap-1">
                <IconButton
                  size="sm"
                  variant="ghost"
                  tooltip="AI Suggest chapter"
                  onClick={handleSuggestChapters}
                  disabled={isLoadingSuggestions}
                >
                  {isLoadingSuggestions ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Lightbulb size={14} />
                  )}
                </IconButton>
                <IconButton
                  size="sm"
                  variant="ghost"
                  tooltip="Add chapter"
                  onClick={() => setIsAddingChapter(true)}
                >
                  <Plus size={14} />
                </IconButton>
              </div>
            </div>

            {story.chapters.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-ink-muted">No chapters yet</p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  onClick={() => setIsAddingChapter(true)}
                >
                  Add First Chapter
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {story.chapters.map((chapter, index) => {
                  const isActive = chapter.id === currentChapterId;
                  const thumbnails = chapter.image_ids
                    .slice(0, 2)
                    .map((id) => getImageById(id))
                    .filter(Boolean);

                  return (
                    <motion.div
                      key={chapter.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className={clsx(
                        'rounded-lg p-2 cursor-pointer transition-colors',
                        isActive
                          ? 'bg-brass-muted border border-brass/30'
                          : 'hover:bg-canvas-subtle'
                      )}
                      onClick={() => setCurrentChapter(chapter.id)}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-ink-muted w-4 flex-shrink-0">
                          {index + 1}.
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink truncate">
                            {chapter.title || 'Untitled'}
                          </p>
                          {chapter.text && (
                            <p className="text-xs text-ink-muted truncate mt-0.5">
                              {chapter.text}
                            </p>
                          )}
                          {/* Thumbnail strip */}
                          {thumbnails.length > 0 && (
                            <div className="flex gap-1 mt-2">
                              {thumbnails.map((img, i) => (
                                <div
                                  key={i}
                                  className="w-8 h-8 rounded overflow-hidden bg-canvas-muted"
                                >
                                  {img && (
                                    <img
                                      src={getImageUrl(img.image_path)}
                                      alt=""
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                </div>
                              ))}
                              {chapter.image_ids.length > 2 && (
                                <div className="w-8 h-8 rounded bg-canvas-muted flex items-center justify-center">
                                  <span className="text-[10px] text-ink-muted">
                                    +{chapter.image_ids.length - 2}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Chapter detail (right side) */}
        <div className="flex-1 overflow-y-auto">
          {currentChapter ? (
            <div className="p-6">
              {editingChapterId === currentChapter.id ? (
                // Edit mode
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-ink-secondary mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brass/50"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-ink-secondary">
                        Narrative Text
                      </label>
                      <Button
                        size="sm"
                        variant="ghost"
                        leftIcon={
                          isRewritingNarrative ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <RefreshCw size={12} />
                          )
                        }
                        onClick={handleRewriteNarrative}
                        disabled={isRewritingNarrative || !editText.trim()}
                      >
                        {isRewritingNarrative ? 'Improving...' : 'AI Improve'}
                      </Button>
                    </div>
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={6}
                      placeholder="Enter the narrative for this chapter..."
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brass/50 resize-none"
                    />
                    <p className="text-xs text-ink-muted mt-1">
                      AI Improve rewrites for visual storytelling with richer scene details
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="brass" size="sm" onClick={handleSaveEdit}>
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingChapterId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                // View mode
                <div className="space-y-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-ink">
                        {currentChapter.title || 'Untitled Chapter'}
                      </h3>
                      <p className="text-xs text-ink-muted mt-1">
                        Chapter {story.chapters.findIndex((ch) => ch.id === currentChapter.id) + 1}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <IconButton
                        size="sm"
                        variant="ghost"
                        tooltip="Edit chapter"
                        onClick={() => handleStartEdit(currentChapter)}
                      >
                        <Edit3 size={14} />
                      </IconButton>
                      <IconButton
                        size="sm"
                        variant="danger"
                        tooltip="Delete chapter"
                        onClick={() => setDeleteChapterId(currentChapter.id)}
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
                  </div>

                  {currentChapter.text && (
                    <div className="prose prose-sm max-w-none">
                      <p className="text-ink-secondary whitespace-pre-line">
                        {currentChapter.text}
                      </p>
                    </div>
                  )}

                  {/* Chapter images */}
                  <div>
                    <h4 className="text-sm font-medium text-ink-secondary mb-3 flex items-center gap-2">
                      <ImageIcon size={14} />
                      Images ({currentChapter.image_ids.length})
                    </h4>
                    {currentChapterImages.length > 0 ? (
                      <div className="grid grid-cols-3 gap-3">
                        {currentChapterImages.map((img) => (
                          <div
                            key={img!.id}
                            className="aspect-square rounded-lg overflow-hidden bg-canvas-muted"
                          >
                            <img
                              src={getImageUrl(img!.image_path)}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 rounded-lg bg-canvas-subtle border border-dashed border-border">
                        <ImageIcon size={24} className="mx-auto text-ink-muted mb-2" />
                        <p className="text-sm text-ink-muted">No images yet</p>
                        <p className="text-xs text-ink-tertiary mt-1">
                          Generate or assign images to this chapter
                        </p>
                      </div>
                    )}

                    {/* Generate for Chapter button */}
                    <div className="mt-4 pt-4 border-t border-border">
                      <Button
                        variant="brass"
                        size="sm"
                        leftIcon={<Sparkles size={14} />}
                        onClick={handleGenerateForChapter}
                      >
                        Generate for Chapter
                      </Button>
                      <p className="text-xs text-ink-muted mt-2">
                        Sets up context with character references and previous chapter images
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-center p-6">
              <div>
                <BookOpen size={32} className="mx-auto text-ink-muted mb-3" />
                <p className="text-sm text-ink-secondary">Select a chapter to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Chapter Dialog */}
      <Dialog
        isOpen={isAddingChapter}
        onClose={() => setIsAddingChapter(false)}
        title="Add Chapter"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-secondary mb-1">
              Title
            </label>
            <input
              type="text"
              value={newChapterTitle}
              onChange={(e) => setNewChapterTitle(e.target.value)}
              placeholder="Chapter title..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brass/50"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-secondary mb-1">
              Narrative Text
            </label>
            <textarea
              value={newChapterText}
              onChange={(e) => setNewChapterText(e.target.value)}
              placeholder="Enter the narrative text for this chapter..."
              rows={4}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brass/50 resize-none"
            />
            <p className="text-xs text-ink-muted mt-1">
              Used as context for AI image generation
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setIsAddingChapter(false)}>
            Cancel
          </Button>
          <Button
            variant="brass"
            onClick={handleAddChapter}
            disabled={!newChapterTitle.trim()}
          >
            Add Chapter
          </Button>
        </div>
      </Dialog>

      {/* Delete Chapter Confirmation */}
      <Dialog
        isOpen={!!deleteChapterId}
        onClose={() => setDeleteChapterId(null)}
        title="Delete Chapter"
      >
        <p className="text-sm text-ink-secondary mb-6">
          Are you sure you want to delete this chapter? The images will not be deleted.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDeleteChapterId(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeleteChapter}>
            Delete
          </Button>
        </div>
      </Dialog>

      {/* Auto-Chain Generation Dialog */}
      <Dialog
        isOpen={isAutoChainDialogOpen}
        onClose={() => setIsAutoChainDialogOpen(false)}
        title="Generate All Chapters"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-secondary">
            Generate images for all {story.chapters.length} chapters sequentially.
            Each chapter will use previous chapter images as context for consistency.
          </p>

          <div>
            <label className="block text-sm font-medium text-ink-secondary mb-1">
              Base Prompt (optional)
            </label>
            <textarea
              value={autoChainPrompt}
              onChange={(e) => setAutoChainPrompt(e.target.value)}
              placeholder="Optional styling instructions that apply to all chapters..."
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brass/50 resize-none"
            />
            <p className="text-xs text-ink-muted mt-1">
              This prompt will be combined with each chapter's narrative text
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-secondary mb-1">
              Images per Chapter
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoChainImagesPerChapter(Math.max(1, autoChainImagesPerChapter - 1))}
                className="w-8 h-8 flex items-center justify-center rounded border border-border bg-surface hover:bg-canvas-subtle"
              >
                -
              </button>
              <span className="w-8 text-center text-sm font-medium">{autoChainImagesPerChapter}</span>
              <button
                onClick={() => setAutoChainImagesPerChapter(Math.min(4, autoChainImagesPerChapter + 1))}
                className="w-8 h-8 flex items-center justify-center rounded border border-border bg-surface hover:bg-canvas-subtle"
              >
                +
              </button>
            </div>
          </div>

          {(story.character_ids?.length || 0) > 0 && (
            <div className="p-3 rounded-lg bg-brass-muted/50 border border-brass/20">
              <p className="text-xs text-ink-secondary">
                <strong>{story.character_ids?.length} character(s)</strong> will be included as context
                for consistency
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setIsAutoChainDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="brass"
            leftIcon={<Wand2 size={14} />}
            onClick={handleStartAutoChain}
          >
            Generate {story.chapters.length} Chapters
          </Button>
        </div>
      </Dialog>

      {/* AI Chapter Suggestions Dialog */}
      <Dialog
        isOpen={isSuggestDialogOpen}
        onClose={() => {
          setIsSuggestDialogOpen(false);
          setChapterSuggestions([]);
        }}
        title="AI Chapter Suggestions"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-secondary">
            Based on your story "{story.title}" and existing chapters, here are suggestions for your next chapter:
          </p>

          {suggestionError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {suggestionError}
            </div>
          )}

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {chapterSuggestions.map((suggestion, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-4 rounded-lg border border-border hover:border-brass/50 hover:bg-brass-muted/20 transition-colors cursor-pointer group"
                onClick={() => handleUseSuggestion(suggestion)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-ink group-hover:text-brass-dark transition-colors">
                      {suggestion.title}
                    </h4>
                    <p className="text-sm text-ink-secondary mt-1">
                      {suggestion.narrative}
                    </p>
                    <p className="text-xs text-ink-muted mt-2 italic">
                      {suggestion.rationale}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="brass"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUseSuggestion(suggestion);
                    }}
                  >
                    Use
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>

          <p className="text-xs text-ink-muted">
            Click a suggestion to add it as a new chapter. You can edit it afterward.
          </p>
        </div>

        <div className="flex justify-between items-center gap-3 mt-6">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={isLoadingSuggestions ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            onClick={handleSuggestChapters}
            disabled={isLoadingSuggestions}
          >
            Regenerate
          </Button>
          <Button variant="ghost" onClick={() => {
            setIsSuggestDialogOpen(false);
            setChapterSuggestions([]);
          }}>
            Close
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
