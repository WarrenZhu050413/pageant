import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { FolderOpen, Trash2, Star, Pencil } from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';
import { Button, IconButton } from '../ui';
import { Dialog } from '../ui/Dialog';
import { CollectionEditModal } from '../modals/CollectionEditModal';
import type { Collection } from '../../types';

const FAVORITES_COLLECTION_NAME = '⭐ Favorites';

export function CollectionsTab() {
  const rawCollections = useStore((s) => s.collections);

  // Sort collections: Favorites always first, then by creation date
  const collections = useMemo(() => {
    return [...rawCollections].sort((a, b) => {
      // Favorites always first
      if (a.name === FAVORITES_COLLECTION_NAME) return -1;
      if (b.name === FAVORITES_COLLECTION_NAME) return 1;
      // Then by creation date (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [rawCollections]);
  const prompts = useStore((s) => s.prompts);
  const deleteCollection = useStore((s) => s.deleteCollection);
  const addContextImages = useStore((s) => s.addContextImages);
  const setRightTab = useStore((s) => s.setRightTab);
  const viewCollection = useStore((s) => s.viewCollection);
  const currentCollectionId = useStore((s) => s.currentCollectionId);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);

  const handleEditClick = (collection: Collection, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCollection(collection);
  };

  // Helper to get image data by ID
  const getImageById = (imageId: string) => {
    for (const p of prompts) {
      const img = p.images.find((i) => i.id === imageId);
      if (img) return img;
    }
    return null;
  };

  if (collections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <div className="w-12 h-12 rounded-full bg-canvas-muted flex items-center justify-center mb-3">
          <FolderOpen size={20} className="text-ink-muted" />
        </div>
        <p className="text-sm text-ink-secondary">No collections yet</p>
        <p className="text-xs text-ink-muted mt-1">
          Select images and save them as a collection
        </p>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1">
      {collections.map((collection, index) => {
        // Get thumbnail images (up to 4)
        const thumbnails = collection.image_ids
          .slice(0, 4)
          .map((id) => getImageById(id))
          .filter(Boolean);

        const isActive = collection.id === currentCollectionId;
        const isFavorites = collection.name === FAVORITES_COLLECTION_NAME;

        return (
          <motion.div
            key={collection.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.02 }}
            className={clsx(
              'group rounded-lg overflow-hidden cursor-pointer',
              isActive
                ? 'bg-brass-muted border border-brass/30'
                : 'hover:bg-canvas-subtle transition-colors'
            )}
            onClick={() => viewCollection(collection.id)}
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
                    {isFavorites ? (
                      <Star size={16} className="text-favorite" />
                    ) : (
                      <FolderOpen size={16} className="text-ink-muted" />
                    )}
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
                    {collection.name}
                  </h3>
                  <span className="flex-shrink-0 text-[0.625rem] font-medium px-1.5 py-0.5 rounded bg-canvas-muted text-ink-tertiary">
                    {collection.image_ids.length}
                  </span>
                </div>

                {collection.description && (
                  <p className="text-xs text-ink-muted truncate mt-0.5">
                    {collection.description}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      addContextImages(collection.image_ids);
                      setRightTab('generate');
                    }}
                  >
                    Add to Context
                  </Button>
                  <IconButton
                    size="sm"
                    variant="ghost"
                    tooltip="Edit"
                    onClick={(e) => handleEditClick(collection, e)}
                  >
                    <Pencil size={14} />
                  </IconButton>
                  {/* Don't allow deleting the Favorites collection */}
                  {!isFavorites && (
                    <IconButton
                      size="sm"
                      variant="danger"
                      tooltip="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(collection.id);
                      }}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  )}
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
        title="Delete Collection"
      >
        <p className="text-sm text-ink-secondary mb-6">
          Are you sure you want to delete this collection? The images will not be
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
                deleteCollection(deleteId);
                setDeleteId(null);
              }
            }}
          >
            Delete
          </Button>
        </div>
      </Dialog>

      {/* Edit Collection Modal */}
      <CollectionEditModal
        isOpen={!!editingCollection}
        onClose={() => setEditingCollection(null)}
        collection={editingCollection}
      />
    </div>
  );
}
