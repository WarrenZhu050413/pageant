import { useState } from 'react';
import { clsx } from 'clsx';
import { Wand2, Settings, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store';
import { Tabs } from '../ui/Tabs';
import type { RightTab } from '../../types';
import { GenerateTab } from './GenerateTab';
import { SettingsTab } from './SettingsTab';
import { NotesPanel } from '../sidebar/NotesPanel';

const tabs = [
  { id: 'generate', label: 'Generate', icon: <Wand2 size={14} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={14} /> },
];

export function RightPanel() {
  const rightTab = useStore((s) => s.rightTab);
  const setRightTab = useStore((s) => s.setRightTab);
  const [isNotesExpanded, setIsNotesExpanded] = useState(true);

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <Tabs
        tabs={tabs}
        activeTab={rightTab}
        onChange={(id) => setRightTab(id as RightTab)}
      />

      {/* Tab Content - both tabs always mounted to preserve state */}
      <div className="flex-1 overflow-hidden relative">
        <div
          className={`h-full overflow-y-auto absolute inset-0 transition-opacity duration-150 ${
            rightTab === 'generate' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
          }`}
        >
          <GenerateTab />
        </div>
        <div
          className={`h-full overflow-y-auto absolute inset-0 transition-opacity duration-150 ${
            rightTab === 'settings' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
          }`}
        >
          <SettingsTab />
        </div>
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
