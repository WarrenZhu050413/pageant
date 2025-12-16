import type { StateCreator } from 'zustand'
import type { SelectionMode } from '../../types'

export interface SelectionSlice {
  // State
  selectionMode: SelectionMode
  selectedIds: Set<string>
  compareLeftId: string | null
  compareRightId: string | null
  selectedPromptIds: Set<string>

  // Actions
  setSelectionMode: (mode: SelectionMode) => void
  toggleSelection: (id: string) => void
  clearSelection: () => void
  setCompareImages: (leftId: string | null, rightId: string | null) => void
  togglePromptSelection: (id: string) => void
  clearPromptSelection: () => void
}

export const createSelectionSlice: StateCreator<SelectionSlice> = (set, get) => ({
  // Initial state
  selectionMode: 'none',
  selectedIds: new Set(),
  compareLeftId: null,
  compareRightId: null,
  selectedPromptIds: new Set(),

  // Actions
  setSelectionMode: (mode) => set({
    selectionMode: mode,
    selectedIds: new Set(),
  }),

  toggleSelection: (id) => {
    const { selectedIds, selectionMode } = get()
    if (selectionMode === 'none') return

    const newSelectedIds = new Set(selectedIds)
    if (newSelectedIds.has(id)) {
      newSelectedIds.delete(id)
    } else {
      newSelectedIds.add(id)
    }
    set({ selectedIds: newSelectedIds })
  },

  clearSelection: () => set({
    selectedIds: new Set(),
    compareLeftId: null,
    compareRightId: null,
  }),

  setCompareImages: (leftId, rightId) => set({
    compareLeftId: leftId,
    compareRightId: rightId,
  }),

  togglePromptSelection: (id) => {
    const { selectedPromptIds } = get()
    const newSelected = new Set(selectedPromptIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    set({ selectedPromptIds: newSelected })
  },

  clearPromptSelection: () => set({ selectedPromptIds: new Set() }),
})
