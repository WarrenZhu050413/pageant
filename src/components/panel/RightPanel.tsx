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
    </div>
  );
}
