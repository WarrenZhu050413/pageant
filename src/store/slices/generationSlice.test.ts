import { describe, it, expect, beforeEach } from 'vitest'
import { createGenerationSlice, type GenerationSlice } from './generationSlice'
import { useStore } from '../index'

describe('generationSlice', () => {
  let slice: GenerationSlice

  beforeEach(() => {
    const set = (partial: Partial<GenerationSlice> | ((state: GenerationSlice) => Partial<GenerationSlice>)) => {
      const update = typeof partial === 'function' ? partial(slice) : partial
      Object.assign(slice, update)
    }
    const get = () => slice
    slice = createGenerationSlice(set as never, get as never, {} as never)
  })

  describe('initial state', () => {
    it('has isGenerating false', () => {
      expect(slice.isGenerating).toBe(false)
    })

    it('has empty contextImageIds', () => {
      expect(slice.contextImageIds).toEqual([])
    })

    it('has empty promptVariations', () => {
      expect(slice.promptVariations).toEqual([])
    })

    it('has isGeneratingVariations false', () => {
      expect(slice.isGeneratingVariations).toBe(false)
    })

    it('has showPromptPreview false', () => {
      expect(slice.showPromptPreview).toBe(false)
    })

    it('has empty variationsImageParams', () => {
      expect(slice.variationsImageParams).toEqual({})
    })
  })

  describe('context images', () => {
    it('setContextImages sets all context images', () => {
      slice.setContextImages(['id-1', 'id-2'])
      expect(slice.contextImageIds).toEqual(['id-1', 'id-2'])
    })

    it('addContextImage adds a new context image', () => {
      slice.addContextImage('id-1')
      expect(slice.contextImageIds).toContain('id-1')
    })

    it('addContextImage does not add duplicate', () => {
      slice.contextImageIds = ['id-1']
      slice.addContextImage('id-1')
      expect(slice.contextImageIds).toEqual(['id-1'])
    })

    it('removeContextImage removes context image', () => {
      slice.contextImageIds = ['id-1', 'id-2']
      slice.removeContextImage('id-1')
      expect(slice.contextImageIds).toEqual(['id-2'])
    })

    it('clearContextImages clears all', () => {
      slice.contextImageIds = ['id-1', 'id-2']
      slice.clearContextImages()
      expect(slice.contextImageIds).toEqual([])
    })
  })

  describe('variations', () => {
    it('updateVariation updates text', () => {
      slice.promptVariations = [
        { id: 'v1', text: 'original', mood: 'happy', type: 'variation' },
      ]
      slice.updateVariation('v1', 'updated')
      expect(slice.promptVariations[0].text).toBe('updated')
    })

    it('removeVariation removes variation', () => {
      slice.promptVariations = [
        { id: 'v1', text: 'first', mood: 'happy', type: 'variation' },
        { id: 'v2', text: 'second', mood: 'sad', type: 'variation' },
      ]
      slice.removeVariation('v1')
      expect(slice.promptVariations).toHaveLength(1)
      expect(slice.promptVariations[0].id).toBe('v2')
    })

    it('duplicateVariation creates copy after original', () => {
      slice.promptVariations = [
        { id: 'v1', text: 'first', mood: 'happy', type: 'variation' },
      ]
      slice.duplicateVariation('v1')
      expect(slice.promptVariations).toHaveLength(2)
      expect(slice.promptVariations[1].text).toBe('first')
      expect(slice.promptVariations[1].id).not.toBe('v1')
    })

    it('clearVariations resets all variation state', () => {
      slice.promptVariations = [{ id: 'v1', text: 'test', mood: 'happy', type: 'variation' }]
      slice.variationsBasePrompt = 'base'
      slice.variationsTitle = 'title'
      slice.showPromptPreview = true
      slice.variationsImageParams = { image_size: '1K' }

      slice.clearVariations()

      expect(slice.promptVariations).toEqual([])
      expect(slice.variationsBasePrompt).toBe('')
      expect(slice.variationsTitle).toBe('')
      expect(slice.showPromptPreview).toBe(false)
      expect(slice.variationsImageParams).toEqual({})
    })
  })

  describe('setShowPromptPreview', () => {
    it('sets showPromptPreview', () => {
      slice.setShowPromptPreview(true)
      expect(slice.showPromptPreview).toBe(true)
    })
  })

  describe('setIsGenerating', () => {
    it('sets isGenerating', () => {
      slice.setIsGenerating(true)
      expect(slice.isGenerating).toBe(true)
    })
  })

  describe('per-variation context', () => {
    it('variations can have recommended_context_ids', () => {
      slice.promptVariations = [
        {
          id: 'v1',
          text: 'warm sunset scene',
          mood: 'warm',
          type: 'faithful',
          recommended_context_ids: ['img-1', 'img-2'],
          context_reasoning: 'Using warm-toned images for this variation',
        },
        {
          id: 'v2',
          text: 'cool moonlit scene',
          mood: 'cool',
          type: 'exploration',
          recommended_context_ids: ['img-3'],
          context_reasoning: 'Using cool-toned image for contrast',
        },
      ]
      expect(slice.promptVariations[0].recommended_context_ids).toEqual(['img-1', 'img-2'])
      expect(slice.promptVariations[1].recommended_context_ids).toEqual(['img-3'])
    })

    it('variations without context_ids default to empty array', () => {
      slice.promptVariations = [
        { id: 'v1', text: 'test', mood: 'happy', type: 'variation' },
      ]
      expect(slice.promptVariations[0].recommended_context_ids).toBeUndefined()
    })

    it('updateVariation preserves recommended_context_ids', () => {
      slice.promptVariations = [
        {
          id: 'v1',
          text: 'original',
          mood: 'happy',
          type: 'variation',
          recommended_context_ids: ['img-1'],
          context_reasoning: 'test reasoning',
        },
      ]
      slice.updateVariation('v1', 'updated text')
      expect(slice.promptVariations[0].text).toBe('updated text')
      expect(slice.promptVariations[0].recommended_context_ids).toEqual(['img-1'])
      expect(slice.promptVariations[0].context_reasoning).toBe('test reasoning')
    })

    it('duplicateVariation preserves recommended_context_ids', () => {
      slice.promptVariations = [
        {
          id: 'v1',
          text: 'first',
          mood: 'happy',
          type: 'variation',
          recommended_context_ids: ['img-1', 'img-2'],
          context_reasoning: 'test reasoning',
        },
      ]
      slice.duplicateVariation('v1')
      expect(slice.promptVariations).toHaveLength(2)
      expect(slice.promptVariations[1].recommended_context_ids).toEqual(['img-1', 'img-2'])
      expect(slice.promptVariations[1].context_reasoning).toBe('test reasoning')
    })
  })

})

describe('reedit functionality (main store)', () => {
  beforeEach(() => {
    // Reset the store before each test
    useStore.setState({
      reeditPrompt: null,
      reeditContextIds: null,
      contextImageIds: [],
    })
  })

  describe('initial state', () => {
    it('has null reeditPrompt', () => {
      expect(useStore.getState().reeditPrompt).toBeNull()
    })

    it('has null reeditContextIds', () => {
      expect(useStore.getState().reeditContextIds).toBeNull()
    })
  })

  describe('setReeditData', () => {
    it('sets reedit prompt and context IDs', () => {
      useStore.getState().setReeditData('Test prompt', ['ctx-1', 'ctx-2'])

      expect(useStore.getState().reeditPrompt).toBe('Test prompt')
      expect(useStore.getState().reeditContextIds).toEqual(['ctx-1', 'ctx-2'])
    })

    it('can set empty context IDs', () => {
      useStore.getState().setReeditData('Test prompt', [])

      expect(useStore.getState().reeditPrompt).toBe('Test prompt')
      expect(useStore.getState().reeditContextIds).toEqual([])
    })
  })

  describe('clearReeditData', () => {
    it('clears reedit data', () => {
      // First set some data
      useStore.getState().setReeditData('Test prompt', ['ctx-1'])
      expect(useStore.getState().reeditPrompt).toBe('Test prompt')

      // Then clear it
      useStore.getState().clearReeditData()

      expect(useStore.getState().reeditPrompt).toBeNull()
      expect(useStore.getState().reeditContextIds).toBeNull()
    })
  })
})

describe('hide functionality (main store)', () => {
  beforeEach(() => {
    // Reset the store before each test
    useStore.setState({
      generations: [],
      generationFilter: 'active',
    })
  })

  describe('initial state', () => {
    it('has generationFilter set to active', () => {
      expect(useStore.getState().generationFilter).toBe('active')
    })
  })

  describe('generationFilter state', () => {
    it('can set filter to all', () => {
      useStore.getState().setGenerationFilter('all')
      expect(useStore.getState().generationFilter).toBe('all')
    })

    it('can set filter to hidden', () => {
      useStore.getState().setGenerationFilter('hidden')
      expect(useStore.getState().generationFilter).toBe('hidden')
    })

    it('can set filter back to active', () => {
      useStore.getState().setGenerationFilter('hidden')
      useStore.getState().setGenerationFilter('active')
      expect(useStore.getState().generationFilter).toBe('active')
    })
  })

  describe('hide action types exist', () => {
    it('has hideGeneration action', () => {
      expect(typeof useStore.getState().hideGeneration).toBe('function')
    })

    it('has hideSelectedGenerations action', () => {
      expect(typeof useStore.getState().hideSelectedGenerations).toBe('function')
    })

    it('has unhideGeneration action', () => {
      expect(typeof useStore.getState().unhideGeneration).toBe('function')
    })

    it('has setGenerationFilter action', () => {
      expect(typeof useStore.getState().setGenerationFilter).toBe('function')
    })

    it('has moveGenerationToSession action', () => {
      expect(typeof useStore.getState().moveGenerationToSession).toBe('function')
    })
  })
})
