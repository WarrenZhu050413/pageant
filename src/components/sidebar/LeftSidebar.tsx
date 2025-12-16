import { useState } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  FolderOpen,
  BookmarkIcon,
  Star,
  BarChart3,
  ChevronDown,
} from 'lucide-react';
import { useStore } from '../../store';
import { Tabs } from '../ui/Tabs';
import type { LeftTab } from '../../types';
import { PromptsTab } from './PromptsTab';
import { CollectionsTab } from './CollectionsTab';
import { TemplatesTab } from './TemplatesTab';
import { FavoritesTab } from './FavoritesTab';
import { PreferencesTab } from './PreferencesTab';
import { SessionsPanel } from './SessionsPanel';
import { NotesPanel } from './NotesPanel';

const tabs = [
  { id: 'prompts', label: 'Prompts', icon: <FileText size={14} /> },
  { id: 'collections', label: 'Collections', icon: <FolderOpen size={14} /> },
  { id: 'templates', label: 'Templates', icon: <BookmarkIcon size={14} /> },
  { id: 'favorites', label: 'Favorites', icon: <Star size={14} /> },
  { id: 'preferences', label: 'Style', icon: <BarChart3 size={14} /> },
];

export function LeftSidebar() {
  const leftTab = useStore((s) => s.leftTab);
  const setLeftTab = useStore((s) => s.setLeftTab);
  const [isNotesExpanded, setIsNotesExpanded] = useState(true);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink tracking-tight">
          Pageant
        </h1>
        <p className="text-xs text-ink-tertiary mt-0.5">Image Generation Studio</p>
      </div>

      {/* Sessions dropdown */}
      <SessionsPanel />

      {/* Tabs */}
      <Tabs
        tabs={tabs}
        activeTab={leftTab}
        onChange={(id) => setLeftTab(id as LeftTab)}
      />

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={leftTab}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.15 }}
            className="h-full overflow-y-auto"
          >
            {leftTab === 'prompts' && <PromptsTab />}
            {leftTab === 'collections' && <CollectionsTab />}
            {leftTab === 'templates' && <TemplatesTab />}
            {leftTab === 'favorites' && <FavoritesTab />}
            {leftTab === 'preferences' && <PreferencesTab />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Notes Section */}
      <div className="border-t border-border">
        <button
          onClick={() => setIsNotesExpanded(!isNotesExpanded)}
          className={clsx(
            'w-full flex items-center justify-between px-4 py-2.5',
            'text-xs font-medium text-ink-secondary uppercase tracking-wide',
            'hover:bg-canvas-subtle transition-colors'
          )}
        >
          <span>Notes</span>
          <ChevronDown
            size={14}
            className={clsx(
              'transition-transform duration-200',
              isNotesExpanded && 'rotate-180'
            )}
          />
        </button>
        <AnimatePresence>
          {isNotesExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <NotesPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
