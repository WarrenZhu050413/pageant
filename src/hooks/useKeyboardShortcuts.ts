import { useEffect, useCallback } from 'react';
import { useStore } from '../store';

export function useKeyboardShortcuts() {
  const {
    viewMode,
    setViewMode,
    selectionMode,
    setSelectionMode,
    nextImage,
    prevImage,
    setRightTab,
    getCurrentImage,
    toggleFavorite,
  } = useStore();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore if typing in an input
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Check for modifier keys
      const isMeta = event.metaKey || event.ctrlKey;

      switch (event.key) {
        // Navigation
        case 'ArrowLeft':
          event.preventDefault();
          prevImage();
          break;
        case 'ArrowRight':
          event.preventDefault();
          nextImage();
          break;

        // View modes
        case '1':
          if (!isMeta) {
            event.preventDefault();
            setViewMode('single');
          }
          break;
        case '2':
          if (!isMeta) {
            event.preventDefault();
            setViewMode('grid');
          }
          break;
        case '3':
          if (!isMeta) {
            event.preventDefault();
            setViewMode('compare');
          }
          break;

        // Favorite
        case 'f':
        case 'F':
          if (!isMeta) {
            event.preventDefault();
            const image = getCurrentImage();
            if (image) {
              toggleFavorite(image.id);
            }
          }
          break;

        // Generate tab
        case 'g':
        case 'G':
          if (!isMeta) {
            event.preventDefault();
            setRightTab('generate');
            // Focus prompt textarea after a short delay
            setTimeout(() => {
              const textarea = document.querySelector(
                '[data-prompt-input]'
              ) as HTMLTextAreaElement;
              textarea?.focus();
            }, 100);
          }
          break;

        // Select mode / Save as template (Cmd+S)
        case 's':
        case 'S':
          if (isMeta) {
            event.preventDefault();
            // Trigger save template modal
            document.dispatchEvent(new CustomEvent('save-template'));
          } else {
            event.preventDefault();
            setSelectionMode(selectionMode === 'select' ? 'none' : 'select');
          }
          break;

        // Escape - exit modes
        case 'Escape':
          if (selectionMode !== 'none') {
            event.preventDefault();
            setSelectionMode('none');
          }
          break;
      }
    },
    [
      viewMode,
      selectionMode,
      setViewMode,
      setSelectionMode,
      nextImage,
      prevImage,
      setRightTab,
      getCurrentImage,
      toggleFavorite,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
