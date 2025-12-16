import { useState } from 'react';
import { clsx } from 'clsx';
import { ChevronDown, Plus, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store';
import { Input, Button } from '../ui';

export function SessionsPanel() {
  const sessions = useStore((s) => s.sessions);
  const currentSessionId = useStore((s) => s.currentSessionId);
  const createSession = useStore((s) => s.createSession);
  const switchSession = useStore((s) => s.switchSession);
  const deleteSession = useStore((s) => s.deleteSession);

  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');

  const currentSession = sessions.find((s) => s.id === currentSessionId);

  const handleCreate = () => {
    if (newSessionName.trim()) {
      createSession(newSessionName.trim());
      setNewSessionName('');
      setIsCreating(false);
    }
  };

  return (
    <div className="relative border-b border-border">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'w-full flex items-center justify-between px-4 py-2.5',
          'text-sm text-ink-secondary',
          'hover:bg-canvas-subtle transition-colors'
        )}
      >
        <span className="truncate">
          {currentSession?.name || 'Default Session'}
        </span>
        <ChevronDown
          size={14}
          className={clsx(
            'flex-shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="p-2 space-y-1">
              {/* Default session */}
              <button
                onClick={() => {
                  switchSession('');
                  setIsOpen(false);
                }}
                className={clsx(
                  'w-full text-left px-3 py-2 rounded-md text-sm',
                  'transition-colors',
                  !currentSessionId
                    ? 'bg-brass-muted text-ink'
                    : 'text-ink-secondary hover:bg-canvas-subtle'
                )}
              >
                Default Session
              </button>

              {/* Existing sessions */}
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-md',
                    'transition-colors',
                    session.id === currentSessionId
                      ? 'bg-brass-muted'
                      : 'hover:bg-canvas-subtle'
                  )}
                >
                  <button
                    onClick={() => {
                      switchSession(session.id);
                      setIsOpen(false);
                    }}
                    className="flex-1 text-left text-sm text-ink-secondary truncate"
                  >
                    {session.name}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(session.id);
                    }}
                    className="p-1 rounded text-ink-muted hover:text-error hover:bg-error/10 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}

              {/* Create new */}
              {isCreating ? (
                <div className="flex items-center gap-2 p-2">
                  <Input
                    value={newSessionName}
                    onChange={(e) => setNewSessionName(e.target.value)}
                    placeholder="Session name"
                    className="flex-1 text-sm py-1.5"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreate();
                      if (e.key === 'Escape') setIsCreating(false);
                    }}
                  />
                  <button
                    onClick={handleCreate}
                    className="p-1.5 rounded-md bg-success/10 text-success hover:bg-success/20 transition-colors"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setIsCreating(false)}
                    className="p-1.5 rounded-md text-ink-muted hover:bg-canvas-muted transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  leftIcon={<Plus size={14} />}
                  onClick={() => setIsCreating(true)}
                  className="w-full justify-start"
                >
                  New Session
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
