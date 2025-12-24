import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  FolderOpen,
  Images,
  User,
  BookOpen,
} from 'lucide-react';
import { useStore } from '../../store';
import { Tabs } from '../ui/Tabs';
import type { LeftTab } from '../../types';
import { GenerationsTab } from './GenerationsTab';
import { CollectionsTab } from './CollectionsTab';
import { AllImagesTab } from './AllImagesTab';
import { CharactersTab } from './CharactersTab';
import { StoriesTab } from './StoriesTab';
import { InfoSection } from './InfoSection';

const tabs = [
  { id: 'generations', label: 'Generations', icon: <FileText size={14} />, shortcut: 'H' },
  { id: 'collections', label: 'Collections', icon: <FolderOpen size={14} />, shortcut: 'O' },
  { id: 'all-images', label: 'Images', icon: <Images size={14} />, shortcut: 'M' },
  { id: 'characters', label: 'Characters', icon: <User size={14} /> },
  { id: 'stories', label: 'Stories', icon: <BookOpen size={14} /> },
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
            {leftTab === 'generations' && <GenerationsTab />}
            {leftTab === 'collections' && <CollectionsTab />}
            {leftTab === 'all-images' && <AllImagesTab />}
            {leftTab === 'characters' && <CharactersTab />}
            {leftTab === 'stories' && <StoriesTab />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Info Section */}
      <InfoSection />
    </div>
  );
}
