import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  FolderOpen,
  BookmarkIcon,
  Star,
  BarChart3,
} from 'lucide-react';
import { useStore } from '../../store';
import { Tabs } from '../ui/Tabs';
import type { LeftTab } from '../../types';
import { PromptsTab } from './PromptsTab';
import { CollectionsTab } from './CollectionsTab';
import { LibraryTab } from './LibraryTab';
import { FavoritesTab } from './FavoritesTab';
import { PreferencesTab } from './PreferencesTab';
import { SessionsPanel } from './SessionsPanel';
import { InfoSection } from './InfoSection';

const tabs = [
  { id: 'prompts', label: 'Prompts', icon: <FileText size={14} /> },
  { id: 'collections', label: 'Collections', icon: <FolderOpen size={14} /> },
  { id: 'library', label: 'Library', icon: <BookmarkIcon size={14} /> },
  { id: 'favorites', label: 'Favorites', icon: <Star size={14} /> },
  { id: 'preferences', label: 'Style', icon: <BarChart3 size={14} /> },
];

export function LeftSidebar() {
  const leftTab = useStore((s) => s.leftTab);
  const setLeftTab = useStore((s) => s.setLeftTab);

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
            {leftTab === 'library' && <LibraryTab />}
            {leftTab === 'favorites' && <FavoritesTab />}
            {leftTab === 'preferences' && <PreferencesTab />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Info Section */}
      <InfoSection />
    </div>
  );
}
