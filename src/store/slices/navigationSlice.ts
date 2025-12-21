import type { StateCreator } from 'zustand'
import type { ViewMode, LeftTab, RightTab } from '../../types'

export type PromptFilter = 'all' | 'concepts';

export interface NavigationSlice {
  // State
  viewMode: ViewMode
  leftTab: LeftTab
  rightTab: RightTab
  currentPromptId: string | null
  currentImageIndex: number
  promptFilter: PromptFilter

  // Actions
  setViewMode: (mode: ViewMode) => void
  setLeftTab: (tab: LeftTab) => void
  setRightTab: (tab: RightTab) => void
  setCurrentPrompt: (id: string | null) => void
  setCurrentImageIndex: (index: number) => void
  setPromptFilter: (filter: PromptFilter) => void
}

export const createNavigationSlice: StateCreator<NavigationSlice> = (set) => ({
  // Initial state
  viewMode: 'single',
  leftTab: 'generations',
  rightTab: 'generate',
  currentPromptId: null,
  currentImageIndex: 0,
  promptFilter: 'all',

  // Actions
  setViewMode: (mode) => set({ viewMode: mode }),
  setLeftTab: (tab) => set({ leftTab: tab }),
  setRightTab: (tab) => set({ rightTab: tab }),
  setCurrentPrompt: (id) => set({ currentPromptId: id, currentImageIndex: 0 }),
  setCurrentImageIndex: (index) => set({ currentImageIndex: index }),
  setPromptFilter: (filter) => set({ promptFilter: filter }),
})
