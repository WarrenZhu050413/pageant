import type { StateCreator } from 'zustand'
import type { Template, LibraryItem, Collection, Story } from '../../types'

export interface LibrarySlice {
  // State
  templates: Template[]
  libraryItems: LibraryItem[]
  collections: Collection[]
  stories: Story[]

  // Actions (state-only, no API calls - those remain in main store)
  setTemplates: (templates: Template[]) => void
  setLibraryItems: (items: LibraryItem[]) => void
  setCollections: (collections: Collection[]) => void
  setStories: (stories: Story[]) => void
}

export const createLibrarySlice: StateCreator<LibrarySlice> = (set) => ({
  // Initial state
  templates: [],
  libraryItems: [],
  collections: [],
  stories: [],

  // Actions
  setTemplates: (templates) => set({ templates }),
  setLibraryItems: (items) => set({ libraryItems: items }),
  setCollections: (collections) => set({ collections }),
  setStories: (stories) => set({ stories }),
})
