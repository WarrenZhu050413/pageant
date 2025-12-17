import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { Star, ChevronDown } from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';

export function CompareView() {
  // Select primitive values to avoid infinite re-renders
  const prompts = useStore((s) => s.prompts);
  const currentPromptId = useStore((s) => s.currentPromptId);

  // Compute derived value with useMemo
  const currentPrompt = useMemo(
    () => prompts.find((p) => p.id === currentPromptId) || null,
    [prompts, currentPromptId]
  );
  const compareLeftId = useStore((s) => s.compareLeftId);
  const compareRightId = useStore((s) => s.compareRightId);
  const setCompareImages = useStore((s) => s.setCompareImages);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const isImageFavorite = useStore((s) => s.isImageFavorite);

  const [leftDropdownOpen, setLeftDropdownOpen] = useState(false);
  const [rightDropdownOpen, setRightDropdownOpen] = useState(false);

  if (!currentPrompt || currentPrompt.images.length < 2) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-ink-muted">
          Need at least 2 images to compare
        </p>
      </div>
    );
  }

  // Default to first two images if none selected
  const leftImage = currentPrompt.images.find((img) => img.id === compareLeftId) ||
    currentPrompt.images[0];
  const rightImage = currentPrompt.images.find((img) => img.id === compareRightId) ||
    currentPrompt.images[1];

  const ImageSelector = ({
    side,
    selectedImage,
    isOpen,
    setIsOpen,
    onSelect,
  }: {
    side: 'left' | 'right';
    selectedImage: typeof leftImage;
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    onSelect: (id: string) => void;
  }) => (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg',
          'bg-surface/80 backdrop-blur-sm',
          'text-sm text-ink-secondary hover:text-ink',
          'transition-colors'
        )}
      >
        <span>
          {currentPrompt!.images.findIndex((img) => img.id === selectedImage.id) + 1}
        </span>
        <ChevronDown size={14} className={clsx(isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={clsx(
            'absolute top-full mt-2 z-20',
            side === 'left' ? 'left-0' : 'right-0',
            'bg-surface rounded-lg shadow-lg border border-border',
            'max-h-60 overflow-y-auto'
          )}
        >
          {currentPrompt!.images.map((img, index) => (
            <button
              key={img.id}
              onClick={() => {
                onSelect(img.id);
                setIsOpen(false);
              }}
              className={clsx(
                'flex items-center gap-2 w-full px-3 py-2',
                'hover:bg-canvas-subtle transition-colors',
                img.id === selectedImage.id && 'bg-brass-muted'
              )}
            >
              <img
                src={getImageUrl(img.image_path)}
                alt=""
                className="w-8 h-8 rounded object-cover"
              />
              <span className="text-sm">Image {index + 1}</span>
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );

  const CompareImage = ({
    image,
    side,
  }: {
    image: typeof leftImage;
    side: 'left' | 'right';
  }) => {
    const isFavorite = isImageFavorite(image.id);

    return (
      <div className="relative h-full flex flex-col">
        {/* Selector */}
        <div className="absolute top-4 left-4 z-10">
          <ImageSelector
            side={side}
            selectedImage={image}
            isOpen={side === 'left' ? leftDropdownOpen : rightDropdownOpen}
            setIsOpen={side === 'left' ? setLeftDropdownOpen : setRightDropdownOpen}
            onSelect={(id) => {
              if (side === 'left') {
                setCompareImages(id, compareRightId);
              } else {
                setCompareImages(compareLeftId, id);
              }
            }}
          />
        </div>

        {/* Favorite button */}
        <button
          onClick={() => toggleFavorite(image.id)}
          className={clsx(
            'absolute top-4 right-4 z-10',
            'w-10 h-10 rounded-full',
            'flex items-center justify-center',
            'transition-all duration-200',
            isFavorite
              ? 'bg-favorite text-surface'
              : 'bg-surface/80 backdrop-blur-sm text-ink-muted hover:text-favorite'
          )}
        >
          <Star size={20} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>

        {/* Image */}
        <div className="flex-1 flex items-center justify-center p-4">
          <img
            src={getImageUrl(image.image_path)}
            alt=""
            className="max-h-full max-w-full object-contain rounded-lg shadow-md"
          />
        </div>

        {/* Info */}
        {image.mood && (
          <div className="absolute bottom-4 left-4 right-4 px-3 py-2 rounded-lg bg-surface/80 backdrop-blur-sm">
            <p className="text-xs text-ink-secondary">
              <span className="font-medium text-brass">{image.mood}</span>
              {image.variation_type && ` • ${image.variation_type}`}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex">
      {/* Left side */}
      <div className="flex-1 border-r border-border">
        <CompareImage image={leftImage} side="left" />
      </div>

      {/* Divider */}
      <div className="w-px bg-border relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-canvas border border-border flex items-center justify-center">
          <span className="text-xs text-ink-muted">VS</span>
        </div>
      </div>

      {/* Right side */}
      <div className="flex-1">
        <CompareImage image={rightImage} side="right" />
      </div>
    </div>
  );
}
