import { useState, useMemo, useEffect } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { BookOpen, Trash2, Pencil, Plus, Users, Check } from 'lucide-react';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';
import { Button, IconButton } from '../ui';
import { Dialog } from '../ui/Dialog';
import type { Story } from '../../types';

export function StoriesTab() {
  const rawStories = useStore((s) => s.stories);

  // Sort stories by creation date (newest first)
  const stories = useMemo(() => {
    return [...rawStories].sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [rawStories]);

  const getAllGenerations = useStore((s) => s.getAllGenerations);
  const allPrompts = getAllGenerations();
  const deleteStory = useStore((s) => s.deleteStory);
  const viewStory = useStore((s) => s.viewStory);
  const currentStoryId = useStore((s) => s.currentStoryId);
  const characters = useStore((s) => s.characters);
  const updateStory = useStore((s) => s.updateStory);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newStoryTitle, setNewStoryTitle] = useState('');
  const [newStoryDescription, setNewStoryDescription] = useState('');
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
  const createStory = useStore((s) => s.createStory);

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCharacterIds, setEditCharacterIds] = useState<string[]>([]);

  // Initialize edit form when editing story changes
  useEffect(() => {
    if (editingStory) {
      setEditTitle(editingStory.title);
      setEditDescription(editingStory.description || '');
      setEditCharacterIds(editingStory.character_ids || []);
    }
  }, [editingStory]);

  const handleEditClick = (story: Story, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingStory(story);
  };

  // Toggle character selection for create dialog
  const toggleCreateCharacter = (charId: string) => {
    setSelectedCharacterIds((prev) =>
      prev.includes(charId)
        ? prev.filter((id) => id !== charId)
        : [...prev, charId]
    );
  };

  // Toggle character selection for edit dialog
  const toggleEditCharacter = (charId: string) => {
    setEditCharacterIds((prev) =>
      prev.includes(charId)
        ? prev.filter((id) => id !== charId)
        : [...prev, charId]
    );
  };

  // Helper to get image data by ID (searches all sources including archived)
  const getImageById = (imageId: string) => {
    for (const p of allPrompts) {
      const img = p.images.find((i) => i.id === imageId);
      if (img) return img;
    }
    return null;
  };

  // Get all image IDs from all chapters of a story
  const getStoryImageIds = (story: Story): string[] => {
    return story.chapters.flatMap((ch) => ch.image_ids);
  };

  const handleCreateStory = async () => {
    if (!newStoryTitle.trim()) return;
    const story = await createStory(newStoryTitle.trim(), newStoryDescription.trim() || undefined);
    // If we have character IDs selected, update the story with them
    if (story && selectedCharacterIds.length > 0) {
      await updateStory(story.id, { character_ids: selectedCharacterIds });
    }
    setNewStoryTitle('');
    setNewStoryDescription('');
    setSelectedCharacterIds([]);
    setShowCreateDialog(false);
  };

  const handleEditStory = async () => {
    if (!editingStory || !editTitle.trim()) return;
    await updateStory(editingStory.id, {
      title: editTitle.trim(),
      description: editDescription.trim() || undefined,
      character_ids: editCharacterIds,
    });
    setEditingStory(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with Create button */}
      <div className="p-2 border-b border-border">
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<Plus size={14} />}
          onClick={() => setShowCreateDialog(true)}
          className="w-full"
        >
          New Story
        </Button>
      </div>

      {/* Stories list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {stories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <div className="w-12 h-12 rounded-full bg-canvas-muted flex items-center justify-center mb-3">
              <BookOpen size={20} className="text-ink-muted" />
            </div>
            <p className="text-sm text-ink-secondary">No stories yet</p>
            <p className="text-xs text-ink-muted mt-1">
              Create a story to organize images into chapters
            </p>
          </div>
        ) : (
          stories.map((story, index) => {
            // Get thumbnail images (up to 4) from all chapters
            const allImageIds = getStoryImageIds(story);
            const thumbnails = allImageIds
              .slice(0, 4)
              .map((id) => getImageById(id))
              .filter(Boolean);

            const isActive = story.id === currentStoryId;
            const chapterCount = story.chapters.length;

            return (
              <motion.div
                key={story.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className={clsx(
                  'group rounded-lg overflow-hidden cursor-pointer',
                  isActive
                    ? 'bg-brass-muted border border-brass/30'
                    : 'hover:bg-canvas-subtle transition-colors'
                )}
                onClick={() => viewStory(story.id)}
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
                        <BookOpen size={16} className="text-ink-muted" />
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
                        {story.title}
                      </h3>
                      <span className="flex-shrink-0 text-[0.625rem] font-medium px-1.5 py-0.5 rounded bg-canvas-muted text-ink-tertiary">
                        {chapterCount} ch
                      </span>
                    </div>

                    {story.description && (
                      <p className="text-xs text-ink-muted truncate mt-0.5">
                        {story.description}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <IconButton
                        size="sm"
                        variant="ghost"
                        onClick={(e) => handleEditClick(story, e)}
                      >
                        <Pencil size={14} />
                      </IconButton>
                      <IconButton
                        size="sm"
                        variant="danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(story.id);
                        }}
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Create Story Dialog */}
      <Dialog
        isOpen={showCreateDialog}
        onClose={() => {
          setShowCreateDialog(false);
          setSelectedCharacterIds([]);
        }}
        title="New Story"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-secondary mb-1">
              Title
            </label>
            <input
              type="text"
              value={newStoryTitle}
              onChange={(e) => setNewStoryTitle(e.target.value)}
              placeholder="Enter story title..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brass/50"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-secondary mb-1">
              Description (optional)
            </label>
            <textarea
              value={newStoryDescription}
              onChange={(e) => setNewStoryDescription(e.target.value)}
              placeholder="Enter story description..."
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brass/50 resize-none"
            />
          </div>

          {/* Character Selection */}
          {characters.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-ink-secondary mb-2">
                <Users size={14} className="inline mr-1.5" />
                Characters (optional)
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {characters.map((char) => {
                  const isSelected = selectedCharacterIds.includes(char.id);
                  const firstRef = char.reference_images[0];
                  const thumbImg = firstRef ? getImageById(firstRef.image_id) : null;
                  return (
                    <div
                      key={char.id}
                      onClick={() => toggleCreateCharacter(char.id)}
                      className={clsx(
                        'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors',
                        isSelected
                          ? 'bg-brass-muted border border-brass/30'
                          : 'hover:bg-canvas-subtle border border-transparent'
                      )}
                    >
                      <div className="w-8 h-8 rounded-md overflow-hidden bg-canvas-muted flex-shrink-0">
                        {thumbImg ? (
                          <img
                            src={getImageUrl(thumbImg.image_path)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-ink-muted">
                            <Users size={14} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{char.name}</p>
                        {char.description && (
                          <p className="text-xs text-ink-muted truncate">{char.description}</p>
                        )}
                      </div>
                      {isSelected && (
                        <Check size={16} className="text-brass flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
              {selectedCharacterIds.length > 0 && (
                <p className="text-xs text-ink-muted mt-2">
                  {selectedCharacterIds.length} character(s) will be included for visual consistency
                </p>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => {
            setShowCreateDialog(false);
            setSelectedCharacterIds([]);
          }}>
            Cancel
          </Button>
          <Button
            variant="brass"
            onClick={handleCreateStory}
            disabled={!newStoryTitle.trim()}
          >
            Create Story
          </Button>
        </div>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Story"
      >
        <p className="text-sm text-ink-secondary mb-6">
          Are you sure you want to delete this story? The images will not be deleted.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDeleteId(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (deleteId) {
                deleteStory(deleteId);
                setDeleteId(null);
              }
            }}
          >
            Delete
          </Button>
        </div>
      </Dialog>

      {/* Edit Story Dialog */}
      {editingStory && (
        <Dialog
          isOpen={!!editingStory}
          onClose={() => setEditingStory(null)}
          title="Edit Story"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-secondary mb-1">
                Title
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Enter story title..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brass/50"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-secondary mb-1">
                Description (optional)
              </label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Enter story description..."
                rows={3}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brass/50 resize-none"
              />
            </div>

            {/* Character Selection */}
            {characters.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-ink-secondary mb-2">
                  <Users size={14} className="inline mr-1.5" />
                  Characters
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {characters.map((char) => {
                    const isSelected = editCharacterIds.includes(char.id);
                    const firstRef = char.reference_images[0];
                    const thumbImg = firstRef ? getImageById(firstRef.image_id) : null;
                    return (
                      <div
                        key={char.id}
                        onClick={() => toggleEditCharacter(char.id)}
                        className={clsx(
                          'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors',
                          isSelected
                            ? 'bg-brass-muted border border-brass/30'
                            : 'hover:bg-canvas-subtle border border-transparent'
                        )}
                      >
                        <div className="w-8 h-8 rounded-md overflow-hidden bg-canvas-muted flex-shrink-0">
                          {thumbImg ? (
                            <img
                              src={getImageUrl(thumbImg.image_path)}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-ink-muted">
                              <Users size={14} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink truncate">{char.name}</p>
                          {char.description && (
                            <p className="text-xs text-ink-muted truncate">{char.description}</p>
                          )}
                        </div>
                        {isSelected && (
                          <Check size={16} className="text-brass flex-shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
                {editCharacterIds.length > 0 && (
                  <p className="text-xs text-ink-muted mt-2">
                    {editCharacterIds.length} character(s) will be used for visual consistency
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" onClick={() => setEditingStory(null)}>
              Cancel
            </Button>
            <Button
              variant="brass"
              onClick={handleEditStory}
              disabled={!editTitle.trim()}
            >
              Save Changes
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
