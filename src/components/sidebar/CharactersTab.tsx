import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { User, Trash2, Pencil } from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';
import { Button, IconButton } from '../ui';
import { Dialog } from '../ui/Dialog';
import type { CharacterReference } from '../../types';

export function CharactersTab() {
  const rawCharacters = useStore((s) => s.characters);

  // Sort characters by creation date (newest first)
  const characters = useMemo(() => {
    return [...rawCharacters].sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [rawCharacters]);

  const getAllGenerations = useStore((s) => s.getAllGenerations);
  const allPrompts = getAllGenerations();
  const deleteCharacter = useStore((s) => s.deleteCharacter);
  const addContextImages = useStore((s) => s.addContextImages);
  const setRightTab = useStore((s) => s.setRightTab);
  const currentCharacterId = useStore((s) => s.currentCharacterId);
  const setCurrentCharacter = useStore((s) => s.setCurrentCharacter);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingCharacter, setEditingCharacter] = useState<CharacterReference | null>(null);

  const handleEditClick = (character: CharacterReference, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCharacter(character);
  };

  // Helper to get image data by ID (searches all sources including archived)
  const getImageById = (imageId: string) => {
    for (const p of allPrompts) {
      const img = p.images.find((i) => i.id === imageId);
      if (img) return img;
    }
    return null;
  };

  if (characters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <div className="w-12 h-12 rounded-full bg-canvas-muted flex items-center justify-center mb-3">
          <User size={20} className="text-ink-muted" />
        </div>
        <p className="text-sm text-ink-secondary">No characters yet</p>
        <p className="text-xs text-ink-muted mt-1">
          Select images and create a character reference
        </p>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1">
      {characters.map((character, index) => {
        // Get thumbnail images (up to 4)
        const thumbnails = character.reference_images
          .slice(0, 4)
          .map((ref) => getImageById(ref.image_id))
          .filter(Boolean);

        const isActive = character.id === currentCharacterId;

        return (
          <motion.div
            key={character.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.02 }}
            className={clsx(
              'group rounded-lg overflow-hidden cursor-pointer',
              isActive
                ? 'bg-brass-muted border border-brass/30'
                : 'hover:bg-canvas-subtle transition-colors'
            )}
            onClick={() => setCurrentCharacter(character.id)}
          >
            <div className="flex gap-3 p-2.5">
              {/* Thumbnail Grid */}
              <div
                className={clsx(
                  'w-12 h-12 rounded-md flex-shrink-0 overflow-hidden',
                  'bg-canvas-muted grid grid-cols-2 gap-px'
                )}
              >
                {thumbnails.length > 0 ? (
                  thumbnails.map((img, i) => (
                    <div key={i} className="bg-canvas-muted">
                      {img && (
                        <img
                          src={getImageUrl(img.image_path)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 row-span-2 flex items-center justify-center">
                    <User size={16} className="text-ink-muted" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3
                    className={clsx(
                      'text-sm font-medium truncate',
                      isActive ? 'text-brass-dark' : 'text-ink-secondary'
                    )}
                  >
                    {character.name}
                  </h3>
                  <span className="flex-shrink-0 text-[0.625rem] font-medium px-1.5 py-0.5 rounded bg-canvas-muted text-ink-tertiary">
                    {character.reference_images.length}
                  </span>
                </div>

                {character.description && (
                  <p className="text-xs text-ink-muted truncate mt-0.5">
                    {character.description}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      const imageIds = character.reference_images.map((ref) => ref.image_id);
                      addContextImages(imageIds);
                      setRightTab('generate');
                    }}
                  >
                    Add to Context
                  </Button>
                  <IconButton
                    size="sm"
                    variant="ghost"
                    onClick={(e) => handleEditClick(character, e)}
                  >
                    <Pencil size={14} />
                  </IconButton>
                  <IconButton
                    size="sm"
                    variant="danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(character.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}

      {/* Delete Confirmation */}
      <Dialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Character"
      >
        <p className="text-sm text-ink-secondary mb-6">
          Are you sure you want to delete this character? The reference images will not be
          deleted.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDeleteId(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (deleteId) {
                deleteCharacter(deleteId);
                setDeleteId(null);
              }
            }}
          >
            Delete
          </Button>
        </div>
      </Dialog>

      {/* TODO: Edit Character Modal */}
      {editingCharacter && (
        <Dialog
          isOpen={!!editingCharacter}
          onClose={() => setEditingCharacter(null)}
          title="Edit Character"
        >
          <p className="text-sm text-ink-secondary mb-6">
            Character editing coming soon.
          </p>
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setEditingCharacter(null)}>
              Close
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
