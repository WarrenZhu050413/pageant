import { useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wand2,
  X,
  FolderOpen,
  Image as ImageIcon,
  Upload,
  FolderUp,
  Sparkles,
  ChevronDown,
  Zap,
  Settings2,
  Pencil,
} from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';
import { Button, Input, Textarea } from '../ui';
import { PromptPreviewModal } from '../modals/PromptPreviewModal';
import { ImagePickerModal } from '../modals/ImagePickerModal';
import { ContextAnnotationModal } from '../modals/ContextAnnotationModal';
import type { ImageSize, AspectRatio, SafetyLevel } from '../../types';
import { IMAGE_SIZE_OPTIONS, ASPECT_RATIO_OPTIONS } from '../../types';

// Price per image for display
const SIZE_PRICES: Record<string, string> = {
  '1K': '$0.039',
  '2K': '$0.134',
  '4K': '$0.24',
};

// LocalStorage key for persisting image count preference
const IMAGE_COUNT_KEY = 'pageant:defaultImageCount';

export function GenerateTab() {
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [count, setCount] = useState(() => {
    // Load saved count from localStorage, default to 4
    const saved = localStorage.getItem(IMAGE_COUNT_KEY);
    return saved ? parseInt(saved, 10) : 4;
  });
  const [showDropdown, setShowDropdown] = useState(false);
  const [customCountInput, setCustomCountInput] = useState<string | null>(null); // For editing 5+ input
  const [selectedConceptIds, setSelectedConceptIds] = useState<string[]>([]);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [editingContextImageId, setEditingContextImageId] = useState<string | null>(null);

  // Advanced options state (per-request overrides)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [imageSize, setImageSize] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<string>('');
  const [seed, setSeed] = useState<string>('');
  const [safetyLevel, setSafetyLevel] = useState<string>('');

  const contextImageIds = useStore((s) => s.contextImageIds);
  const contextAnnotationOverrides = useStore((s) => s.contextAnnotationOverrides);
  const removeContextImage = useStore((s) => s.removeContextImage);
  const clearContextImages = useStore((s) => s.clearContextImages);
  const setContextImages = useStore((s) => s.setContextImages);
  const isGenerating = useStore((s) => s.isGenerating);
  const generate = useStore((s) => s.generate);
  const generateVariations = useStore((s) => s.generateVariations);
  const uploadImages = useStore((s) => s.uploadImages);
  const prompts = useStore((s) => s.prompts);
  const selectedIds = useStore((s) => s.selectedIds);
  const collections = useStore((s) => s.collections);
  const getCurrentImage = useStore((s) => s.getCurrentImage);
  const designTokens = useStore((s) => s.designTokens);
  const settings = useStore((s) => s.settings);

  // Get design tokens from library
  const concepts = designTokens;

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize Advanced Options from saved settings
  useEffect(() => {
    if (settings?.image_size) setImageSize(settings.image_size);
  }, [settings?.image_size]);

  useEffect(() => {
    if (settings?.aspect_ratio) setAspectRatio(settings.aspect_ratio);
  }, [settings?.aspect_ratio]);

  useEffect(() => {
    if (settings?.seed != null) setSeed(settings.seed.toString());
  }, [settings?.seed]);

  useEffect(() => {
    if (settings?.safety_level) setSafetyLevel(settings.safety_level);
  }, [settings?.safety_level]);

  // Helper to update count and persist to localStorage
  const updateCount = (newCount: number) => {
    setCount(newCount);
    localStorage.setItem(IMAGE_COUNT_KEY, newCount.toString());
  };

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

  // Toggle concept selection
  const toggleConcept = (id: string) => {
    setSelectedConceptIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Get prompts/tags from selected design tokens
  const getSelectedConceptTags = () => {
    const selected = concepts.filter((c) => selectedConceptIds.includes(c.id));
    const allTags: string[] = [];
    selected.forEach((token) => {
      if (token.tags) allTags.push(...token.tags);
      if (token.prompts) allTags.push(...token.prompts);
    });
    return [...new Set(allTags)];
  };

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

  // Build final prompt with selected concepts
  const buildFinalPrompt = () => {
    let finalPrompt = prompt.trim();
    const conceptTags = getSelectedConceptTags();
    if (conceptTags.length > 0) {
      finalPrompt = `${finalPrompt}\n\nDesign concepts: ${conceptTags.join(', ')}`;
    }
    return finalPrompt;
  };

  // Build image generation params from advanced options
  const buildImageParams = () => ({
    image_size: (imageSize || undefined) as ImageSize | undefined,
    aspect_ratio: (aspectRatio || undefined) as AspectRatio | undefined,
    seed: seed ? parseInt(seed, 10) : undefined,
    safety_level: (safetyLevel || undefined) as SafetyLevel | undefined,
  });

  // Generate variations (two-phase workflow - default)
  const handleGenerateVariations = () => {
    if (!prompt.trim()) return;

    generateVariations({
      prompt: buildFinalPrompt(),
      title: title.trim() || undefined, // Optional - will be auto-generated if not provided
      count,
      ...buildImageParams(),
    });

    // Clear form after submitting, reset advanced options to settings defaults
    // Note: count is preserved as user's preference (stored in localStorage)
    setTitle('');
    setPrompt('');
    setShowDropdown(false);
    setSelectedConceptIds([]);
    // Reset advanced options to settings values (not empty)
    setImageSize(settings?.image_size || '');
    setAspectRatio(settings?.aspect_ratio || '');
    setSeed(settings?.seed != null ? settings.seed.toString() : '');
    setSafetyLevel(settings?.safety_level || '');
    setShowAdvanced(false);
  };

  // Direct generate (bypass variations preview)
  const handleDirectGenerate = () => {
    if (!prompt.trim()) return;

    generate({
      prompt: buildFinalPrompt(),
      title: title.trim() || undefined, // Optional - will be auto-generated
      count,
      ...buildImageParams(),
    });

    // Clear form after submitting, reset advanced options to settings defaults
    // Note: count is preserved as user's preference (stored in localStorage)
    setTitle('');
    setPrompt('');
    setShowDropdown(false);
    setSelectedConceptIds([]);
    // Reset advanced options to settings values (not empty)
    setImageSize(settings?.image_size || '');
    setAspectRatio(settings?.aspect_ratio || '');
    setSeed(settings?.seed != null ? settings.seed.toString() : '');
    setSafetyLevel(settings?.safety_level || '');
    setShowAdvanced(false);
  };

  // Only prompt is required - title is auto-generated if not provided
  // Allow concurrent prompt generations - only check if prompt is empty
  const isDisabled = !prompt.trim();

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

  const handleOpenImagePicker = () => {
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
      {/* Title (optional) */}
      <Input
        label="Title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Auto-generate from prompt"
      />

      {/* Count */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-ink-secondary uppercase tracking-wide">
          Number of Images
        </label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => updateCount(n)}
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
          {/* 5+ custom input - always show label with expandable input */}
          <div
            className={clsx(
              'flex-1 flex items-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium',
              'transition-all duration-150',
              count > 5
                ? 'bg-brass text-surface'
                : 'bg-canvas-muted text-ink-secondary hover:bg-canvas-subtle cursor-pointer'
            )}
            onClick={() => {
              if (count <= 5) updateCount(6);
            }}
          >
            <span className="shrink-0">5+</span>
            {count > 5 && (
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={customCountInput !== null ? customCountInput : count}
                onChange={(e) => {
                  const raw = e.target.value;
                  setCustomCountInput(raw); // Allow any value while typing (including empty)
                  const val = parseInt(raw, 10);
                  if (!isNaN(val) && val >= 1) updateCount(val);
                }}
                onFocus={() => setCustomCountInput(count.toString())}
                onBlur={(e) => {
                  // On blur, if empty or invalid, reset to 6
                  const val = parseInt(e.target.value, 10);
                  if (isNaN(val) || val < 1) updateCount(6);
                  setCustomCountInput(null); // Clear local state, use count directly
                }}
                onClick={(e) => e.stopPropagation()}
                className={clsx(
                  'w-12 bg-transparent text-center font-medium',
                  'border-none outline-none'
                )}
                autoFocus
              />
            )}
          </div>
        </div>
      </div>

      {/* Design Concepts Picker */}
      {concepts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-ink-secondary uppercase tracking-wide">
              Design Concepts
            </label>
            {selectedConceptIds.length > 0 && (
              <button
                onClick={() => setSelectedConceptIds([])}
                className="text-xs text-ink-muted hover:text-error transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {concepts.map((concept) => (
              <button
                key={concept.id}
                onClick={() => toggleConcept(concept.id)}
                className={clsx(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                  selectedConceptIds.includes(concept.id)
                    ? 'bg-brass text-surface'
                    : 'bg-canvas-muted text-ink-secondary hover:bg-canvas-subtle'
                )}
              >
                <span className="flex items-center gap-1.5">
                  <Sparkles size={10} />
                  {concept.name}
                </span>
              </button>
            ))}
          </div>
          {selectedConceptIds.length > 0 && (
            <p className="text-[0.65rem] text-ink-muted">
              {getSelectedConceptTags().join(', ')}
            </p>
          )}
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
          <>
            <div className="flex flex-wrap gap-2">
              <AnimatePresence>
                {contextImages.map((img) => {
                  const hasOverride = img!.id in contextAnnotationOverrides;
                  return (
                    <motion.div
                      key={img!.id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      onClick={() => setEditingContextImageId(img!.id)}
                      className="relative cursor-pointer group"
                      title="Click to edit annotation for this context image"
                    >
                      <img
                        src={getImageUrl(img!.image_path)}
                        alt=""
                        className={clsx(
                          'w-14 h-14 rounded-lg object-cover transition-all',
                          'group-hover:ring-2 group-hover:ring-brass/50',
                          'group-hover:brightness-90'
                        )}
                      />
                      {/* Hover overlay with edit icon */}
                      <div className={clsx(
                        'absolute inset-0 rounded-lg flex items-center justify-center',
                        'bg-ink/40 opacity-0 group-hover:opacity-100 transition-opacity',
                        'pointer-events-none'
                      )}>
                        <Pencil size={16} className="text-surface" />
                      </div>
                      {/* Override indicator (always visible when active) */}
                      {hasOverride && (
                        <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-brass flex items-center justify-center z-10">
                          <Pencil size={8} className="text-surface" />
                        </div>
                      )}
                      {/* Remove button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeContextImage(img!.id);
                        }}
                        className={clsx(
                          'absolute -top-1 -right-1 w-5 h-5 rounded-full z-10',
                          'bg-ink text-surface',
                          'flex items-center justify-center',
                          'hover:bg-error transition-colors'
                        )}
                      >
                        <X size={10} />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
            {/* Help text */}
            <p className="text-[0.6rem] text-ink-muted">
              Click an image to add context-specific annotation
            </p>
          </>
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
            leftIcon={<FolderOpen size={14} />}
            onClick={handleOpenImagePicker}
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

      {/* Advanced Options */}
      <div className="border border-border rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={clsx(
            'w-full px-3 py-2 flex items-center justify-between',
            'text-xs font-medium text-ink-secondary',
            'hover:bg-canvas-muted transition-colors'
          )}
        >
          <span className="flex items-center gap-2">
            <Settings2 size={14} />
            Advanced Options
            {/* Show "Modified" only if values differ from settings defaults */}
            {(
              (imageSize && imageSize !== (settings?.image_size || '')) ||
              (aspectRatio && aspectRatio !== (settings?.aspect_ratio || '')) ||
              (seed && seed !== (settings?.seed != null ? settings.seed.toString() : '')) ||
              (safetyLevel && safetyLevel !== (settings?.safety_level || ''))
            ) && (
              <span className="px-1.5 py-0.5 bg-brass-muted text-brass-dark rounded text-[0.625rem]">
                Modified
              </span>
            )}
          </span>
          <ChevronDown
            size={14}
            className={clsx(
              'transition-transform',
              showAdvanced && 'rotate-180'
            )}
          />
        </button>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-3 border-t border-border space-y-3 bg-canvas-subtle">
                {/* Image Size */}
                <div>
                  <label className="block text-[0.625rem] font-medium text-ink-tertiary uppercase tracking-wide mb-1.5">
                    Image Size
                  </label>
                  <div className="flex gap-1.5">
                    {IMAGE_SIZE_OPTIONS.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setImageSize(imageSize === size ? '' : size)}
                        className={clsx(
                          'flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors',
                          'border',
                          imageSize === size
                            ? 'bg-brass-muted border-brass text-brass-dark'
                            : 'bg-surface border-border text-ink-secondary hover:bg-canvas-muted'
                        )}
                      >
                        {size}
                        <span className="block text-[0.5rem] text-ink-muted mt-0.5">
                          {SIZE_PRICES[size]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Aspect Ratio */}
                <div>
                  <label className="block text-[0.625rem] font-medium text-ink-tertiary uppercase tracking-wide mb-1.5">
                    Aspect Ratio
                  </label>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className={clsx(
                      'w-full px-2 py-1.5 rounded text-xs',
                      'bg-surface border border-border',
                      'text-ink-primary focus:outline-none focus:ring-1 focus:ring-brass/30'
                    )}
                  >
                    <option value="">Default (1:1)</option>
                    {ASPECT_RATIO_OPTIONS.map((ratio) => (
                      <option key={ratio} value={ratio}>
                        {ratio}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Seed */}
                <div>
                  <label className="block text-[0.625rem] font-medium text-ink-tertiary uppercase tracking-wide mb-1.5">
                    Seed (for reproducibility)
                  </label>
                  <input
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                    placeholder="Random"
                    className={clsx(
                      'w-full px-2 py-1.5 rounded text-xs',
                      'bg-surface border border-border',
                      'text-ink-primary placeholder:text-ink-muted',
                      'focus:outline-none focus:ring-1 focus:ring-brass/30'
                    )}
                  />
                </div>

                {/* Safety Level */}
                <div>
                  <label className="block text-[0.625rem] font-medium text-ink-tertiary uppercase tracking-wide mb-1.5">
                    Safety Filter
                  </label>
                  <select
                    value={safetyLevel}
                    onChange={(e) => setSafetyLevel(e.target.value)}
                    className={clsx(
                      'w-full px-2 py-1.5 rounded text-xs',
                      'bg-surface border border-border',
                      'text-ink-primary focus:outline-none focus:ring-1 focus:ring-brass/30'
                    )}
                  >
                    <option value="">Default</option>
                    <option value="BLOCK_NONE">Block None</option>
                    <option value="BLOCK_ONLY_HIGH">Block Only High</option>
                    <option value="BLOCK_MEDIUM_AND_ABOVE">Block Medium & Above</option>
                    <option value="BLOCK_LOW_AND_ABOVE">Block Low & Above</option>
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Generate Button with Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <div className="flex">
          {/* Main button - Generate Prompts (allows concurrent generations) */}
          <Button
            variant="brass"
            size="lg"
            leftIcon={<Wand2 size={18} />}
            onClick={handleGenerateVariations}
            disabled={isDisabled}
            className="flex-1 rounded-r-none"
          >
            Generate Prompts
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
                  <div className="text-sm font-medium text-ink">Generate Prompts</div>
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
                  <div className="text-sm font-medium text-ink">Generate Images</div>
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
        onClose={() => setShowImagePicker(false)}
        onConfirm={handleImagePickerConfirm}
      />

      {/* Context Annotation Modal */}
      <ContextAnnotationModal
        isOpen={editingContextImageId !== null}
        imageId={editingContextImageId}
        onClose={() => setEditingContextImageId(null)}
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
