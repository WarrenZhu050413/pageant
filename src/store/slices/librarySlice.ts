import type { StateCreator } from 'zustand'
import type { DesignToken, Collection } from '../../types'

export interface LibrarySlice {
  // State
  designTokens: DesignToken[]
  collections: Collection[]

  // Actions (state-only, no API calls - those remain in main store)
  setDesignTokens: (tokens: DesignToken[]) => void
  setCollections: (collections: Collection[]) => void
}

export const createLibrarySlice: StateCreator<LibrarySlice> = (set) => ({
  // Initial state
  designTokens: [],
  collections: [],

  // Actions
  setDesignTokens: (tokens) => set({ designTokens: tokens }),
  setCollections: (collections) => set({ collections }),
})
