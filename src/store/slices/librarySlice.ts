import type { StateCreator } from 'zustand'
import type { LibraryItem, Collection, Story } from '../../types'

export interface LibrarySlice {
  // State
  libraryItems: LibraryItem[]
  collections: Collection[]
  stories: Story[]

  // Actions (state-only, no API calls - those remain in main store)
  setLibraryItems: (items: LibraryItem[]) => void
  setCollections: (collections: Collection[]) => void
  setStories: (stories: Story[]) => void
}

export const createLibrarySlice: StateCreator<LibrarySlice> = (set) => ({
  // Initial state
  libraryItems: [],
  collections: [],
  stories: [],

  // Actions
  setLibraryItems: (items) => set({ libraryItems: items }),
  setCollections: (collections) => set({ collections }),
  setStories: (stories) => set({ stories }),
})
