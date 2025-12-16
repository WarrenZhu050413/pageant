import { useStore } from '../../store';

export function NotesPanel() {
  const notes = useStore((s) => s.notes);
  const updateNotes = useStore((s) => s.updateNotes);

  return (
    <div className="p-3 pt-0">
      <textarea
        value={notes}
        onChange={(e) => updateNotes(e.target.value)}
        placeholder="Jot down ideas, notes, or reminders..."
        className="w-full h-24 p-2.5 text-sm text-ink-secondary resize-none
          bg-canvas-subtle border border-border rounded-lg
          placeholder:text-ink-muted
          focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass-muted
          font-[family-name:var(--font-body)]"
      />
    </div>
  );
}
