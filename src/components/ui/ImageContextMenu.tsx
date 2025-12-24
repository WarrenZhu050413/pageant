import { useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { ScanSearch, Download, Trash2, FolderPlus, Archive } from 'lucide-react';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface ImageContextMenuProps {
  position: ContextMenuPosition | null;
  onClose: () => void;
  onFindSimilar?: () => void;
  onDownload?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onAddToCollection?: () => void;
}

export function ImageContextMenu({
  position,
  onClose,
  onFindSimilar,
  onDownload,
  onArchive,
  onDelete,
  onAddToCollection,
}: ImageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!position) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [position, onClose]);

  if (!position) return null;

  const menuItems = [
    { icon: ScanSearch, label: 'Find similar', onClick: onFindSimilar },
    { icon: FolderPlus, label: 'Add to collection', onClick: onAddToCollection },
    { icon: Download, label: 'Download', onClick: onDownload },
    { icon: Archive, label: 'Archive', onClick: onArchive },
    { icon: Trash2, label: 'Delete', onClick: onDelete, danger: true },
  ].filter((item) => item.onClick);

  return (
    <div
      ref={menuRef}
      className={clsx(
        'fixed z-50 min-w-[160px] py-1',
        'bg-surface border border-ink/10 rounded-lg shadow-lg',
        'animate-in fade-in zoom-in-95 duration-100'
      )}
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {menuItems.map((item, index) => (
        <button
          key={index}
          onClick={() => {
            item.onClick?.();
            onClose();
          }}
          className={clsx(
            'w-full px-3 py-2 flex items-center gap-2 text-sm',
            'transition-colors',
            item.danger
              ? 'text-danger hover:bg-danger/10'
              : 'text-ink hover:bg-ink/5'
          )}
        >
          <item.icon size={16} />
          {item.label}
        </button>
      ))}
    </div>
  );
}
