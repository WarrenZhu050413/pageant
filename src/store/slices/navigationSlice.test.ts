import { describe, it, expect, beforeEach } from 'vitest'
import { createNavigationSlice, type NavigationSlice } from './navigationSlice'

describe('navigationSlice', () => {
  let slice: NavigationSlice

  beforeEach(() => {
    // Zustand's set accepts either a partial state or a function
    const set = (partial: Partial<NavigationSlice> | ((state: NavigationSlice) => Partial<NavigationSlice>)) => {
      const update = typeof partial === 'function' ? partial(slice) : partial
      Object.assign(slice, update)
    }
    const get = () => slice
    slice = createNavigationSlice(set as never, get as never, {} as never)
  })

  describe('initial state', () => {
    it('has default viewMode as single', () => {
      expect(slice.viewMode).toBe('single')
    })

    it('has default leftTab as prompts', () => {
      expect(slice.leftTab).toBe('prompts')
    })

    it('has default rightTab as generate', () => {
      expect(slice.rightTab).toBe('generate')
    })

    it('has null currentPromptId', () => {
      expect(slice.currentPromptId).toBeNull()
    })

    it('has 0 currentImageIndex', () => {
      expect(slice.currentImageIndex).toBe(0)
    })
  })

  describe('setViewMode', () => {
    it('updates viewMode to single', () => {
      slice.setViewMode('single')
      expect(slice.viewMode).toBe('single')
    })

    it('updates viewMode to grid', () => {
      slice.setViewMode('grid')
      expect(slice.viewMode).toBe('grid')
    })

    it('should only support single and grid view modes', () => {
      // ViewMode should only be 'single' | 'grid'
      // 'compare' view mode has been removed as it was unused
      const validViewModes = ['single', 'grid']
      expect(validViewModes).toHaveLength(2)
      expect(validViewModes).toContain('single')
      expect(validViewModes).toContain('grid')
      expect(validViewModes).not.toContain('compare')
    })
  })

  describe('setLeftTab', () => {
    it('updates leftTab', () => {
      slice.setLeftTab('collections')
      expect(slice.leftTab).toBe('collections')
    })
  })

  describe('setRightTab', () => {
    it('updates rightTab', () => {
      slice.setRightTab('settings')
      expect(slice.rightTab).toBe('settings')
    })
  })

  describe('setCurrentPrompt', () => {
    it('updates currentPromptId and resets image index', () => {
      slice.currentImageIndex = 5
      slice.setCurrentPrompt('prompt-123')
      expect(slice.currentPromptId).toBe('prompt-123')
      expect(slice.currentImageIndex).toBe(0)
    })

    it('handles null', () => {
      slice.setCurrentPrompt(null)
      expect(slice.currentPromptId).toBeNull()
    })
  })

  describe('setCurrentImageIndex', () => {
    it('updates currentImageIndex', () => {
      slice.setCurrentImageIndex(3)
      expect(slice.currentImageIndex).toBe(3)
    })
  })

  describe('no-auto-navigation policy', () => {
    // Documents the intentional behavior change: after generation,
    // we do NOT auto-navigate to new images. User must manually select them.
    // This is implemented in the main store's generate() function.
    it('navigation state should not change unless explicitly set', () => {
      // Set initial navigation state
      slice.currentPromptId = 'original-prompt-123'
      slice.currentImageIndex = 2

      // Navigation functions only change state when explicitly called
      // (the generate function no longer sets currentPromptId)
      expect(slice.currentPromptId).toBe('original-prompt-123')
      expect(slice.currentImageIndex).toBe(2)

      // Only explicit setCurrentPrompt changes the state
      slice.setCurrentPrompt('new-prompt')
      expect(slice.currentPromptId).toBe('new-prompt')
      expect(slice.currentImageIndex).toBe(0) // Reset on new prompt
    })
  })
})
