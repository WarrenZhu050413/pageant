import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { Plus, Trash2, Type, Palette, FileText, ChevronDown, Bookmark } from 'lucide-react';
import { useStore } from '../../store';
import { Button, Badge, Dialog, Input, Textarea } from '../ui';
import type { LibraryItem, LibraryItemType } from '../../types';

const TYPE_CONFIG: Record<LibraryItemType, { label: string; icon: React.ReactNode; color: string }> = {
  fragment: { label: 'Fragment', icon: <Type size={12} />, color: 'text-accent' },
  preset: { label: 'Preset', icon: <Palette size={12} />, color: 'text-brass' },
  template: { label: 'Template', icon: <FileText size={12} />, color: 'text-ink-secondary' },
  'design-token': { label: 'Token', icon: <Bookmark size={12} />, color: 'text-success' },
};

interface LibraryItemCardProps {
  item: LibraryItem;
  onInsert: (item: LibraryItem) => void;
  onDelete: (id: string) => void;
}

function LibraryItemCard({ item, onInsert, onDelete }: LibraryItemCardProps) {
  const config = TYPE_CONFIG[item.type];
  const [isExpanded, setIsExpanded] = useState(false);

  // Get the insertable content - design-tokens also have text
  const content = item.type === 'fragment' || item.type === 'design-token'
    ? item.text
    : item.type === 'template'
      ? item.prompt
      : null;
  const styleTags = item.type === 'preset' || item.type === 'design-token' ? item.style_tags : null;

  return (
    <div className="group border border-border rounded-lg p-3 hover:border-border-strong transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={clsx('flex-shrink-0', config.color)}>{config.icon}</span>
            <span className="text-sm font-medium text-ink truncate">{item.name}</span>
          </div>

          {/* Preview content */}
          {content && (
            <p className="text-xs text-ink-muted line-clamp-2 mb-2">{content}</p>
          )}

          {/* Style tags for presets */}
          {styleTags && styleTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {styleTags.slice(0, 4).map((tag) => (
                <Badge key={tag} variant="brass" className="text-[0.6rem]">
                  {tag}
                </Badge>
              ))}
              {styleTags.length > 4 && (
                <span className="text-[0.6rem] text-ink-muted">+{styleTags.length - 4}</span>
              )}
            </div>
          )}

          {/* Expandable full content */}
          {content && content.length > 100 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 text-[0.6rem] text-ink-muted hover:text-ink"
            >
              <ChevronDown size={10} className={clsx('transition-transform', isExpanded && 'rotate-180')} />
              {isExpanded ? 'Show less' : 'Show more'}
            </button>
          )}

          {isExpanded && content && (
            <div className="mt-2 p-2 rounded bg-canvas-subtle">
              <p className="text-xs text-ink-secondary whitespace-pre-wrap">{content}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            variant="brass"
            onClick={() => onInsert(item)}
            className="text-xs px-2 py-1"
          >
            Insert
          </Button>
          <button
            onClick={() => onDelete(item.id)}
            className="p-1 text-ink-muted hover:text-error transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Use count */}
      {item.use_count > 0 && (
        <div className="mt-2 text-[0.6rem] text-ink-muted">
          Used {item.use_count} time{item.use_count !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

export function LibraryTab() {
  const libraryItems = useStore((s) => s.libraryItems);
  const createLibraryItem = useStore((s) => s.createLibraryItem);
  const deleteLibraryItem = useStore((s) => s.deleteLibraryItem);
  const useLibraryItem = useStore((s) => s.useLibraryItem);
  const setRightTab = useStore((s) => s.setRightTab);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<LibraryItemType>('fragment');
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [styleTags, setStyleTags] = useState('');
  const [filter, setFilter] = useState<LibraryItemType | 'all'>('all');

  // Group items by type
  const groupedItems = useMemo(() => {
    const filtered = filter === 'all' ? libraryItems : libraryItems.filter((i) => i.type === filter);
    return {
      fragments: filtered.filter((i) => i.type === 'fragment'),
      presets: filtered.filter((i) => i.type === 'preset'),
      templates: filtered.filter((i) => i.type === 'template'),
      designTokens: filtered.filter((i) => i.type === 'design-token'),
    };
  }, [libraryItems, filter]);

  const handleInsert = async (item: LibraryItem) => {
    await useLibraryItem(item.id);

    // Dispatch event with the content to insert
    // design-token and fragment both use text field
    const insertContent = item.type === 'fragment' || item.type === 'design-token'
      ? item.text
      : item.type === 'template'
        ? item.prompt
        : item.style_tags?.join(', ');

    if (insertContent) {
      window.dispatchEvent(new CustomEvent('library-insert', {
        detail: { content: insertContent, type: item.type, item }
      }));
      // Switch to Generate tab
      setRightTab('generate');
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;

    const data: Parameters<typeof createLibraryItem>[0] = {
      type: createType,
      name: name.trim(),
    };

    if (createType === 'fragment') {
      data.text = content;
    } else if (createType === 'preset') {
      data.style_tags = styleTags.split(',').map((t) => t.trim()).filter(Boolean);
    } else if (createType === 'template') {
      data.prompt = content;
    }

    await createLibraryItem(data);
    setIsCreateDialogOpen(false);
    setName('');
    setContent('');
    setStyleTags('');
  };

  const handleDelete = async (id: string) => {
    await deleteLibraryItem(id);
  };

  const totalCount = libraryItems.length;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-ink">Design Library</h3>
          <p className="text-xs text-ink-muted">{totalCount} item{totalCount !== 1 ? 's' : ''}</p>
        </div>
        <Button
          size="sm"
          variant="brass"
          leftIcon={<Plus size={12} />}
          onClick={() => setIsCreateDialogOpen(true)}
        >
          Add
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-canvas-subtle">
        {(['all', 'fragment', 'preset', 'template', 'design-token'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={clsx(
              'flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors',
              filter === type
                ? 'bg-surface text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink'
            )}
          >
            {type === 'all' ? 'All' : TYPE_CONFIG[type].label + 's'}
          </button>
        ))}
      </div>

      {/* Items list */}
      {totalCount === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-ink-secondary mb-2">No items yet</p>
          <p className="text-xs text-ink-muted">
            Save prompt fragments, style presets, and full templates for quick reuse.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Fragments */}
          {groupedItems.fragments.length > 0 && filter !== 'preset' && filter !== 'template' && filter !== 'design-token' && (
            <section>
              {filter === 'all' && (
                <h4 className="text-xs font-medium text-ink-tertiary uppercase tracking-wide mb-2">
                  Fragments
                </h4>
              )}
              <div className="space-y-2">
                {groupedItems.fragments.map((item) => (
                  <LibraryItemCard
                    key={item.id}
                    item={item}
                    onInsert={handleInsert}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Presets */}
          {groupedItems.presets.length > 0 && filter !== 'fragment' && filter !== 'template' && filter !== 'design-token' && (
            <section>
              {filter === 'all' && (
                <h4 className="text-xs font-medium text-ink-tertiary uppercase tracking-wide mb-2">
                  Style Presets
                </h4>
              )}
              <div className="space-y-2">
                {groupedItems.presets.map((item) => (
                  <LibraryItemCard
                    key={item.id}
                    item={item}
                    onInsert={handleInsert}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Templates */}
          {groupedItems.templates.length > 0 && filter !== 'fragment' && filter !== 'preset' && filter !== 'design-token' && (
            <section>
              {filter === 'all' && (
                <h4 className="text-xs font-medium text-ink-tertiary uppercase tracking-wide mb-2">
                  Templates
                </h4>
              )}
              <div className="space-y-2">
                {groupedItems.templates.map((item) => (
                  <LibraryItemCard
                    key={item.id}
                    item={item}
                    onInsert={handleInsert}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Design Tokens */}
          {groupedItems.designTokens.length > 0 && filter !== 'fragment' && filter !== 'preset' && filter !== 'template' && (
            <section>
              {filter === 'all' && (
                <h4 className="text-xs font-medium text-ink-tertiary uppercase tracking-wide mb-2">
                  Design Tokens
                </h4>
              )}
              <div className="space-y-2">
                {groupedItems.designTokens.map((item) => (
                  <LibraryItemCard
                    key={item.id}
                    item={item}
                    onInsert={handleInsert}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        title="Add to Library"
      >
        <div className="space-y-4">
          {/* Type selector */}
          <div>
            <label className="text-xs font-medium text-ink-secondary block mb-2">Type</label>
            <div className="flex gap-2">
              {(['fragment', 'preset', 'template'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setCreateType(type)}
                  className={clsx(
                    'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                    createType === type
                      ? 'bg-brass text-surface'
                      : 'bg-canvas-subtle text-ink-secondary hover:bg-canvas-muted'
                  )}
                >
                  {TYPE_CONFIG[type].icon}
                  {TYPE_CONFIG[type].label}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={createType === 'fragment' ? 'e.g., Warm lighting' : createType === 'preset' ? 'e.g., Elegant minimal' : 'e.g., Product shot base'}
          />

          {/* Content based on type */}
          {createType === 'fragment' && (
            <Textarea
              label="Text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="e.g., warm wood tones, soft lighting, natural shadows"
              className="min-h-[80px]"
            />
          )}

          {createType === 'preset' && (
            <Input
              label="Style Tags (comma-separated)"
              value={styleTags}
              onChange={(e) => setStyleTags(e.target.value)}
              placeholder="e.g., sans-serif, elegant, minimal, cool"
            />
          )}

          {createType === 'template' && (
            <Textarea
              label="Full Prompt"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter the complete prompt template..."
              className="min-h-[120px]"
            />
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="brass" onClick={handleCreate} disabled={!name.trim()}>
              Add to Library
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
