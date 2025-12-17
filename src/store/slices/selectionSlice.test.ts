import { describe, it, expect, beforeEach } from 'vitest'
import { createSelectionSlice, type SelectionSlice } from './selectionSlice'

describe('selectionSlice', () => {
  let slice: SelectionSlice

  beforeEach(() => {
    const set = (partial: Partial<SelectionSlice> | ((state: SelectionSlice) => Partial<SelectionSlice>)) => {
      const update = typeof partial === 'function' ? partial(slice) : partial
      Object.assign(slice, update)
    }
    const get = () => slice
    slice = createSelectionSlice(set as never, get as never, {} as never)
  })

  describe('initial state', () => {
    it('has default selectionMode as none', () => {
      expect(slice.selectionMode).toBe('none')
    })

    it('has empty selectedIds', () => {
      expect(slice.selectedIds.size).toBe(0)
    })

    it('has null compareLeftId and compareRightId', () => {
      expect(slice.compareLeftId).toBeNull()
      expect(slice.compareRightId).toBeNull()
    })

    it('has empty selectedPromptIds', () => {
      expect(slice.selectedPromptIds.size).toBe(0)
    })
  })

  describe('setSelectionMode', () => {
    it('updates selectionMode', () => {
      slice.setSelectionMode('batch')
      expect(slice.selectionMode).toBe('batch')
    })

    it('clears selectedIds when changing mode', () => {
      slice.selectedIds = new Set(['id-1', 'id-2'])
      slice.setSelectionMode('select')
      expect(slice.selectedIds.size).toBe(0)
    })
  })

  describe('toggleSelection', () => {
    it('adds id when not selected', () => {
      slice.selectionMode = 'batch'
      slice.toggleSelection('id-1')
      expect(slice.selectedIds.has('id-1')).toBe(true)
    })

    it('removes id when already selected', () => {
      slice.selectionMode = 'batch'
      slice.selectedIds = new Set(['id-1'])
      slice.toggleSelection('id-1')
      expect(slice.selectedIds.has('id-1')).toBe(false)
    })

    it('does nothing when selectionMode is none', () => {
      slice.selectionMode = 'none'
      slice.toggleSelection('id-1')
      expect(slice.selectedIds.size).toBe(0)
    })
  })

  describe('clearSelection', () => {
    it('clears selectedIds and compare images', () => {
      slice.selectedIds = new Set(['id-1', 'id-2'])
      slice.compareLeftId = 'id-1'
      slice.compareRightId = 'id-2'
      slice.clearSelection()
      expect(slice.selectedIds.size).toBe(0)
      expect(slice.compareLeftId).toBeNull()
      expect(slice.compareRightId).toBeNull()
    })
  })

  describe('setCompareImages', () => {
    it('sets compare images', () => {
      slice.setCompareImages('left-id', 'right-id')
      expect(slice.compareLeftId).toBe('left-id')
      expect(slice.compareRightId).toBe('right-id')
    })
  })

  describe('togglePromptSelection', () => {
    it('adds prompt id when not selected', () => {
      slice.togglePromptSelection('prompt-1')
      expect(slice.selectedPromptIds.has('prompt-1')).toBe(true)
    })

    it('removes prompt id when already selected', () => {
      slice.selectedPromptIds = new Set(['prompt-1'])
      slice.togglePromptSelection('prompt-1')
      expect(slice.selectedPromptIds.has('prompt-1')).toBe(false)
    })
  })

  describe('clearPromptSelection', () => {
    it('clears selectedPromptIds', () => {
      slice.selectedPromptIds = new Set(['prompt-1', 'prompt-2'])
      slice.clearPromptSelection()
      expect(slice.selectedPromptIds.size).toBe(0)
    })
  })
})
