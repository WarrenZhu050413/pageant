import { describe, it, expect, beforeEach } from 'vitest'
import { createSessionSlice, SessionSlice } from './sessionSlice'

describe('sessionSlice', () => {
  let slice: SessionSlice

  beforeEach(() => {
    const set = (partial: Partial<SessionSlice> | ((state: SessionSlice) => Partial<SessionSlice>)) => {
      const update = typeof partial === 'function' ? partial(slice) : partial
      Object.assign(slice, update)
    }
    const get = () => slice
    slice = createSessionSlice(set as never, get as never, {} as never)
  })

  describe('initial state', () => {
    it('has empty sessions', () => {
      expect(slice.sessions).toEqual([])
    })

    it('has null currentSessionId', () => {
      expect(slice.currentSessionId).toBeNull()
    })

    it('has empty notes', () => {
      expect(slice.notes).toBe('')
    })

    it('has null designPreferences', () => {
      expect(slice.designPreferences).toBeNull()
    })

    it('has 0 totalRated', () => {
      expect(slice.totalRated).toBe(0)
    })
  })

  describe('addSession', () => {
    it('adds session to beginning of list', () => {
      const existingSession = { id: 'old', name: 'Old', notes: '', created_at: '2025-01-01' }
      slice.sessions = [existingSession]

      const newSession = { id: 'new', name: 'New', notes: '', created_at: '2025-01-02' }
      slice.addSession(newSession)

      expect(slice.sessions).toHaveLength(2)
      expect(slice.sessions[0].id).toBe('new')
    })
  })

  describe('removeSession', () => {
    it('removes session from list', () => {
      slice.sessions = [
        { id: 's1', name: 'Session 1', notes: '', created_at: '2025-01-01' },
        { id: 's2', name: 'Session 2', notes: '', created_at: '2025-01-02' },
      ]
      slice.removeSession('s1')
      expect(slice.sessions).toHaveLength(1)
      expect(slice.sessions[0].id).toBe('s2')
    })

    it('clears currentSessionId if removed session was current', () => {
      slice.sessions = [{ id: 's1', name: 'Session 1', notes: '', created_at: '2025-01-01' }]
      slice.currentSessionId = 's1'
      slice.removeSession('s1')
      expect(slice.currentSessionId).toBeNull()
    })

    it('keeps currentSessionId if different session was removed', () => {
      slice.sessions = [
        { id: 's1', name: 'Session 1', notes: '', created_at: '2025-01-01' },
        { id: 's2', name: 'Session 2', notes: '', created_at: '2025-01-02' },
      ]
      slice.currentSessionId = 's1'
      slice.removeSession('s2')
      expect(slice.currentSessionId).toBe('s1')
    })
  })

  describe('updateSessionNotes', () => {
    it('updates notes for specific session', () => {
      slice.sessions = [
        { id: 's1', name: 'Session 1', notes: '', created_at: '2025-01-01' },
        { id: 's2', name: 'Session 2', notes: '', created_at: '2025-01-02' },
      ]
      slice.updateSessionNotes('s1', 'New notes')
      expect(slice.sessions[0].notes).toBe('New notes')
      expect(slice.sessions[1].notes).toBe('')
    })
  })
})
