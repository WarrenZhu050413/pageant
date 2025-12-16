import type { StateCreator } from 'zustand'
import type { PromptVariation } from '../../types'

interface PendingPrompt {
  title: string
  count: number
}

export interface GenerationSlice {
  // State
  isGenerating: boolean
  pendingPrompts: Map<string, PendingPrompt>
  contextImageIds: string[]

  // Two-Phase Generation (Prompt Variations)
  promptVariations: PromptVariation[]
  isGeneratingVariations: boolean
  variationsBasePrompt: string
  variationsTitle: string
  showPromptPreview: boolean
  variationsImageParams: {
    image_size?: string
    aspect_ratio?: string
    seed?: number
    safety_level?: string
  }

  // Actions
  setIsGenerating: (generating: boolean) => void
  setContextImages: (ids: string[]) => void
  addContextImage: (id: string) => void
  removeContextImage: (id: string) => void
  clearContextImages: () => void

  // Variation actions
  updateVariation: (id: string, newText: string) => void
  removeVariation: (id: string) => void
  duplicateVariation: (id: string) => void
  clearVariations: () => void
  setShowPromptPreview: (show: boolean) => void
}

export const createGenerationSlice: StateCreator<GenerationSlice> = (set, get) => ({
  // Initial state
  isGenerating: false,
  pendingPrompts: new Map(),
  contextImageIds: [],

  // Two-Phase Generation
  promptVariations: [],
  isGeneratingVariations: false,
  variationsBasePrompt: '',
  variationsTitle: '',
  showPromptPreview: false,
  variationsImageParams: {},

  // Actions
  setIsGenerating: (generating) => set({ isGenerating: generating }),

  setContextImages: (ids) => set({ contextImageIds: ids }),

  addContextImage: (id) => {
    const { contextImageIds } = get()
    if (!contextImageIds.includes(id)) {
      set({ contextImageIds: [...contextImageIds, id] })
    }
  },

  removeContextImage: (id) => {
    set({ contextImageIds: get().contextImageIds.filter((i) => i !== id) })
  },

  clearContextImages: () => set({ contextImageIds: [] }),

  // Variation actions
  updateVariation: (id, newText) => {
    const { promptVariations } = get()
    set({
      promptVariations: promptVariations.map((v) =>
        v.id === id ? { ...v, text: newText } : v
      ),
    })
  },

  removeVariation: (id) => {
    const { promptVariations } = get()
    set({
      promptVariations: promptVariations.filter((v) => v.id !== id),
    })
  },

  duplicateVariation: (id) => {
    const { promptVariations } = get()
    const original = promptVariations.find((v) => v.id === id)
    if (!original) return

    const newVariation: PromptVariation = {
      ...original,
      id: `var-${Date.now().toString(36)}`,
    }

    const index = promptVariations.findIndex((v) => v.id === id)
    const newVariations = [...promptVariations]
    newVariations.splice(index + 1, 0, newVariation)

    set({ promptVariations: newVariations })
  },

  clearVariations: () => {
    set({
      promptVariations: [],
      variationsBasePrompt: '',
      variationsTitle: '',
      showPromptPreview: false,
      variationsImageParams: {},
    })
  },

  setShowPromptPreview: (show) => set({ showPromptPreview: show }),
})
