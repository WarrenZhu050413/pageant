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
} from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';
import { Button, Input, Textarea } from '../ui';
import type { Template } from '../../types';

export function GenerateTab() {
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [category, setCategory] = useState('Custom');
  const [count, setCount] = useState(4);

  const contextImageIds = useStore((s) => s.contextImageIds);
  const removeContextImage = useStore((s) => s.removeContextImage);
  const clearContextImages = useStore((s) => s.clearContextImages);
  const setContextImages = useStore((s) => s.setContextImages);
  const isGenerating = useStore((s) => s.isGenerating);
  const generate = useStore((s) => s.generate);
  const uploadImages = useStore((s) => s.uploadImages);
  const prompts = useStore((s) => s.prompts);
  const selectedIds = useStore((s) => s.selectedIds);
  const favorites = useStore((s) => s.favorites);
  const collections = useStore((s) => s.collections);
  const getCurrentImage = useStore((s) => s.getCurrentImage);

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
      setCategory(e.detail.category);
    };
    document.addEventListener('use-template', handler as EventListener);
    return () => document.removeEventListener('use-template', handler as EventListener);
  }, []);

  const handleGenerate = () => {
    if (!prompt.trim() || !title.trim()) return;

    generate({
      prompt: prompt.trim(),
      title: title.trim(),
      category: category.trim() || 'Custom',
      count,
    });

    // Clear form after submitting
    setTitle('');
    setPrompt('');
    setCount(4);
  };

  const handleAddFromSelection = () => {
    setContextImages(Array.from(selectedIds));
  };

  const handleAddFromFavorites = () => {
    setContextImages(favorites.slice(0, 6));
  };

  const handleAddCurrentImage = () => {
    const current = getCurrentImage();
    if (current) {
      setContextImages([...contextImageIds, current.id]);
    }
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

      {/* Category */}
      <Input
        label="Category"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="Custom"
      />

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
            onClick={handleAddFromFavorites}
            disabled={favorites.length === 0}
          >
            From Favorites
          </Button>
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<FolderOpen size={14} />}
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

      {/* Generate Button */}
      <Button
        variant="brass"
        size="lg"
        leftIcon={isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
        onClick={handleGenerate}
        disabled={isGenerating || !prompt.trim() || !title.trim()}
        className="w-full"
      >
        {isGenerating ? 'Generating...' : 'Generate Images'}
      </Button>

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
