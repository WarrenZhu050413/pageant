import { useEffect, useCallback, useRef } from 'react';
import { useStore } from '../store';
import { getImageUrl } from '../api';

// Timeout for delete confirmation (ms)
const DELETE_CONFIRM_TIMEOUT = 2000;

export function useKeyboardShortcuts() {
  const {
    setViewMode,
    selectionMode,
    setSelectionMode,
    nextImage,
    prevImage,
    setRightTab,
    setLeftTab,
    getCurrentImage,
    getCurrentGeneration,
    generationFilter,
    currentGenerationId,
    currentCollectionId,
    contextImageIds,
    setContextImages,
    openExtractionDialog,
    deleteImage,
  } = useStore();

  // Track pending delete state
  const pendingDeleteRef = useRef<{ imageId: string; timeout: ReturnType<typeof setTimeout> } | null>(null);

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

        // Add to context
        case 'a':
        case 'A':
          if (!isMeta) {
            event.preventDefault();
            const imageToAdd = getCurrentImage();
            if (imageToAdd && !contextImageIds.includes(imageToAdd.id)) {
              setContextImages([...contextImageIds, imageToAdd.id]);
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

        // Settings tab
        case 't':
        case 'T':
          if (!isMeta) {
            event.preventDefault();
            setRightTab('settings');
          }
          break;

        // Select mode
        case 's':
        case 'S':
          if (!isMeta) {
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

        // Sidebar tabs
        case 'p':
        case 'P':
          if (!isMeta) {
            event.preventDefault();
            setLeftTab('prompts');
          }
          break;
        case 'o':
        case 'O':
          if (!isMeta) {
            event.preventDefault();
            setLeftTab('collections');
          }
          break;
        case 'i':
        case 'I':
          if (!isMeta) {
            event.preventDefault();
            setLeftTab('all-images');
          }
          break;
        case 'l':
        case 'L':
          if (!isMeta) {
            event.preventDefault();
            setLeftTab('library');
          }
          break;

        // Toolbar actions
        case 'e':
        case 'E':
          if (!isMeta) {
            event.preventDefault();
            const imageForExtract = getCurrentImage();
            if (imageForExtract) {
              openExtractionDialog([imageForExtract.id]);
            }
          }
          break;

        case 'b':
        case 'B':
          if (!isMeta) {
            event.preventDefault();
            // Dispatch custom event for collection dialog
            window.dispatchEvent(new CustomEvent('keyboard:saveCollection'));
          }
          break;

        case 'c':
        case 'C':
          if (!isMeta) {
            event.preventDefault();
            const isViewingConcepts = generationFilter === 'concepts' && !currentGenerationId && !currentCollectionId;
            const promptToCopy = getCurrentGeneration();
            const imageToCopy = getCurrentImage();
            // For concepts, copy the varied_prompt from the image; otherwise copy prompt.prompt
            const textToCopy = isViewingConcepts
              ? imageToCopy?.varied_prompt
              : promptToCopy?.prompt;
            if (textToCopy) {
              navigator.clipboard.writeText(textToCopy);
            }
          }
          break;

        case 'd':
        case 'D':
          if (!isMeta) {
            event.preventDefault();
            const imageToDownload = getCurrentImage();
            const promptForDownload = getCurrentGeneration();
            const isViewingConceptsForDownload = generationFilter === 'concepts' && !currentGenerationId && !currentCollectionId;
            // Use prompt title, image variation_title, or fallback to "Design-Library"
            const downloadTitle = promptForDownload?.title
              || imageToDownload?.variation_title
              || (isViewingConceptsForDownload ? 'Design-Library' : 'Image');
            if (imageToDownload) {
              const link = document.createElement('a');
              link.href = getImageUrl(imageToDownload.image_path);
              const ext = imageToDownload.image_path.split('.').pop();
              link.download = `${downloadTitle.replace(/\s+/g, '-')}-${imageToDownload.id}.${ext}`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }
          }
          break;

        case 'f':
        case 'F':
          if (!isMeta) {
            event.preventDefault();
            // Dispatch custom event to toggle fullscreen
            window.dispatchEvent(new CustomEvent('keyboard:toggleFullscreen'));
          }
          break;

        case 'Backspace':
        case 'Delete':
          if (!isMeta) {
            event.preventDefault();
            const imageToDelete = getCurrentImage();
            if (imageToDelete) {
              // Check if we're confirming a pending delete
              if (pendingDeleteRef.current?.imageId === imageToDelete.id) {
                // Confirmed - actually delete
                clearTimeout(pendingDeleteRef.current.timeout);
                pendingDeleteRef.current = null;
                window.dispatchEvent(new CustomEvent('keyboard:deleteConfirmed'));
                deleteImage(imageToDelete.id);
              } else {
                // First press - show warning
                if (pendingDeleteRef.current) {
                  clearTimeout(pendingDeleteRef.current.timeout);
                }
                const timeout = setTimeout(() => {
                  pendingDeleteRef.current = null;
                  window.dispatchEvent(new CustomEvent('keyboard:deleteCancelled'));
                }, DELETE_CONFIRM_TIMEOUT);
                pendingDeleteRef.current = { imageId: imageToDelete.id, timeout };
                window.dispatchEvent(new CustomEvent('keyboard:deleteWarning', {
                  detail: { imageId: imageToDelete.id }
                }));
              }
            }
          }
          break;
      }
    },
    [
      selectionMode,
      setViewMode,
      setSelectionMode,
      nextImage,
      prevImage,
      setRightTab,
      setLeftTab,
      getCurrentImage,
      getCurrentGeneration,
      generationFilter,
      currentGenerationId,
      currentCollectionId,
      contextImageIds,
      setContextImages,
      openExtractionDialog,
      deleteImage,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
