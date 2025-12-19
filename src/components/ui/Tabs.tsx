import { clsx } from 'clsx';
import { motion } from 'framer-motion';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div
      role="tablist"
      className={clsx(
        'flex border-b border-border overflow-x-auto',
        // Show thin scrollbar when needed (removed scrollbar-none)
        'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={clsx(
              'relative flex items-center gap-1 px-1.5 py-2 flex-shrink-0',
              'text-[0.65rem] font-medium whitespace-nowrap',
              'transition-colors duration-150',
              isActive ? 'text-ink' : 'text-ink-tertiary hover:text-ink-secondary',
              'group'
            )}
            title={tab.shortcut ? `${tab.label} (${tab.shortcut})` : tab.label}
          >
            {tab.icon}
            {tab.label}
            {tab.shortcut && (
              <kbd className={clsx(
                'ml-0.5 px-1 py-0.5 text-[0.5rem] font-mono rounded',
                'bg-canvas-muted border border-border',
                'opacity-0 group-hover:opacity-100 transition-opacity',
                isActive ? 'text-ink-secondary' : 'text-ink-tertiary'
              )}>
                {tab.shortcut}
              </kbd>
            )}
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-brass"
                initial={false}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
