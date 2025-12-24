import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useToastStore, toast } from './toastStore'

describe('toastStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    useToastStore.setState({ toasts: [] })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('addToast', () => {
    it('adds a toast to the store', () => {
      useToastStore.getState().addToast({ message: 'Test', type: 'success' })

      expect(useToastStore.getState().toasts).toHaveLength(1)
      expect(useToastStore.getState().toasts[0].message).toBe('Test')
      expect(useToastStore.getState().toasts[0].type).toBe('success')
    })

    it('generates unique IDs for toasts', () => {
      useToastStore.getState().addToast({ message: 'First', type: 'success' })
      useToastStore.getState().addToast({ message: 'Second', type: 'error' })

      const toasts = useToastStore.getState().toasts
      expect(toasts[0].id).not.toBe(toasts[1].id)
    })

    it('returns the toast ID', () => {
      const id = useToastStore.getState().addToast({ message: 'Test', type: 'info' })

      expect(id).toMatch(/^toast-/)
    })
  })

  describe('auto-remove duration', () => {
    it('uses 3 second default duration', () => {
      useToastStore.getState().addToast({ message: 'Test', type: 'success' })

      expect(useToastStore.getState().toasts).toHaveLength(1)

      // Advance time by 2.9 seconds - toast should still exist
      vi.advanceTimersByTime(2900)
      expect(useToastStore.getState().toasts).toHaveLength(1)

      // Advance to 3 seconds - toast should be removed
      vi.advanceTimersByTime(100)
      expect(useToastStore.getState().toasts).toHaveLength(0)
    })

    it('respects custom duration', () => {
      useToastStore.getState().addToast({ message: 'Test', type: 'success', duration: 5000 })

      // At 3 seconds, should still exist
      vi.advanceTimersByTime(3000)
      expect(useToastStore.getState().toasts).toHaveLength(1)

      // At 5 seconds, should be removed
      vi.advanceTimersByTime(2000)
      expect(useToastStore.getState().toasts).toHaveLength(0)
    })

    it('does not auto-remove when duration is 0', () => {
      useToastStore.getState().addToast({ message: 'Test', type: 'success', duration: 0 })

      vi.advanceTimersByTime(10000)
      expect(useToastStore.getState().toasts).toHaveLength(1)
    })
  })

  describe('removeToast', () => {
    it('removes a specific toast by ID', () => {
      const id1 = useToastStore.getState().addToast({ message: 'First', type: 'success' })
      useToastStore.getState().addToast({ message: 'Second', type: 'error' })

      useToastStore.getState().removeToast(id1)

      expect(useToastStore.getState().toasts).toHaveLength(1)
      expect(useToastStore.getState().toasts[0].message).toBe('Second')
    })
  })

  describe('clearToasts', () => {
    it('removes all toasts', () => {
      useToastStore.getState().addToast({ message: 'First', type: 'success' })
      useToastStore.getState().addToast({ message: 'Second', type: 'error' })

      useToastStore.getState().clearToasts()

      expect(useToastStore.getState().toasts).toHaveLength(0)
    })
  })

  describe('convenience functions', () => {
    it('toast.success creates success toast', () => {
      toast.success('Success message')

      expect(useToastStore.getState().toasts[0].type).toBe('success')
      expect(useToastStore.getState().toasts[0].message).toBe('Success message')
    })

    it('toast.error creates error toast', () => {
      toast.error('Error message')

      expect(useToastStore.getState().toasts[0].type).toBe('error')
      expect(useToastStore.getState().toasts[0].message).toBe('Error message')
    })

    it('toast.info creates info toast', () => {
      toast.info('Info message')

      expect(useToastStore.getState().toasts[0].type).toBe('info')
      expect(useToastStore.getState().toasts[0].message).toBe('Info message')
    })

    it('toast functions support actions', () => {
      const mockFn = vi.fn()
      toast.success('Test', { label: 'Undo', onClick: mockFn })

      const addedToast = useToastStore.getState().toasts[0]
      expect(addedToast.action?.label).toBe('Undo')

      addedToast.action?.onClick()
      expect(mockFn).toHaveBeenCalled()
    })
  })
})
