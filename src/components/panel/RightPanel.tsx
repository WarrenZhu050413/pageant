import { motion, AnimatePresence } from 'framer-motion';
import { Wand2, Settings } from 'lucide-react';
import { useStore } from '../../store';
import { Tabs } from '../ui/Tabs';
import type { RightTab } from '../../types';
import { GenerateTab } from './GenerateTab';
import { SettingsTab } from './SettingsTab';

const tabs = [
  { id: 'generate', label: 'Generate', icon: <Wand2 size={14} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={14} /> },
];

export function RightPanel() {
  const rightTab = useStore((s) => s.rightTab);
  const setRightTab = useStore((s) => s.setRightTab);

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <Tabs
        tabs={tabs}
        activeTab={rightTab}
        onChange={(id) => setRightTab(id as RightTab)}
      />

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={rightTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
            className="h-full overflow-y-auto"
          >
            {rightTab === 'generate' && <GenerateTab />}
            {rightTab === 'settings' && <SettingsTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
