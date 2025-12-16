import { useState } from 'react';
import { clsx } from 'clsx';
import { ChevronDown, Plus, X, Check, Folder } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store';
import { Input, Button } from '../ui';

export function SessionsPanel() {
  const sessions = useStore((s) => s.sessions);
  const currentSessionId = useStore((s) => s.currentSessionId);
  const createSession = useStore((s) => s.createSession);
  const switchSession = useStore((s) => s.switchSession);
  const deleteSession = useStore((s) => s.deleteSession);
  const prompts = useStore((s) => s.prompts);

  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const currentSession = sessions.find((s) => s.id === currentSessionId);

  // Count prompts per session
  const getSessionPromptCount = (sessionId: string | null) => {
    if (!sessionId) {
      // Count prompts not in any session
      return prompts.filter((p) => !p.session_id).length;
    }
    return prompts.filter((p) => p.session_id === sessionId).length;
  };

  const handleCreate = async () => {
    if (newSessionName.trim()) {
      setIsLoading(true);
      try {
        await createSession(newSessionName.trim());
        setNewSessionName('');
        setIsCreating(false);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSwitch = async (sessionId: string) => {
    setIsLoading(true);
    try {
      await switchSession(sessionId);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setIsLoading(true);
    try {
      await deleteSession(sessionId);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative border-b border-border">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={clsx(
          'w-full flex items-center justify-between px-4 py-2.5',
          'text-sm text-ink-secondary',
          'hover:bg-canvas-subtle transition-colors',
          isLoading && 'opacity-50 cursor-wait'
        )}
      >
        <div className="flex items-center gap-2 truncate">
          <Folder size={14} className="flex-shrink-0 text-ink-muted" />
          <span className="truncate">
            {currentSession?.name || 'All Prompts'}
          </span>
        </div>
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
              {/* All prompts (no session filter) */}
              <button
                onClick={() => handleSwitch('')}
                disabled={isLoading}
                className={clsx(
                  'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm',
                  'transition-colors',
                  !currentSessionId
                    ? 'bg-brass-muted text-ink'
                    : 'text-ink-secondary hover:bg-canvas-subtle',
                  isLoading && 'opacity-50 cursor-wait'
                )}
              >
                <span>All Prompts</span>
                <span className="text-xs text-ink-muted">
                  {prompts.length}
                </span>
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
                    onClick={() => handleSwitch(session.id)}
                    disabled={isLoading}
                    className={clsx(
                      'flex-1 flex items-center justify-between text-left text-sm text-ink-secondary',
                      isLoading && 'opacity-50 cursor-wait'
                    )}
                  >
                    <span className="truncate">{session.name}</span>
                    <span className="text-xs text-ink-muted ml-2">
                      {getSessionPromptCount(session.id)}
                    </span>
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, session.id)}
                    disabled={isLoading}
                    className="p-1 rounded text-ink-muted hover:text-error hover:bg-error/10 transition-colors"
                    title="Delete session"
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
                    disabled={isLoading}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreate();
                      if (e.key === 'Escape') setIsCreating(false);
                    }}
                  />
                  <button
                    onClick={handleCreate}
                    disabled={isLoading}
                    className="p-1.5 rounded-md bg-success/10 text-success hover:bg-success/20 transition-colors"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setIsCreating(false)}
                    disabled={isLoading}
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
                  disabled={isLoading}
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
