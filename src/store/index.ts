/**
 * Zustand Store - Application state management
 *
 * NAMING CONVENTION:
 * - Frontend uses "Generation" terminology (generations, currentGenerationId, etc.)
 * - Backend uses "Prompt" terminology (/api/prompts, metadata["prompts"])
 * - The API layer (src/api/index.ts) bridges these, calling backend "prompts" endpoints
 *   but the store treats the returned data as Generation[]
 *
 * See src/types/index.ts where `Prompt` is defined as a legacy alias for `Generation`.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Generation,
  Collection,
  Settings,
  Session,
  ViewMode,
  LeftTab,
  RightTab,
  SelectionMode,
  ImageData,
  DesignPreferences,
  DesignAxis,
  DesignDimension,
  DesignToken,
  PromptVariation,
  ImageGenerationParams,
  DraftPrompt,
  CreateTokenRequest,
} from '../types';
import * as api from '../api';
import { toast } from './toastStore';

interface PendingGeneration {
  title?: string;  // Optional - will be auto-generated if not provided
  count: number;
}

interface AppStore {
  // Data
  generations: Generation[];
  designTokens: DesignToken[];
  collections: Collection[];
  settings: Settings | null;

  // Navigation
  currentGenerationId: string | null;
  currentImageIndex: number;
  viewMode: ViewMode;
  leftTab: LeftTab;
  rightTab: RightTab;
  generationFilter: 'all' | 'concepts';

  // Selection
  selectionMode: SelectionMode;
  selectedIds: Set<string>;
  contextImageIds: string[];
  // Ephemeral annotation overrides for context images (not persisted)
  contextAnnotationOverrides: Record<string, string>;

  // UI State
  isGenerating: boolean;
  pendingGenerations: Map<string, PendingGeneration>;
  pendingConceptGenerations: Set<string>; // Token IDs currently generating concept images
  error: string | null;

  // Sessions (persisted)
  sessions: Session[];
  currentSessionId: string | null;
  notes: string;

  // Two-Phase Generation (Prompt Variations)
  promptVariations: PromptVariation[];
  isGeneratingVariations: boolean;
  variationsBasePrompt: string;
  variationsTitle: string;
  showPromptPreview: boolean;
  // Image generation params for variations (stored for use in generateFromVariations)
  variationsImageParams: ImageGenerationParams;
  // Streaming text for real-time feedback during prompt generation
  streamingText: string;

  // Draft Prompts (decoupled variations workflow)
  draftPrompts: DraftPrompt[];
  currentDraftId: string | null;
  // Track drafts currently generating images (for concurrent batch support)
  generatingImageDraftIds: Set<string>;

  // Collection Viewing
  currentCollectionId: string | null;

  // Library "unread" tracking (persisted)
  lastSeenLibraryAt: string | null;  // ISO timestamp of when user last viewed Library tab
  markLibrarySeen: () => void;
  getNewTokenCount: () => number;

  // Actions
  initialize: () => Promise<void>;
  refreshData: () => Promise<void>;
  refreshGenerations: () => Promise<void>;
  refreshCollections: () => Promise<void>;
  refreshDesignTokens: () => Promise<void>;

  // Generation navigation
  setCurrentGeneration: (id: string | null) => void;
  setCurrentImageIndex: (index: number) => void;
  nextImage: () => void;
  prevImage: () => void;

  // View modes
  setViewMode: (mode: ViewMode) => void;
  setLeftTab: (tab: LeftTab) => void;
  setRightTab: (tab: RightTab) => void;
  setGenerationFilter: (filter: 'all' | 'concepts') => void;

  // Selection
  setSelectionMode: (mode: SelectionMode) => void;
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  setSelectedIds: (ids: string[]) => void;
  clearSelection: () => void;

  // Context images
  setContextImages: (ids: string[]) => void;
  addContextImage: (id: string) => void;
  addContextImages: (ids: string[]) => void;
  removeContextImage: (id: string) => void;
  clearContextImages: () => void;
  // Context annotation overrides
  setContextAnnotationOverride: (imageId: string, annotation: string) => void;
  clearContextAnnotationOverride: (imageId: string) => void;
  getContextAnnotationOverride: (imageId: string) => string | undefined;

  // Generation
  generate: (params: {
    prompt: string;
    title?: string;  // Optional - will be auto-generated if not provided
    count?: number;
  } & ImageGenerationParams) => Promise<void>;
  iterate: (imageId: string) => Promise<void>;

  // Two-Phase Generation Actions
  generateVariations: (params: {
    prompt: string;
    title?: string; // Optional - will be auto-generated if not provided
    count?: number;
  } & ImageGenerationParams) => Promise<void>;
  updateVariation: (id: string, newText: string) => void;
  removeVariation: (id: string) => void;
  duplicateVariation: (id: string) => void;
  regenerateSingleVariation: (id: string) => Promise<void>;
  generateFromVariations: () => Promise<void>;
  addMoreVariations: (count?: number) => Promise<void>;
  clearVariations: () => void;
  setShowPromptPreview: (show: boolean) => void;

  // Draft Prompt Actions
  setCurrentDraft: (id: string | null) => void;
  updateDraftVariation: (draftId: string, variationId: string, newText: string) => void;
  updateDraftVariationNotes: (draftId: string, variationId: string, notes: string) => void;
  toggleDraftVariationTag: (draftId: string, variationId: string, tag: string) => void;
  removeDraftVariation: (draftId: string, variationId: string) => void;
  removeMultipleDraftVariations: (draftId: string, variationIds: string[]) => void;
  duplicateDraftVariation: (draftId: string, variationId: string) => void;
  regenerateDraftVariation: (draftId: string, variationId: string) => Promise<void>;
  addMoreDraftVariations: (draftId: string, count?: number) => Promise<void>;
  polishDraftVariation: (draftId: string, variationId: string) => Promise<void>;
  polishDraftVariations: (draftId: string) => Promise<void>;
  generateFromDraft: (draftId: string) => Promise<void>;
  deleteDraft: (draftId: string) => void;
  getCurrentDraft: () => DraftPrompt | null;

  // Delete
  deleteImage: (imageId: string) => Promise<void>;
  deleteGeneration: (generationId: string) => Promise<void>;
  batchDelete: () => Promise<void>;
  batchDeleteGenerations: (generationIds: string[]) => Promise<void>;

  // Generation selection (for bulk operations)
  selectedGenerationIds: Set<string>;
  toggleGenerationSelection: (id: string) => void;
  selectAllGenerations: () => void;
  clearGenerationSelection: () => void;

  // Image notes
  updateImageNotes: (imageId: string, notes: string, annotation?: string) => Promise<void>;

  // Design Tokens
  createToken: (data: CreateTokenRequest) => Promise<DesignToken | undefined>;
  deleteToken: (id: string) => Promise<void>;
  useToken: (id: string) => Promise<DesignToken | undefined>;
  suggestDimensions: (imageIds: string[]) => Promise<DesignDimension[]>;
  generateTokenConcept: (tokenId: string) => Promise<void>;

  // Collections
  createCollection: (name: string, description?: string, imageIds?: string[]) => Promise<void>;
  updateCollection: (id: string, data: { name?: string; description?: string }) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  addToCollection: (collectionId: string) => Promise<void>;
  addImagesToCollection: (collectionId: string, imageIds: string[]) => Promise<void>;
  viewCollection: (id: string) => void;
  setCurrentCollection: (id: string | null) => void;
  getCurrentCollection: () => Collection | null;
  getCurrentCollectionImages: () => ImageData[];
  getConceptImages: () => ImageData[];
  removeFromCollection: (collectionId: string, imageId: string) => Promise<void>;
  removeFromCurrentCollection: (imageId: string) => Promise<void>;

  // Settings
  updateSettings: (settings: {
    variation_prompt: string;
    iteration_prompt?: string;
    image_size?: string;
    aspect_ratio?: string;
    seed?: number;
    safety_level?: string;
    // Nano Banana specific
    thinking_level?: string;
    temperature?: number;
    google_search_grounding?: boolean;
  }) => Promise<void>;

  // Upload
  uploadImages: (files: File[]) => Promise<void>;

  // Sessions (server-side)
  createSession: (name: string) => Promise<void>;
  switchSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  updateNotes: (notes: string) => Promise<void>;

  // Design Axis System
  designPreferences: DesignPreferences | null;
  totalRated: number;
  updateDesignTags: (imageId: string, tags: string[]) => Promise<void>;
  toggleAxisLike: (imageId: string, axis: DesignAxis, tag: string, liked: boolean) => Promise<void>;
  fetchDesignPreferences: () => Promise<void>;
  resetDesignPreferences: () => Promise<void>;

  // Design Dimensions (Rich AI Analysis)
  pendingAnalysis: Set<string>;  // Image IDs currently being analyzed
  analyzeDimensions: (imageId: string) => Promise<DesignDimension[]>;
  confirmDimension: (imageId: string, axis: string) => Promise<void>;
  updateImageDimensions: (imageId: string, dimensions: Record<string, DesignDimension>) => Promise<void>;
  toggleDimensionLike: (imageId: string, axis: string, liked: boolean) => Promise<void>;

  // Token Extraction Dialog (shared between SingleView and SelectionTray)
  extractionDialog: {
    isOpen: boolean;
    isExtracting: boolean;
    imageIds: string[];  // Images being analyzed
    suggestedDimensions: DesignDimension[];
    selectedDimensionIndex: number | null;
  };
  openExtractionDialog: (imageIds: string[]) => Promise<void>;
  closeExtractionDialog: () => void;
  selectExtractionDimension: (index: number | null) => void;
  createTokenFromExtraction: () => Promise<void>;

  // Error handling
  setError: (error: string | null) => void;
  clearError: () => void;

  // Helpers
  getCurrentGeneration: () => Generation | null;
  getCurrentImage: () => ImageData | null;
  getAllImages: () => { image: ImageData; generationId: string; generationTitle: string }[];
}

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Initial state
      generations: [],
      designTokens: [],
      collections: [],
      settings: null,

      currentGenerationId: null,
      currentImageIndex: 0,
      viewMode: 'single',
      leftTab: 'prompts',
      rightTab: 'generate',
      generationFilter: 'all',

      selectionMode: 'none',
      selectedIds: new Set(),
      contextImageIds: [],
      contextAnnotationOverrides: {},

      isGenerating: false,
      pendingGenerations: new Map(),
      pendingConceptGenerations: new Set(),
      error: null,

      sessions: [],
      currentSessionId: null,
      notes: '',

      // Two-Phase Generation (Prompt Variations)
      promptVariations: [],
      isGeneratingVariations: false,
      variationsBasePrompt: '',
      variationsTitle: '',
      showPromptPreview: false,
      variationsImageParams: {},
      streamingText: '',

      // Draft Prompts
      draftPrompts: [],
      currentDraftId: null,
      generatingImageDraftIds: new Set(),

      // Collection Viewing
      currentCollectionId: null,

      // Library "unread" tracking
      lastSeenLibraryAt: null,

      // Generation selection for bulk operations
      selectedGenerationIds: new Set(),

      // Design Axis System
      designPreferences: null,
      totalRated: 0,

      // Design Dimensions (Rich AI Analysis)
      pendingAnalysis: new Set<string>(),

      // Token Extraction Dialog
      extractionDialog: {
        isOpen: false,
        isExtracting: false,
        imageIds: [],
        suggestedDimensions: [],
        selectedDimensionIndex: null,
      },

      // Initialize app
      initialize: async () => {
        try {
          const [generations, designTokens, collections, settings, sessions] = await Promise.all([
            api.fetchPrompts(),
            api.fetchTokens(),
            api.fetchCollections(),
            api.fetchSettings(),
            api.fetchSessions(),
          ]);

          // Convert SessionData to Session type
          const sessionsTyped: Session[] = sessions.map((s) => ({
            id: s.id,
            name: s.name,
            notes: s.notes,
            created_at: s.created_at,
          }));

          // Find the newest generation by created_at (matches sidebar sort order)
          const newestGeneration = generations.length > 0
            ? generations.reduce((latest, g) =>
                new Date(g.created_at) > new Date(latest.created_at) ? g : latest
              )
            : null;

          set({
            generations,
            designTokens,
            collections,
            settings,
            sessions: sessionsTyped,
            currentGenerationId: newestGeneration?.id || null,
          });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      refreshData: async () => {
        try {
          const [generations, designTokens, collections] = await Promise.all([
            api.fetchPrompts(),
            api.fetchTokens(),
            api.fetchCollections(),
          ]);

          set({ generations, designTokens, collections });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      refreshGenerations: async () => {
        try {
          const generations = await api.fetchPrompts();
          set({ generations });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      refreshCollections: async () => {
        try {
          const collections = await api.fetchCollections();
          set({ collections });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      refreshDesignTokens: async () => {
        try {
          const designTokens = await api.fetchTokens();
          set({ designTokens });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      // Generation navigation
      setCurrentGeneration: (id) => {
        set({ currentGenerationId: id, currentImageIndex: 0, currentCollectionId: null });
      },

      setCurrentImageIndex: (index) => {
        const { generationFilter, currentGenerationId, currentCollectionId } = get();
        const generation = get().getCurrentGeneration();
        const collectionImages = get().getCurrentCollectionImages();
        const conceptImages = get().getConceptImages();
        // Check concepts first (when filter active and no generation/collection selected)
        const isViewingConcepts = generationFilter === 'concepts' && !currentGenerationId && !currentCollectionId;
        const images = isViewingConcepts ? conceptImages : (generation?.images || collectionImages);
        if (images.length > 0 && index >= 0 && index < images.length) {
          set({ currentImageIndex: index });
        }
      },

      nextImage: () => {
        const { currentImageIndex, generationFilter, currentGenerationId, currentCollectionId } = get();
        const generation = get().getCurrentGeneration();
        const collectionImages = get().getCurrentCollectionImages();
        const conceptImages = get().getConceptImages();
        const isViewingConcepts = generationFilter === 'concepts' && !currentGenerationId && !currentCollectionId;
        const images = isViewingConcepts ? conceptImages : (generation?.images || collectionImages);
        if (images.length > 0 && currentImageIndex < images.length - 1) {
          set({ currentImageIndex: currentImageIndex + 1 });
        }
      },

      prevImage: () => {
        const { currentImageIndex } = get();
        if (currentImageIndex > 0) {
          set({ currentImageIndex: currentImageIndex - 1 });
        }
      },

      // View modes
      setViewMode: (mode) => set({ viewMode: mode }),
      setLeftTab: (tab) => set({ leftTab: tab }),
      setRightTab: (tab) => set({ rightTab: tab }),
      setGenerationFilter: (filter) => set({ generationFilter: filter }),

      // Selection
      setSelectionMode: (mode) => {
        set({
          selectionMode: mode,
          selectedIds: new Set(),
        });
      },

      toggleSelection: (id) => {
        const { selectedIds, selectionMode } = get();

        if (selectionMode === 'none') return;

        const newSelectedIds = new Set(selectedIds);
        if (newSelectedIds.has(id)) {
          newSelectedIds.delete(id);
        } else {
          newSelectedIds.add(id);
        }

        set({ selectedIds: newSelectedIds });
      },

      selectAll: () => {
        const { generationFilter, currentGenerationId, currentCollectionId } = get();
        const generation = get().getCurrentGeneration();
        const collectionImages = get().getCurrentCollectionImages();
        const conceptImages = get().getConceptImages();
        const isViewingConcepts = generationFilter === 'concepts' && !currentGenerationId && !currentCollectionId;
        const images = isViewingConcepts ? conceptImages : (generation?.images || collectionImages);
        if (images.length > 0) {
          set({ selectedIds: new Set(images.map((img) => img.id)) });
        }
      },

      setSelectedIds: (ids) => {
        set({ selectedIds: new Set(ids) });
      },

      clearSelection: () => {
        set({ selectedIds: new Set() });
      },

      // Context images
      setContextImages: (ids) => set({ contextImageIds: ids }),
      addContextImage: (id) => {
        const { contextImageIds } = get();
        if (!contextImageIds.includes(id)) {
          set({ contextImageIds: [...contextImageIds, id] });
        }
      },
      addContextImages: (ids) => {
        const { contextImageIds } = get();
        const newIds = ids.filter((id) => !contextImageIds.includes(id));
        if (newIds.length > 0) {
          set({ contextImageIds: [...contextImageIds, ...newIds] });
        }
      },
      removeContextImage: (id) => {
        const { contextAnnotationOverrides } = get();
        const newOverrides = { ...contextAnnotationOverrides };
        delete newOverrides[id];
        set({
          contextImageIds: get().contextImageIds.filter((i) => i !== id),
          contextAnnotationOverrides: newOverrides,
        });
      },
      clearContextImages: () => set({ contextImageIds: [], contextAnnotationOverrides: {} }),

      // Context annotation overrides
      setContextAnnotationOverride: (imageId, annotation) => {
        set({
          contextAnnotationOverrides: {
            ...get().contextAnnotationOverrides,
            [imageId]: annotation,
          },
        });
      },
      clearContextAnnotationOverride: (imageId) => {
        const { contextAnnotationOverrides } = get();
        const newOverrides = { ...contextAnnotationOverrides };
        delete newOverrides[imageId];
        set({ contextAnnotationOverrides: newOverrides });
      },
      getContextAnnotationOverride: (imageId) => {
        return get().contextAnnotationOverrides[imageId];
      },

      // Generation (supports concurrent generations)
      generate: async ({ prompt, title, count, image_size, aspect_ratio, seed, safety_level }) => {
        const { contextImageIds, contextAnnotationOverrides, pendingGenerations, currentSessionId, generations } = get();

        // Create pending generation
        const tempId = `pending-${Date.now()}`;
        const newPending = new Map(pendingGenerations);
        newPending.set(tempId, { title, count: count || 4 });

        // isGenerating is true if any pending generations exist
        set({ isGenerating: true, pendingGenerations: newPending, error: null });

        // Store original annotations for images with overrides (for restoration after generation)
        const originalAnnotations: Record<string, { notes: string; annotation: string }> = {};

        // Helper to find image by ID
        const findImage = (imageId: string) => {
          for (const g of generations) {
            const img = g.images.find((i) => i.id === imageId);
            if (img) return img;
          }
          return null;
        };

        try {
          // Apply annotation overrides temporarily
          for (const [imageId, override] of Object.entries(contextAnnotationOverrides)) {
            const img = findImage(imageId);
            if (img) {
              originalAnnotations[imageId] = {
                notes: img.notes || '',
                annotation: img.annotation || '',
              };
              await api.updateImageNotes(imageId, img.notes || '', override);
            }
          }

          await api.generateImages({
            prompt,
            title,
            count,
            context_image_ids: contextImageIds.length > 0 ? contextImageIds : undefined,
            session_id: currentSessionId || undefined,
            image_size,
            aspect_ratio,
            seed,
            safety_level,
          });

          // Remove this pending generation
          const updatedPending = new Map(get().pendingGenerations);
          updatedPending.delete(tempId);

          await get().refreshData();

          // Don't auto-navigate to new generation - only update generation state
          // User can click on the new generation in the left panel to view it
          set({
            isGenerating: updatedPending.size > 0,
            pendingGenerations: updatedPending,
            contextImageIds: [],
            contextAnnotationOverrides: {},
          });

          // Show success toast with option to view
          const generationTitle = title || 'Untitled';
          // Find the newly created generation (should be the latest one)
          const { generations: updatedGenerations } = get();
          const newGeneration = updatedGenerations.find((g) => g.title === generationTitle) || updatedGenerations[0];
          toast.success(`"${generationTitle}" finished generating`, {
            label: 'View',
            onClick: () => {
              if (newGeneration) {
                set({
                  currentGenerationId: newGeneration.id,
                  currentImageIndex: 0,
                  currentDraftId: null,
                });
              }
            },
          });
        } catch (error) {
          const updatedPending = new Map(get().pendingGenerations);
          updatedPending.delete(tempId);
          set({
            isGenerating: updatedPending.size > 0,
            pendingGenerations: updatedPending,
            error: (error as Error).message,
          });

          // Show error toast
          toast.error(`Generation failed: ${(error as Error).message}`);
        } finally {
          // Restore original annotations
          for (const [imageId, original] of Object.entries(originalAnnotations)) {
            try {
              await api.updateImageNotes(imageId, original.notes, original.annotation);
            } catch {
              // Silently ignore restoration errors
            }
          }
          // Refresh to sync state with backend after restoration
          if (Object.keys(originalAnnotations).length > 0) {
            await get().refreshData();
          }
        }
      },

      iterate: async (imageId) => {
        set({ isGenerating: true, error: null });

        try {
          await api.iterateImage(imageId);
          await get().refreshData();

          // Don't auto-navigate - stay on current view
          set({
            isGenerating: false,
          });

          // Show success toast
          toast.success('Iteration complete');
        } catch (error) {
          set({ isGenerating: false, error: (error as Error).message });
          toast.error(`Iteration failed: ${(error as Error).message}`);
        }
      },

      // Two-Phase Generation Actions
      generateVariations: async ({ prompt, title, count = 4, image_size, aspect_ratio, seed, safety_level }) => {
        const { contextImageIds, draftPrompts } = get();

        // Create a draft prompt immediately with placeholder title if not provided
        const draftId = `draft-${Date.now().toString(36)}`;
        const initialTitle = title || 'Generating...'; // Will be replaced with generated title
        const newDraft: DraftPrompt = {
          id: draftId,
          basePrompt: prompt,
          title: initialTitle,
          variations: [],
          createdAt: new Date().toISOString(),
          imageParams: { image_size, aspect_ratio, seed, safety_level },
          contextImageIds: contextImageIds.length > 0 ? [...contextImageIds] : undefined,
          isGenerating: true, // Per-draft generating state for concurrent support
        };

        // Note: isGeneratingVariations kept for backwards compatibility but not used to block UI
        set({
          isGeneratingVariations: true,
          error: null,
          streamingText: '', // Reset streaming text
          draftPrompts: [newDraft, ...draftPrompts],
          currentDraftId: draftId,
          currentGenerationId: null, // Clear current generation to show draft view
          // Legacy modal state (keep for backwards compat during transition)
          variationsBasePrompt: prompt,
          variationsTitle: initialTitle,
          showPromptPreview: false, // Don't show modal anymore
          variationsImageParams: { image_size, aspect_ratio, seed, safety_level },
        });

        try {
          // Use streaming API for real-time progress
          let response: { success: boolean; variations?: typeof newDraft.variations; generated_title?: string; annotation_suggestions?: typeof newDraft.annotationSuggestions; error?: string } = { success: false };

          for await (const event of api.generatePromptVariationsStream({
            prompt,
            title: title || undefined,
            count,
            context_image_ids: contextImageIds.length > 0 ? contextImageIds : undefined,
            image_size,
            aspect_ratio,
            seed,
            safety_level,
          })) {
            if (event.type === 'chunk') {
              // Update streaming text for UI feedback (rolling window to limit memory)
              const newText = get().streamingText + (event.text || '');
              set({ streamingText: newText.slice(-1000) }); // Keep last 1000 chars
            } else if (event.type === 'complete') {
              response = {
                success: event.success || false,
                variations: event.variations,
                generated_title: event.generated_title,
                annotation_suggestions: event.annotation_suggestions,
              };
            } else if (event.type === 'error') {
              response = { success: false, error: event.error };
            }
          }

          if (response.success && response.variations) {
            // Use generated title from model if user didn't provide one
            const finalTitle = response.generated_title || title || 'Untitled';

            // Auto-apply annotation suggestions: apply suggested annotations to images
            // and store original_annotation for revert capability
            if (response.annotation_suggestions && response.annotation_suggestions.length > 0) {
              const { generations } = get();
              // Build a map of current annotations to preserve as originals
              const currentAnnotations = new Map<string, string>();
              for (const generation of generations) {
                for (const img of generation.images) {
                  if (img.annotation) {
                    currentAnnotations.set(img.id, img.annotation);
                  }
                }
              }

              // Enrich suggestions with original annotations and apply them
              const enrichedSuggestions = response.annotation_suggestions.map(sug => ({
                ...sug,
                original_annotation: sug.original_annotation || currentAnnotations.get(sug.image_id) || '',
              }));

              // Apply suggested annotations to images
              const updatedGenerations = generations.map((g) => ({
                ...g,
                images: g.images.map((img) => {
                  const suggestion = enrichedSuggestions.find(s => s.image_id === img.id);
                  if (suggestion) {
                    return { ...img, annotation: suggestion.suggested_annotation };
                  }
                  return img;
                }),
              }));

              // Update generations with applied annotations
              set({ generations: updatedGenerations });

              // Also persist each annotation to the backend
              for (const sug of enrichedSuggestions) {
                api.updateImageNotes(sug.image_id, '', sug.suggested_annotation).catch(err => {
                  console.error(`Failed to persist annotation for ${sug.image_id}:`, err);
                });
              }

              // Store enriched suggestions (with originals) on the draft
              response.annotation_suggestions = enrichedSuggestions;
            }

            // Update the draft with variations, title, and annotation suggestions
            // Set isGenerating: false on this specific draft
            set({
              draftPrompts: get().draftPrompts.map((d) =>
                d.id === draftId
                  ? {
                      ...d,
                      variations: response.variations!,
                      title: finalTitle,
                      annotationSuggestions: response.annotation_suggestions,
                      isGenerating: false,
                    }
                  : d
              ),
              promptVariations: response.variations, // Keep legacy state for modal fallback
              variationsTitle: finalTitle, // Update legacy title state
              isGeneratingVariations: false,
              streamingText: '', // Clear streaming text on success
            });
          } else {
            // Remove failed draft - don't leave zombies with 0 variations
            set({
              draftPrompts: get().draftPrompts.filter((d) => d.id !== draftId),
              currentDraftId: get().currentDraftId === draftId ? null : get().currentDraftId,
              isGeneratingVariations: false,
              streamingText: '',
              error: response.error || 'Failed to generate variations',
            });
          }
        } catch (error) {
          // Remove failed draft - don't leave zombies with 0 variations
          set({
            draftPrompts: get().draftPrompts.filter((d) => d.id !== draftId),
            currentDraftId: get().currentDraftId === draftId ? null : get().currentDraftId,
            isGeneratingVariations: false,
            streamingText: '',
            error: (error as Error).message,
          });
        }
      },

      updateVariation: (id, newText) => {
        const { promptVariations } = get();
        set({
          promptVariations: promptVariations.map((v) =>
            v.id === id ? { ...v, text: newText } : v
          ),
        });
      },

      removeVariation: (id) => {
        const { promptVariations } = get();
        set({
          promptVariations: promptVariations.filter((v) => v.id !== id),
        });
      },

      duplicateVariation: (id) => {
        const { promptVariations } = get();
        const original = promptVariations.find((v) => v.id === id);
        if (!original) return;

        const newVariation: PromptVariation = {
          ...original,
          id: `var-${Date.now().toString(36)}`,
        };

        // Insert after the original
        const index = promptVariations.findIndex((v) => v.id === id);
        const newVariations = [...promptVariations];
        newVariations.splice(index + 1, 0, newVariation);

        set({ promptVariations: newVariations });
      },

      regenerateSingleVariation: async (id) => {
        const { variationsBasePrompt, contextImageIds } = get();

        try {
          // Generate a single new variation
          const response = await api.generatePromptVariations({
            prompt: variationsBasePrompt,
            count: 1,
            context_image_ids: contextImageIds.length > 0 ? contextImageIds : undefined,
          });

          if (response.success && response.variations.length > 0) {
            const { promptVariations } = get();
            set({
              promptVariations: promptVariations.map((v) =>
                v.id === id ? { ...response.variations[0], id } : v
              ),
            });
          }
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      addMoreVariations: async (count = 2) => {
        const { variationsBasePrompt, contextImageIds, promptVariations } = get();

        set({ isGeneratingVariations: true });

        try {
          const response = await api.generatePromptVariations({
            prompt: variationsBasePrompt,
            count,
            context_image_ids: contextImageIds.length > 0 ? contextImageIds : undefined,
          });

          if (response.success) {
            set({
              promptVariations: [...promptVariations, ...response.variations],
              isGeneratingVariations: false,
            });
          } else {
            set({ isGeneratingVariations: false });
          }
        } catch (error) {
          set({
            isGeneratingVariations: false,
            error: (error as Error).message,
          });
        }
      },

      generateFromVariations: async () => {
        const { promptVariations, variationsTitle, variationsBasePrompt, contextImageIds, currentSessionId, variationsImageParams } = get();

        if (promptVariations.length === 0) return;

        set({ isGenerating: true, showPromptPreview: false, error: null });

        try {
          const response = await api.generateFromPrompts({
            title: variationsTitle,
            prompts: promptVariations.map((v) => ({
              text: v.text,
              mood: v.mood,
              design: v.design,
              design_dimensions: v.design_dimensions,  // Pass dimensions for storage on images
            })),
            context_image_ids: contextImageIds.length > 0 ? contextImageIds : undefined,
            session_id: currentSessionId || undefined,
            base_prompt: variationsBasePrompt, // Pass original base prompt
            ...variationsImageParams,
          });

          // Clear variations and refresh
          const titleForToast = variationsTitle || 'Untitled';
          set({
            promptVariations: [],
            variationsBasePrompt: '',
            variationsTitle: '',
            variationsImageParams: {},
            streamingText: '',
            isGenerating: false,
            contextImageIds: [],
          });

          await get().refreshData();

          // Show toast notification instead of auto-navigating (background generation)
          toast.success(`"${titleForToast}" finished generating`, {
            label: 'View',
            onClick: () => {
              set({
                currentGenerationId: response.prompt_id,
                currentImageIndex: 0,
                currentDraftId: null,
              });
            },
          });
        } catch (error) {
          set({
            isGenerating: false,
            error: (error as Error).message,
          });
          toast.error(`Generation failed: ${(error as Error).message}`);
        }
      },

      clearVariations: () => {
        set({
          promptVariations: [],
          variationsBasePrompt: '',
          variationsTitle: '',
          showPromptPreview: false,
          variationsImageParams: {},
          streamingText: '',
        });
      },

      setShowPromptPreview: (show) => {
        set({ showPromptPreview: show });
      },

      // Draft Prompt Actions
      setCurrentDraft: (id) => {
        if (id) {
          set({ currentDraftId: id, currentGenerationId: null });
        } else {
          set({ currentDraftId: null });
        }
      },

      updateDraftVariation: (draftId, variationId, newText) => {
        const { draftPrompts } = get();
        set({
          draftPrompts: draftPrompts.map((d) =>
            d.id === draftId
              ? {
                  ...d,
                  variations: d.variations.map((v) =>
                    v.id === variationId ? { ...v, text: newText, isEdited: true } : v
                  ),
                }
              : d
          ),
        });
      },

      updateDraftVariationNotes: (draftId, variationId, notes) => {
        const { draftPrompts } = get();
        set({
          draftPrompts: draftPrompts.map((d) =>
            d.id === draftId
              ? {
                  ...d,
                  variations: d.variations.map((v) =>
                    v.id === variationId ? { ...v, userNotes: notes } : v
                  ),
                }
              : d
          ),
        });
      },

      toggleDraftVariationTag: (draftId, variationId, tag) => {
        const { draftPrompts } = get();
        set({
          draftPrompts: draftPrompts.map((d) =>
            d.id === draftId
              ? {
                  ...d,
                  variations: d.variations.map((v) => {
                    if (v.id !== variationId) return v;
                    const current = v.emphasizedTags || [];
                    const isEmphasized = current.includes(tag);
                    return {
                      ...v,
                      emphasizedTags: isEmphasized
                        ? current.filter((t) => t !== tag)
                        : [...current, tag],
                    };
                  }),
                }
              : d
          ),
        });
      },

      removeDraftVariation: (draftId, variationId) => {
        const { draftPrompts } = get();
        set({
          draftPrompts: draftPrompts.map((d) =>
            d.id === draftId
              ? { ...d, variations: d.variations.filter((v) => v.id !== variationId) }
              : d
          ),
        });
      },

      removeMultipleDraftVariations: (draftId, variationIds) => {
        const { draftPrompts } = get();
        const idsToRemove = new Set(variationIds);
        set({
          draftPrompts: draftPrompts.map((d) =>
            d.id === draftId
              ? { ...d, variations: d.variations.filter((v) => !idsToRemove.has(v.id)) }
              : d
          ),
        });
      },

      duplicateDraftVariation: (draftId, variationId) => {
        const { draftPrompts } = get();
        const draft = draftPrompts.find((d) => d.id === draftId);
        if (!draft) return;

        const original = draft.variations.find((v) => v.id === variationId);
        if (!original) return;

        const newVariation: PromptVariation = {
          ...original,
          id: `var-${Date.now().toString(36)}`,
        };

        const index = draft.variations.findIndex((v) => v.id === variationId);
        const newVariations = [...draft.variations];
        newVariations.splice(index + 1, 0, newVariation);

        set({
          draftPrompts: draftPrompts.map((d) =>
            d.id === draftId ? { ...d, variations: newVariations } : d
          ),
        });
      },

      regenerateDraftVariation: async (draftId, variationId) => {
        const { draftPrompts } = get();
        const draft = draftPrompts.find((d) => d.id === draftId);
        if (!draft) return;

        try {
          const response = await api.generatePromptVariations({
            prompt: draft.basePrompt,
            count: 1,
            context_image_ids: draft.contextImageIds,
          });

          if (response.success && response.variations.length > 0) {
            set({
              draftPrompts: get().draftPrompts.map((d) =>
                d.id === draftId
                  ? {
                      ...d,
                      variations: d.variations.map((v) =>
                        v.id === variationId
                          ? { ...response.variations[0], id: variationId }
                          : v
                      ),
                    }
                  : d
              ),
            });
          }
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      addMoreDraftVariations: async (draftId, count = 2) => {
        const { draftPrompts } = get();
        const draft = draftPrompts.find((d) => d.id === draftId);
        if (!draft) return;

        // Set per-draft generating state
        set({
          draftPrompts: draftPrompts.map((d) =>
            d.id === draftId ? { ...d, isGenerating: true } : d
          ),
        });

        try {
          const response = await api.generatePromptVariations({
            prompt: draft.basePrompt,
            count,
            context_image_ids: draft.contextImageIds,
          });

          if (response.success) {
            set({
              draftPrompts: get().draftPrompts.map((d) =>
                d.id === draftId
                  ? { ...d, variations: [...d.variations, ...response.variations], isGenerating: false }
                  : d
              ),
            });
          } else {
            set({
              draftPrompts: get().draftPrompts.map((d) =>
                d.id === draftId ? { ...d, isGenerating: false } : d
              ),
            });
          }
        } catch (error) {
          set({
            draftPrompts: get().draftPrompts.map((d) =>
              d.id === draftId ? { ...d, isGenerating: false } : d
            ),
            error: (error as Error).message,
          });
        }
      },

      polishDraftVariation: async (draftId, variationId) => {
        const { draftPrompts } = get();
        const draft = draftPrompts.find((d) => d.id === draftId);
        if (!draft) return;

        const variation = draft.variations.find((v) => v.id === variationId);
        if (!variation) return;

        set({ isGeneratingVariations: true });

        try {
          const response = await api.polishPrompts({
            base_prompt: draft.basePrompt,
            variations: [{
              id: variation.id,
              text: variation.text,
              user_notes: variation.userNotes,
              mood: variation.mood,
              design: variation.design,
              emphasized_tags: variation.emphasizedTags,
            }],
            context_image_ids: draft.contextImageIds,
          });

          if (response.success && response.polished_variations.length > 0) {
            const polished = response.polished_variations[0];
            set({
              draftPrompts: get().draftPrompts.map((d) =>
                d.id === draftId
                  ? {
                      ...d,
                      variations: d.variations.map((v) =>
                        v.id === variationId
                          ? { ...v, text: polished.text, userNotes: '', isEdited: false }
                          : v
                      ),
                    }
                  : d
              ),
              isGeneratingVariations: false,
            });
          } else {
            set({ isGeneratingVariations: false, error: response.error || 'Polish failed' });
          }
        } catch (error) {
          set({
            isGeneratingVariations: false,
            error: (error as Error).message,
          });
        }
      },

      polishDraftVariations: async (draftId) => {
        const { draftPrompts } = get();
        const draft = draftPrompts.find((d) => d.id === draftId);
        if (!draft || draft.variations.length === 0) return;

        set({ isGeneratingVariations: true });

        try {
          const response = await api.polishPrompts({
            base_prompt: draft.basePrompt,
            variations: draft.variations.map((v) => ({
              id: v.id,
              text: v.text,
              user_notes: v.userNotes,
              mood: v.mood,
              design: v.design,
              emphasized_tags: v.emphasizedTags,
            })),
            context_image_ids: draft.contextImageIds,
          });

          if (response.success) {
            // Build a map of polished results
            const polishedMap = new Map(
              response.polished_variations.map((p) => [p.id, p])
            );

            set({
              draftPrompts: get().draftPrompts.map((d) =>
                d.id === draftId
                  ? {
                      ...d,
                      variations: d.variations.map((v) => {
                        const polished = polishedMap.get(v.id);
                        return polished
                          ? { ...v, text: polished.text, userNotes: '', isEdited: false }
                          : v;
                      }),
                    }
                  : d
              ),
              isGeneratingVariations: false,
            });
          } else {
            set({ isGeneratingVariations: false, error: response.error || 'Polish failed' });
          }
        } catch (error) {
          set({
            isGeneratingVariations: false,
            error: (error as Error).message,
          });
        }
      },

      generateFromDraft: async (draftId) => {
        const { draftPrompts, currentSessionId, generatingImageDraftIds, contextAnnotationOverrides, generations } = get();
        const draft = draftPrompts.find((d) => d.id === draftId);
        if (!draft || draft.variations.length === 0) return;

        // Add to generating set (allows concurrent batch generation)
        // Note: Don't add to pendingGenerations - the draft itself shows generating state
        const newGeneratingIds = new Set(generatingImageDraftIds);
        newGeneratingIds.add(draftId);

        set({
          generatingImageDraftIds: newGeneratingIds,
          isGenerating: true, // Keep for backwards compat
          error: null
        });

        // Store original annotations for images with overrides (for restoration after generation)
        const originalAnnotations: Record<string, { notes: string; annotation: string }> = {};

        // Helper to find image by ID
        const findImage = (imageId: string) => {
          for (const g of generations) {
            const img = g.images.find((i) => i.id === imageId);
            if (img) return img;
          }
          return null;
        };

        try {
          // Apply annotation overrides temporarily for context images in this draft
          const contextIds = draft.contextImageIds || [];
          for (const [imageId, override] of Object.entries(contextAnnotationOverrides)) {
            if (contextIds.includes(imageId)) {
              const img = findImage(imageId);
              if (img) {
                originalAnnotations[imageId] = {
                  notes: img.notes || '',
                  annotation: img.annotation || '',
                };
                await api.updateImageNotes(imageId, img.notes || '', override);
              }
            }
          }

          const response = await api.generateFromPrompts({
            title: draft.title,
            prompts: draft.variations.map((v) => ({
              text: v.text,
              title: v.title,  // Pass variation title for display
              mood: v.mood,
              design: v.design,
              design_dimensions: v.design_dimensions,  // Pass dimensions for storage on images
              // Include per-variation context for targeted image generation
              recommended_context_ids: v.recommended_context_ids,
            })),
            context_image_ids: draft.contextImageIds,
            session_id: currentSessionId || undefined,
            base_prompt: draft.basePrompt, // Pass original base prompt
            ...draft.imageParams,
          });

          // Remove from generating set and delete the draft
          const updatedGeneratingIds = new Set(get().generatingImageDraftIds);
          updatedGeneratingIds.delete(draftId);

          set({
            draftPrompts: get().draftPrompts.filter((d) => d.id !== draftId),
            currentDraftId: null,
            generatingImageDraftIds: updatedGeneratingIds,
            isGenerating: updatedGeneratingIds.size > 0, // Derive from set
            contextAnnotationOverrides: {}, // Clear overrides after successful generation
          });

          await get().refreshGenerations();

          // Show toast notification instead of auto-navigating (background generation)
          const generationTitle = draft.title || 'Untitled';
          toast.success(`"${generationTitle}" finished generating`, {
            label: 'View',
            onClick: () => {
              set({
                currentGenerationId: response.prompt_id,
                currentImageIndex: 0,
                currentDraftId: null,
              });
            },
          });

          // Clear context but don't navigate
          set({
            contextImageIds: [],
          });
        } catch (error) {
          // Remove from generating set on error
          const updatedGeneratingIds = new Set(get().generatingImageDraftIds);
          updatedGeneratingIds.delete(draftId);

          set({
            generatingImageDraftIds: updatedGeneratingIds,
            isGenerating: updatedGeneratingIds.size > 0,
            error: (error as Error).message,
          });

          // Show error toast
          toast.error(`Generation failed: ${(error as Error).message}`);
        } finally {
          // Restore original annotations
          for (const [imageId, original] of Object.entries(originalAnnotations)) {
            try {
              await api.updateImageNotes(imageId, original.notes, original.annotation);
            } catch {
              // Silently ignore restoration errors
            }
          }
          // Refresh to sync state with backend after restoration
          if (Object.keys(originalAnnotations).length > 0) {
            await get().refreshData();
          }
        }
      },

      deleteDraft: (draftId) => {
        const { draftPrompts, currentDraftId, generations } = get();
        set({
          draftPrompts: draftPrompts.filter((d) => d.id !== draftId),
          currentDraftId: currentDraftId === draftId ? null : currentDraftId,
          // Navigate to first generation if we're viewing the deleted draft
          currentGenerationId:
            currentDraftId === draftId ? generations[0]?.id || null : get().currentGenerationId,
        });
      },

      getCurrentDraft: () => {
        const { draftPrompts, currentDraftId } = get();
        return draftPrompts.find((d) => d.id === currentDraftId) || null;
      },

      // Delete
      deleteImage: async (imageId) => {
        try {
          await api.deleteImage(imageId);
          await get().refreshData();

          // Adjust current index if needed
          const { currentImageIndex } = get();
          const generation = get().getCurrentGeneration();
          if (generation && currentImageIndex >= generation.images.length) {
            set({ currentImageIndex: Math.max(0, generation.images.length - 1) });
          }
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      deleteGeneration: async (generationId) => {
        try {
          await api.deletePrompt(generationId);
          await get().refreshData();

          const { generations, currentGenerationId } = get();
          if (currentGenerationId === generationId) {
            set({ currentGenerationId: generations[0]?.id || null, currentImageIndex: 0 });
          }
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      batchDelete: async () => {
        const { selectedIds } = get();
        if (selectedIds.size === 0) return;

        try {
          await api.batchDelete(Array.from(selectedIds));
          await get().refreshData();
          set({ selectedIds: new Set(), selectionMode: 'none' });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      batchDeleteGenerations: async (generationIds) => {
        if (generationIds.length === 0) return;

        try {
          await api.batchDeletePrompts(generationIds);
          await get().refreshData();

          // Clear selection and navigate if needed
          const { currentGenerationId, generations } = get();
          const newSelectedGenerationIds = new Set<string>();

          // If current generation was deleted, navigate to first remaining
          if (currentGenerationId && generationIds.includes(currentGenerationId)) {
            const remaining = generations.filter((g) => !generationIds.includes(g.id));
            set({
              currentGenerationId: remaining[0]?.id || null,
              currentImageIndex: 0,
              selectedGenerationIds: newSelectedGenerationIds,
            });
          } else {
            set({ selectedGenerationIds: newSelectedGenerationIds });
          }
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      // Generation selection
      toggleGenerationSelection: (id) => {
        const { selectedGenerationIds } = get();
        const newSelected = new Set(selectedGenerationIds);
        if (newSelected.has(id)) {
          newSelected.delete(id);
        } else {
          newSelected.add(id);
        }
        set({ selectedGenerationIds: newSelected });
      },

      selectAllGenerations: () => {
        const { generations, draftPrompts } = get();
        const allIds = [
          ...generations.map((g) => g.id),
          ...draftPrompts.map((d) => d.id),
        ];
        set({ selectedGenerationIds: new Set(allIds) });
      },

      clearGenerationSelection: () => {
        set({ selectedGenerationIds: new Set() });
      },

      // Image notes
      updateImageNotes: async (imageId, notes, annotation) => {
        try {
          await api.updateImageNotes(imageId, notes, annotation);

          // Update local state
          const { generations } = get();
          const updatedGenerations = generations.map((g) => ({
            ...g,
            images: g.images.map((img) =>
              img.id === imageId ? { ...img, notes, annotation: annotation ?? img.annotation } : img
            ),
          }));
          set({ generations: updatedGenerations });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      // Design Tokens
      createToken: async (data) => {
        try {
          // Check if a token with the same name already exists
          const existingTokens = get().designTokens;
          const duplicate = existingTokens.find(
            (t) => t.name.toLowerCase() === data.name.toLowerCase()
          );
          if (duplicate) {
            throw new Error(`Token "${data.name}" already exists`);
          }

          const token = await api.createToken(data);
          // Refresh both tokens and generations (concept images create Generation entries)
          const [designTokens, generations] = await Promise.all([
            api.fetchTokens(),
            api.fetchPrompts(),
          ]);
          set({ designTokens, generations });
          return token;
        } catch (error) {
          set({ error: (error as Error).message });
          return undefined;
        }
      },

      deleteToken: async (id) => {
        try {
          await api.deleteToken(id);
          // Refresh both tokens and generations since deleting a token
          // also deletes its concept prompt (bidirectional sync)
          await get().refreshData();
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      useToken: async (id) => {
        try {
          const token = await api.useToken(id);
          const designTokens = await api.fetchTokens();
          set({ designTokens });
          return token;
        } catch (error) {
          set({ error: (error as Error).message });
          return undefined;
        }
      },

      suggestDimensions: async (imageIds) => {
        try {
          const response = await api.suggestDimensions(imageIds);
          if (response.success) {
            return response.dimensions;
          } else {
            set({ error: response.error || 'Failed to suggest dimensions' });
            return [];
          }
        } catch (error) {
          set({ error: (error as Error).message });
          return [];
        }
      },

      generateTokenConcept: async (tokenId) => {
        // Add to pending set
        const newPending = new Set(get().pendingConceptGenerations);
        newPending.add(tokenId);
        set({ pendingConceptGenerations: newPending });

        try {
          await api.generateTokenConcept(tokenId);
          // Refresh both tokens and generations (concept images create Generation entries)
          const [designTokens, generations] = await Promise.all([
            api.fetchTokens(),
            api.fetchPrompts(),
          ]);

          // Remove from pending set
          const updatedPending = new Set(get().pendingConceptGenerations);
          updatedPending.delete(tokenId);
          set({ designTokens, generations, pendingConceptGenerations: updatedPending });
        } catch (error) {
          // Remove from pending set on error
          const updatedPending = new Set(get().pendingConceptGenerations);
          updatedPending.delete(tokenId);
          set({ pendingConceptGenerations: updatedPending, error: (error as Error).message });
        }
      },

      // Collections
      createCollection: async (name, description, imageIds) => {
        // Use provided imageIds, or fall back to selectedIds
        const ids = imageIds ?? Array.from(get().selectedIds);
        if (ids.length === 0) return;

        try {
          await api.createCollection({
            name,
            description,
            image_ids: ids,
          });
          const collections = await api.fetchCollections();
          set({ collections, selectedIds: new Set(), selectionMode: 'none' });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      updateCollection: async (id, data) => {
        try {
          await api.updateCollection(id, data);
          const collections = await api.fetchCollections();
          set({ collections });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      deleteCollection: async (id) => {
        try {
          await api.deleteCollection(id);
          const collections = await api.fetchCollections();
          set({ collections });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      addToCollection: async (collectionId) => {
        const { selectedIds } = get();
        if (selectedIds.size === 0) return;

        try {
          await api.addToCollection(collectionId, Array.from(selectedIds));
          const collections = await api.fetchCollections();
          set({ collections });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      addImagesToCollection: async (collectionId, imageIds) => {
        if (imageIds.length === 0) return;

        try {
          await api.addToCollection(collectionId, imageIds);
          const collections = await api.fetchCollections();
          set({ collections });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      viewCollection: (id) => {
        // Set to view collection mode - clear generation/draft selection
        set({
          currentCollectionId: id,
          currentGenerationId: null,
          currentDraftId: null,
          currentImageIndex: 0,
          leftTab: 'collections',
        });
      },

      setCurrentCollection: (id) => {
        if (id) {
          set({
            currentCollectionId: id,
            currentGenerationId: null,
            currentDraftId: null,
            currentImageIndex: 0,
          });
        } else {
          set({ currentCollectionId: null });
        }
      },

      getCurrentCollection: () => {
        const { collections, currentCollectionId } = get();
        return collections.find((c) => c.id === currentCollectionId) || null;
      },

      getCurrentCollectionImages: () => {
        const { generations, collections, currentCollectionId } = get();
        const collection = collections.find((c) => c.id === currentCollectionId);
        if (!collection) return [];

        // Build a map of all images across all generations
        const imageMap = new Map<string, ImageData>();
        for (const generation of generations) {
          for (const image of generation.images) {
            imageMap.set(image.id, image);
          }
        }

        // Return images in collection order
        return collection.image_ids
          .map((id) => imageMap.get(id))
          .filter((img): img is ImageData => img !== undefined);
      },

      getConceptImages: () => {
        const { generations } = get();
        // Get all images from concept generations, sorted newest first
        const conceptGenerations = generations.filter((g) => g.is_concept);
        const images = conceptGenerations.flatMap((generation) => generation.images);
        return images.sort(
          (a, b) =>
            new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime()
        );
      },

      // Library "unread" tracking
      markLibrarySeen: () => {
        set({ lastSeenLibraryAt: new Date().toISOString() });
      },

      getNewTokenCount: () => {
        const { designTokens, lastSeenLibraryAt } = get();
        if (!lastSeenLibraryAt) {
          // First visit - all tokens are "new" but we'll mark them seen
          return designTokens.length > 0 ? designTokens.length : 0;
        }
        const lastSeenTime = new Date(lastSeenLibraryAt).getTime();
        return designTokens.filter(
          (token) => new Date(token.created_at).getTime() > lastSeenTime
        ).length;
      },

      removeFromCollection: async (collectionId, imageId) => {
        try {
          await api.removeFromCollection(collectionId, [imageId]);
          const collections = await api.fetchCollections();
          set({ collections });

          // Adjust current image index if needed
          const { currentCollectionId, currentImageIndex } = get();
          if (currentCollectionId === collectionId) {
            const images = get().getCurrentCollectionImages();
            if (currentImageIndex >= images.length) {
              set({ currentImageIndex: Math.max(0, images.length - 1) });
            }
          }
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      removeFromCurrentCollection: async (imageId) => {
        const { currentCollectionId } = get();
        if (!currentCollectionId) return;
        await get().removeFromCollection(currentCollectionId, imageId);
      },

      // Settings
      updateSettings: async (settingsUpdate) => {
        try {
          await api.updateSettings(settingsUpdate);
          // Refresh settings to get the updated values
          const settings = await api.fetchSettings();
          set({ settings });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      // Upload
      uploadImages: async (files) => {
        set({ isGenerating: true, error: null });

        try {
          const response = await api.uploadImages(files);
          await get().refreshData();

          set({
            currentGenerationId: response.prompt_id,
            currentImageIndex: 0,
            isGenerating: false,
          });
        } catch (error) {
          set({ isGenerating: false, error: (error as Error).message });
        }
      },

      // Sessions (server-side)
      createSession: async (name) => {
        try {
          const session = await api.createSession({ name, notes: '' });
          const newSession: Session = {
            id: session.id,
            name: session.name,
            notes: session.notes,
            created_at: session.created_at,
          };

          set((state) => ({
            sessions: [newSession, ...state.sessions],
            currentSessionId: session.id,
            notes: '',
          }));
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      switchSession: async (id) => {
        const { currentSessionId, notes } = get();

        // Save current session notes to server if needed
        if (currentSessionId && notes) {
          try {
            await api.updateSession(currentSessionId, { notes });
          } catch {
            // Ignore errors when saving notes
          }
        }

        // Switch to new session and filter generations
        set({ currentSessionId: id });

        // Refresh data with session filter
        try {
          const generations = id ? await api.fetchPromptsForSession(id) : await api.fetchPrompts();
          const session = get().sessions.find((s) => s.id === id);
          set({
            generations,
            notes: session?.notes || '',
            currentGenerationId: generations[0]?.id || null,
            currentImageIndex: 0,
          });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      deleteSession: async (id) => {
        try {
          await api.deleteSession(id, false); // Don't delete generations, just clear session_id

          const { sessions, currentSessionId } = get();
          const newSessions = sessions.filter((s) => s.id !== id);

          set({
            sessions: newSessions,
            currentSessionId: currentSessionId === id ? null : currentSessionId,
            notes: currentSessionId === id ? '' : get().notes,
          });

          // Refresh generations if we just deleted the current session
          if (currentSessionId === id) {
            const generations = await api.fetchPrompts();
            set({
              generations,
              currentGenerationId: generations[0]?.id || null,
            });
          }
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      updateNotes: async (notes) => {
        set({ notes });

        // Debounced save to server (save on blur in UI instead)
        const { currentSessionId } = get();
        if (currentSessionId) {
          // Update local session immediately
          const { sessions } = get();
          set({
            sessions: sessions.map((s) =>
              s.id === currentSessionId ? { ...s, notes } : s
            ),
          });
        }
      },

      // Design Axis System
      updateDesignTags: async (imageId, tags) => {
        try {
          await api.updateDesignTags(imageId, tags);

          // Update local state
          const { generations } = get();
          const updatedGenerations = generations.map((g) => ({
            ...g,
            images: g.images.map((img) =>
              img.id === imageId ? { ...img, design_tags: tags } : img
            ),
          }));
          set({ generations: updatedGenerations });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      toggleAxisLike: async (imageId, axis, tag, liked) => {
        try {
          await api.toggleAxisLike(imageId, axis, tag, liked);

          // Update local state
          const { generations } = get();
          const updatedGenerations = generations.map((g) => ({
            ...g,
            images: g.images.map((img) => {
              if (img.id !== imageId) return img;

              const currentAxisTags = img.liked_axes?.[axis] || [];
              let newAxisTags: string[];

              if (liked) {
                // Add tag if not present
                newAxisTags = currentAxisTags.includes(tag)
                  ? currentAxisTags
                  : [...currentAxisTags, tag];
              } else {
                // Remove tag
                newAxisTags = currentAxisTags.filter((t) => t !== tag);
              }

              return {
                ...img,
                liked_axes: { ...img.liked_axes, [axis]: newAxisTags },
              };
            }),
          }));
          set({ generations: updatedGenerations });

          // Refresh preferences after toggling
          get().fetchDesignPreferences();
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      fetchDesignPreferences: async () => {
        try {
          const response = await api.fetchDesignPreferences();
          set({
            designPreferences: response.preferences,
            totalRated: response.total_rated,
          });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      resetDesignPreferences: async () => {
        try {
          await api.resetDesignPreferences();
          set({ designPreferences: null, totalRated: 0 });
          // Refresh data to clear liked_axes from images
          await get().refreshData();
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      // Design Dimensions (Rich AI Analysis)
      analyzeDimensions: async (imageId: string) => {
        // Add to pending analysis
        const pendingAnalysis = new Set(get().pendingAnalysis);
        pendingAnalysis.add(imageId);
        set({ pendingAnalysis });

        try {
          const response = await api.analyzeDimensions(imageId);
          if (!response.success) {
            throw new Error(response.error || 'Analysis failed');
          }

          // Return the dimensions for UI to handle
          return response.dimensions;
        } catch (error) {
          set({ error: (error as Error).message });
          return [];
        } finally {
          // Remove from pending analysis
          const updated = new Set(get().pendingAnalysis);
          updated.delete(imageId);
          set({ pendingAnalysis: updated });
        }
      },

      confirmDimension: async (imageId: string, axis: string) => {
        // Get current image to find its dimensions
        const { generations } = get();
        let currentDimensions: Record<string, DesignDimension> = {};

        for (const generation of generations) {
          const img = generation.images.find((i) => i.id === imageId);
          if (img?.design_dimensions) {
            currentDimensions = img.design_dimensions;
            break;
          }
        }

        if (!currentDimensions[axis]) {
          return; // No dimension to confirm
        }

        try {
          await api.confirmDimension(imageId, axis, currentDimensions);
          // Refresh data to get updated dimensions
          await get().refreshData();
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      updateImageDimensions: async (imageId: string, dimensions: Record<string, DesignDimension>) => {
        try {
          await api.updateImageDimensions(imageId, dimensions);
          // Refresh data to get updated dimensions
          await get().refreshData();
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      toggleDimensionLike: async (imageId, axis, liked) => {
        // Optimistic update - update UI immediately
        const { generations } = get();
        const updatedGenerations = generations.map((g) => ({
          ...g,
          images: g.images.map((img) => {
            if (img.id !== imageId) return img;

            const currentLikedAxes = img.liked_dimension_axes || [];
            let newLikedAxes: string[];

            if (liked) {
              newLikedAxes = currentLikedAxes.includes(axis)
                ? currentLikedAxes
                : [...currentLikedAxes, axis];
            } else {
              newLikedAxes = currentLikedAxes.filter((a) => a !== axis);
            }

            return {
              ...img,
              liked_dimension_axes: newLikedAxes,
            };
          }),
        }));
        set({ generations: updatedGenerations });

        // Persist to backend
        try {
          await api.toggleDimensionLike(imageId, axis, liked);
        } catch (error) {
          // Ignore 404/Not Found - image missing from metadata is expected for old images
          const msg = (error as Error).message || '';
          if (!msg.includes('404') && !msg.includes('Not Found')) {
            set({ error: msg });
          }
        }
      },

      // Token Extraction Dialog actions
      openExtractionDialog: async (imageIds: string[]) => {
        const imageCount = imageIds.length;

        // For single image: check if it has pre-computed dimensions
        if (imageCount === 1) {
          const { generations } = get();
          let precomputedDimensions: DesignDimension[] | null = null;

          for (const generation of generations) {
            const img = generation.images.find((i) => i.id === imageIds[0]);
            if (img?.design_dimensions) {
              // Convert Record<string, DesignDimension> to array
              precomputedDimensions = Object.values(img.design_dimensions);
              break;
            }
          }

          if (precomputedDimensions && precomputedDimensions.length > 0) {
            // Use pre-computed dimensions - open dialog immediately
            set({
              extractionDialog: {
                isOpen: true,
                isExtracting: false,
                imageIds,
                suggestedDimensions: precomputedDimensions,
                selectedDimensionIndex: null,
              },
            });
            return;
          }
        }

        // Multiple images OR no pre-computed: call API for analysis
        toast.info(`Analyzing ${imageCount} image${imageCount !== 1 ? 's' : ''} for design dimensions...`);

        // Store imageIds for when dialog opens later
        set({
          extractionDialog: {
            isOpen: false,  // Don't open yet - background processing
            isExtracting: true,
            imageIds,
            suggestedDimensions: [],
            selectedDimensionIndex: null,
          },
        });

        try {
          const response = await api.suggestDimensions(imageIds);
          if (response.success && response.dimensions.length > 0) {
            // Store results
            set({
              extractionDialog: {
                ...get().extractionDialog,
                isExtracting: false,
                suggestedDimensions: response.dimensions,
              },
            });

            // Show success toast with "View" action
            const count = response.dimensions.length;
            toast.success(
              `Found ${count} design dimension${count !== 1 ? 's' : ''}`,
              {
                label: 'View',
                onClick: () => {
                  // Open dialog with pre-loaded results
                  set({
                    extractionDialog: {
                      ...get().extractionDialog,
                      isOpen: true,
                    },
                  });
                },
              }
            );
          } else {
            set({
              extractionDialog: {
                ...get().extractionDialog,
                isExtracting: false,
              },
            });
            toast.error('No design dimensions found. Try different images.');
          }
        } catch (error) {
          set({
            extractionDialog: {
              ...get().extractionDialog,
              isExtracting: false,
            },
          });
          toast.error(`Analysis failed: ${(error as Error).message}`);
        }
      },

      closeExtractionDialog: () => {
        set({
          extractionDialog: {
            isOpen: false,
            isExtracting: false,
            imageIds: [],
            suggestedDimensions: [],
            selectedDimensionIndex: null,
          },
        });
      },

      selectExtractionDimension: (index: number | null) => {
        set({
          extractionDialog: {
            ...get().extractionDialog,
            selectedDimensionIndex: index,
          },
        });
      },

      createTokenFromExtraction: async () => {
        const { extractionDialog, createToken, clearSelection, setSelectionMode } = get();
        const { selectedDimensionIndex, suggestedDimensions, imageIds } = extractionDialog;

        if (selectedDimensionIndex === null || !suggestedDimensions[selectedDimensionIndex]) return;

        const dimension = suggestedDimensions[selectedDimensionIndex];

        set({
          extractionDialog: {
            ...extractionDialog,
            isExtracting: true,
          },
        });

        try {
          const token = await createToken({
            name: dimension.name,
            description: dimension.description,
            image_ids: imageIds,
            prompts: [dimension.generation_prompt],
            creation_method: 'ai-extraction',
            dimension,
            generate_concept: true,
            category: dimension.axis,
            tags: dimension.tags,
          });

          if (token) {
            // Success - close dialog and clear selection
            get().closeExtractionDialog();
            clearSelection();
            setSelectionMode('none');
          }
        } finally {
          set({
            extractionDialog: {
              ...get().extractionDialog,
              isExtracting: false,
            },
          });
        }
      },

      // Error handling
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),

      // Helpers
      getCurrentGeneration: () => {
        const { generations, currentGenerationId } = get();
        return generations.find((g) => g.id === currentGenerationId) || null;
      },

      getCurrentImage: () => {
        const { generationFilter, currentGenerationId, currentCollectionId, currentImageIndex } = get();
        const generation = get().getCurrentGeneration();
        const collectionImages = get().getCurrentCollectionImages();
        const conceptImages = get().getConceptImages();
        const isViewingConcepts = generationFilter === 'concepts' && !currentGenerationId && !currentCollectionId;
        const images = isViewingConcepts ? conceptImages : (generation?.images || collectionImages);
        return images[currentImageIndex] || null;
      },

      getAllImages: () => {
        const { generations } = get();
        const result: { image: ImageData; generationId: string; generationTitle: string }[] = [];

        generations.forEach((g) => {
          g.images.forEach((img) => {
            result.push({ image: img, generationId: g.id, generationTitle: g.title });
          });
        });

        return result;
      },
    }),
    {
      name: 'pageant-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        currentSessionId: state.currentSessionId,
        notes: state.notes,
        // Persist variations workflow state to survive page refresh
        promptVariations: state.promptVariations,
        variationsBasePrompt: state.variationsBasePrompt,
        variationsTitle: state.variationsTitle,
        showPromptPreview: state.showPromptPreview,
        variationsImageParams: state.variationsImageParams,
        // Persist draft prompts
        draftPrompts: state.draftPrompts,
        currentDraftId: state.currentDraftId,
        // Persist library "unread" tracking
        lastSeenLibraryAt: state.lastSeenLibraryAt,
      }),
    }
  )
);
