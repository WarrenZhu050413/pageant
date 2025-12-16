import type { StateCreator } from 'zustand'
import type { Session, DesignPreferences } from '../../types'

export interface SessionSlice {
  // State
  sessions: Session[]
  currentSessionId: string | null
  notes: string

  // Design Axis System
  designPreferences: DesignPreferences | null
  totalRated: number

  // Actions (state-only, no API calls - those remain in main store)
  setSessions: (sessions: Session[]) => void
  setCurrentSessionId: (id: string | null) => void
  setNotes: (notes: string) => void
  setDesignPreferences: (prefs: DesignPreferences | null) => void
  setTotalRated: (count: number) => void
  addSession: (session: Session) => void
  removeSession: (id: string) => void
  updateSessionNotes: (id: string, notes: string) => void
}

export const createSessionSlice: StateCreator<SessionSlice> = (set, get) => ({
  // Initial state
  sessions: [],
  currentSessionId: null,
  notes: '',
  designPreferences: null,
  totalRated: 0,

  // Actions
  setSessions: (sessions) => set({ sessions }),
  setCurrentSessionId: (id) => set({ currentSessionId: id }),
  setNotes: (notes) => set({ notes }),
  setDesignPreferences: (prefs) => set({ designPreferences: prefs }),
  setTotalRated: (count) => set({ totalRated: count }),

  addSession: (session) => {
    const { sessions } = get()
    set({ sessions: [session, ...sessions] })
  },

  removeSession: (id) => {
    const { sessions, currentSessionId } = get()
    set({
      sessions: sessions.filter((s) => s.id !== id),
      currentSessionId: currentSessionId === id ? null : currentSessionId,
    })
  },

  updateSessionNotes: (id, notes) => {
    const { sessions } = get()
    set({
      sessions: sessions.map((s) =>
        s.id === id ? { ...s, notes } : s
      ),
    })
  },
})
