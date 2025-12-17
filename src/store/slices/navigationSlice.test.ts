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
      slice.setLeftTab('favorites')
      expect(slice.leftTab).toBe('favorites')
    })
  })

  describe('setRightTab', () => {
    it('updates rightTab', () => {
      slice.setRightTab('info')
      expect(slice.rightTab).toBe('info')
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
})
