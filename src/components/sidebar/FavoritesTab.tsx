import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { Star, Download, FileCode } from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl, getExportFavoritesUrl, getExportGalleryUrl } from '../../api';
import { Button } from '../ui';

export function FavoritesTab() {
  const getFavoriteImages = useStore((s) => s.getFavoriteImages);
  const setCurrentPrompt = useStore((s) => s.setCurrentPrompt);
  const setCurrentImageIndex = useStore((s) => s.setCurrentImageIndex);
  const prompts = useStore((s) => s.prompts);

  const favoriteImages = getFavoriteImages();

  const handleImageClick = (promptId: string, imageId: string) => {
    setCurrentPrompt(promptId);
    const prompt = prompts.find((p) => p.id === promptId);
    if (prompt) {
      const index = prompt.images.findIndex((img) => img.id === imageId);
      if (index !== -1) {
        setCurrentImageIndex(index);
      }
    }
  };

  if (favoriteImages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <div className="w-12 h-12 rounded-full bg-canvas-muted flex items-center justify-center mb-3">
          <Star size={20} className="text-ink-muted" />
        </div>
        <p className="text-sm text-ink-secondary">No favorites yet</p>
        <p className="text-xs text-ink-muted mt-1">
          Star images you love to find them here
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Export Buttons */}
      <div className="p-3 border-b border-border flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<Download size={14} />}
          onClick={() => window.open(getExportFavoritesUrl(), '_blank')}
          className="flex-1"
        >
          Download ZIP
        </Button>
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<FileCode size={14} />}
          onClick={() => window.open(getExportGalleryUrl(), '_blank')}
          className="flex-1"
        >
          Export HTML
        </Button>
      </div>

      {/* Grid with names */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-2 gap-2">
          {favoriteImages.map(({ image, promptId, promptTitle }, index) => (
            <motion.button
              key={image.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.02 }}
              onClick={() => handleImageClick(promptId, image.id)}
              className={clsx(
                'flex flex-col rounded-lg overflow-hidden',
                'bg-canvas-subtle',
                'hover:ring-2 hover:ring-brass transition-all',
                'group'
              )}
            >
              <div className="aspect-square overflow-hidden bg-canvas-muted">
                <img
                  src={getImageUrl(image.image_path)}
                  alt={promptTitle}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="px-2 py-1.5 flex items-center gap-1.5">
                <Star size={10} className="text-favorite shrink-0" fill="currentColor" />
                <span className="text-[0.65rem] text-ink-secondary truncate">
                  {promptTitle}
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Count */}
      <div className="p-3 border-t border-border text-center">
        <span className="text-xs text-ink-muted">
          {favoriteImages.length} favorite{favoriteImages.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
