import { useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wand2,
  X,
  Star,
  FolderOpen,
  Image as ImageIcon,
  Upload,
  FolderUp,
  Loader2,
  Sparkles,
  ChevronDown,
  Zap,
  Settings2,
} from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';
import { Button, Input, Textarea } from '../ui';
import { PromptPreviewModal } from '../modals/PromptPreviewModal';
import { ImagePickerModal } from '../modals/ImagePickerModal';
import type { Template } from '../../types';
import { IMAGE_SIZE_OPTIONS, ASPECT_RATIO_OPTIONS } from '../../types';

type ImagePickerSource = 'favorites' | 'collection';

// Price per image for display
const SIZE_PRICES: Record<string, string> = {
  '1K': '$0.039',
  '2K': '$0.134',
  '4K': '$0.24',
};

export function GenerateTab() {
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [count, setCount] = useState(4);
  const [usePreferences, setUsePreferences] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [imagePickerSource, setImagePickerSource] = useState<ImagePickerSource>('favorites');

  // Advanced options state (per-request overrides)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [imageSize, setImageSize] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<string>('');
  const [seed, setSeed] = useState<string>('');
  const [safetyLevel, setSafetyLevel] = useState<string>('');

  const contextImageIds = useStore((s) => s.contextImageIds);
  const removeContextImage = useStore((s) => s.removeContextImage);
  const clearContextImages = useStore((s) => s.clearContextImages);
  const setContextImages = useStore((s) => s.setContextImages);
  const isGenerating = useStore((s) => s.isGenerating);
  const isGeneratingVariations = useStore((s) => s.isGeneratingVariations);
  const generate = useStore((s) => s.generate);
  const generateVariations = useStore((s) => s.generateVariations);
  const uploadImages = useStore((s) => s.uploadImages);
  const prompts = useStore((s) => s.prompts);
  const selectedIds = useStore((s) => s.selectedIds);
  const favorites = useStore((s) => s.favorites);
  const collections = useStore((s) => s.collections);
  const getCurrentImage = useStore((s) => s.getCurrentImage);
  const designPreferences = useStore((s) => s.designPreferences);
  const fetchDesignPreferences = useStore((s) => s.fetchDesignPreferences);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch preferences on mount
  useEffect(() => {
    fetchDesignPreferences();
  }, [fetchDesignPreferences]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Listen for library insert events
  useEffect(() => {
    const handleLibraryInsert = (e: CustomEvent<{ content: string; type: string }>) => {
      const { content, type } = e.detail;
      if (type === 'template') {
        // Replace prompt entirely for templates
        setPrompt(content);
      } else {
        // Append for fragments and presets
        setPrompt((prev) => {
          if (!prev.trim()) return content;
          // Add separator if needed
          const separator = prev.endsWith(',') || prev.endsWith('.') ? ' ' : ', ';
          return prev + separator + content;
        });
      }
    };

    window.addEventListener('library-insert', handleLibraryInsert as EventListener);
    return () => window.removeEventListener('library-insert', handleLibraryInsert as EventListener);
  }, []);

  // Build preference summary string
  const getPreferenceSummary = () => {
    if (!designPreferences) return '';

    const summaryParts: string[] = [];
    const axes = ['mood', 'typeface', 'colors', 'layout', 'style', 'composition'] as const;

    for (const axis of axes) {
      const prefs = designPreferences[axis] || {};
      const entries = Object.entries(prefs);
      if (entries.length === 0) continue;

      const total = entries.reduce((sum, [, count]) => sum + count, 0);
      const sorted = entries.sort((a, b) => b[1] - a[1]);

      if (sorted.length > 0) {
        const topPercentage = Math.round((sorted[0][1] / total) * 100);
        if (topPercentage >= 40) {
          summaryParts.push(sorted[0][0]);
        }
      }
    }

    return summaryParts.join(', ');
  };

  const preferenceSummary = getPreferenceSummary();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Get context images with their data
  const contextImages = contextImageIds
    .map((id) => {
      for (const p of prompts) {
        const img = p.images.find((i) => i.id === id);
        if (img) return img;
      }
      return null;
    })
    .filter(Boolean);

  // Handle template usage
  useEffect(() => {
    const handler = (e: CustomEvent<Template>) => {
      setPrompt(e.detail.prompt);
      setTitle(e.detail.name);
    };
    document.addEventListener('use-template', handler as EventListener);
    return () => document.removeEventListener('use-template', handler as EventListener);
  }, []);

  // Build final prompt with preferences
  const buildFinalPrompt = () => {
    let finalPrompt = prompt.trim();
    if (usePreferences && preferenceSummary) {
      finalPrompt = `${finalPrompt}\n\nStyle preferences: ${preferenceSummary}`;
    }
    return finalPrompt;
  };

  // Generate variations (two-phase workflow - default)
  const handleGenerateVariations = () => {
    if (!prompt.trim() || !title.trim()) return;

    generateVariations({
      prompt: buildFinalPrompt(),
      title: title.trim(),
      count,
    });

    // Clear form after submitting
    setTitle('');
    setPrompt('');
    setCount(4);
    setShowDropdown(false);
  };

  // Direct generate (bypass variations preview)
  const handleDirectGenerate = () => {
    if (!prompt.trim() || !title.trim()) return;

    generate({
      prompt: buildFinalPrompt(),
      title: title.trim(),
      count,
    });

    // Clear form after submitting
    setTitle('');
    setPrompt('');
    setCount(4);
    setShowDropdown(false);
  };

  const isDisabled = isGenerating || isGeneratingVariations || !prompt.trim() || !title.trim();

  const handleAddFromSelection = () => {
    // Append selected images to existing context (avoid duplicates)
    const newIds = Array.from(selectedIds).filter(id => !contextImageIds.includes(id));
    setContextImages([...contextImageIds, ...newIds]);
  };

  const handleAddCurrentImage = () => {
    const current = getCurrentImage();
    if (current && !contextImageIds.includes(current.id)) {
      setContextImages([...contextImageIds, current.id]);
    }
  };

  const handleOpenImagePicker = (source: ImagePickerSource) => {
    setImagePickerSource(source);
    setShowImagePicker(true);
  };

  const handleImagePickerConfirm = (imageIds: string[]) => {
    // Append selected images to existing context
    setContextImages([...contextImageIds, ...imageIds]);
    setShowImagePicker(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadImages(Array.from(files));
    }
    e.target.value = '';
  };

  return (
    <div className="p-4 space-y-5">
      {/* Title */}
      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="My Generation"
      />

      {/* Count */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-ink-secondary uppercase tracking-wide">
          Number of Images
        </label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              onClick={() => setCount(n)}
              className={clsx(
                'flex-1 py-2 rounded-lg text-sm font-medium',
                'transition-all duration-150',
                count === n
                  ? 'bg-brass text-surface'
                  : 'bg-canvas-muted text-ink-secondary hover:bg-canvas-subtle'
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Style Preferences Toggle */}
      {preferenceSummary && (
        <div className="space-y-2">
          <label
            className={clsx(
              'flex items-center gap-2 p-3 rounded-lg cursor-pointer',
              'border transition-colors',
              usePreferences
                ? 'border-brass bg-brass-muted/30'
                : 'border-border bg-canvas-subtle hover:bg-canvas-muted'
            )}
          >
            <input
              type="checkbox"
              checked={usePreferences}
              onChange={(e) => setUsePreferences(e.target.checked)}
              className="sr-only"
            />
            <div
              className={clsx(
                'w-4 h-4 rounded flex items-center justify-center',
                usePreferences ? 'bg-brass text-surface' : 'bg-canvas-muted'
              )}
            >
              {usePreferences && <Sparkles size={10} />}
            </div>
            <div className="flex-1">
              <div className="text-xs font-medium text-ink">
                Include style preferences
              </div>
              <div className="text-[0.65rem] text-ink-muted">
                {preferenceSummary}
              </div>
            </div>
          </label>
        </div>
      )}

      {/* Context Images */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-ink-secondary uppercase tracking-wide">
            Context Images
          </label>
          {contextImages.length > 0 && (
            <button
              onClick={clearContextImages}
              className="text-xs text-ink-muted hover:text-error transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Context image grid */}
        {contextImages.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {contextImages.map((img) => (
                <motion.div
                  key={img!.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="relative"
                >
                  <img
                    src={getImageUrl(img!.image_path)}
                    alt=""
                    className="w-14 h-14 rounded-lg object-cover"
                  />
                  <button
                    onClick={() => removeContextImage(img!.id)}
                    className={clsx(
                      'absolute -top-1 -right-1 w-5 h-5 rounded-full',
                      'bg-ink text-surface',
                      'flex items-center justify-center',
                      'hover:bg-error transition-colors'
                    )}
                  >
                    <X size={10} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Add context buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<ImageIcon size={14} />}
            onClick={handleAddFromSelection}
            disabled={selectedIds.size === 0}
          >
            From Selection
          </Button>
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Star size={14} />}
            onClick={() => handleOpenImagePicker('favorites')}
            disabled={favorites.length === 0}
          >
            From Favorites
          </Button>
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<FolderOpen size={14} />}
            onClick={() => handleOpenImagePicker('collection')}
            disabled={collections.length === 0}
          >
            From Collection
          </Button>
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<ImageIcon size={14} />}
            onClick={handleAddCurrentImage}
          >
            Current Image
          </Button>
        </div>
      </div>

      {/* Prompt */}
      <Textarea
        label="Prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe the image you want to generate..."
        className="min-h-[150px]"
        data-prompt-input
      />

      {/* Generate Button with Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <div className="flex">
          {/* Main button - Generate Variations */}
          <Button
            variant="brass"
            size="lg"
            leftIcon={
              isGenerating || isGeneratingVariations ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Wand2 size={18} />
              )
            }
            onClick={handleGenerateVariations}
            disabled={isDisabled}
            className="flex-1 rounded-r-none"
          >
            {isGenerating
              ? 'Generating...'
              : isGeneratingVariations
              ? 'Getting Variations...'
              : 'Generate Variations'}
          </Button>

          {/* Dropdown toggle */}
          <Button
            variant="brass"
            size="lg"
            onClick={() => setShowDropdown(!showDropdown)}
            disabled={isDisabled}
            className="px-2 rounded-l-none border-l border-brass-muted"
          >
            <ChevronDown size={16} />
          </Button>
        </div>

        {/* Dropdown menu */}
        <AnimatePresence>
          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className={clsx(
                'absolute bottom-full left-0 right-0 mb-1',
                'bg-surface rounded-lg shadow-lg border border-border',
                'overflow-hidden z-10'
              )}
            >
              <button
                onClick={handleGenerateVariations}
                disabled={isDisabled}
                className={clsx(
                  'w-full px-4 py-3 text-left flex items-center gap-3',
                  'hover:bg-canvas-muted transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <Wand2 size={16} className="text-brass" />
                <div>
                  <div className="text-sm font-medium text-ink">Generate Variations</div>
                  <div className="text-xs text-ink-muted">
                    Preview and edit prompts before generating images
                  </div>
                </div>
              </button>
              <div className="border-t border-border" />
              <button
                onClick={handleDirectGenerate}
                disabled={isDisabled}
                className={clsx(
                  'w-full px-4 py-3 text-left flex items-center gap-3',
                  'hover:bg-canvas-muted transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <Zap size={16} className="text-ink-secondary" />
                <div>
                  <div className="text-sm font-medium text-ink">Direct Generate</div>
                  <div className="text-xs text-ink-muted">
                    Skip preview, generate images immediately
                  </div>
                </div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Prompt Preview Modal */}
      <PromptPreviewModal />

      {/* Image Picker Modal */}
      <ImagePickerModal
        isOpen={showImagePicker}
        source={imagePickerSource}
        onClose={() => setShowImagePicker(false)}
        onConfirm={handleImagePickerConfirm}
      />

      {/* Upload Section */}
      <div className="pt-4 border-t border-border space-y-2">
        <label className="block text-xs font-medium text-ink-secondary uppercase tracking-wide">
          Upload Images
        </label>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Upload size={14} />}
            onClick={() => fileInputRef.current?.click()}
            className="flex-1"
            disabled={isGenerating}
          >
            Files
          </Button>
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<FolderUp size={14} />}
            onClick={() => folderInputRef.current?.click()}
            className="flex-1"
            disabled={isGenerating}
          >
            Folder
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileUpload}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          accept="image/*"
          multiple
          {...({ webkitdirectory: 'true' } as any)}
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>
    </div>
  );
}
