import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Prompt,
  Collection,
  Story,
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
  LibraryItem,
  LibraryItemType,
  PromptVariation,
  ImageGenerationParams,
  DraftPrompt,
} from '../types';
import * as api from '../api';

interface PendingPrompt {
  title?: string;  // Optional - will be auto-generated if not provided
  count: number;
}

interface AppStore {
  // Data
  prompts: Prompt[];
  favorites: string[];
  libraryItems: LibraryItem[];
  collections: Collection[];
  stories: Story[];
  settings: Settings | null;

  // Navigation
  currentPromptId: string | null;
  currentImageIndex: number;
  viewMode: ViewMode;
  leftTab: LeftTab;
  rightTab: RightTab;

  // Selection
  selectionMode: SelectionMode;
  selectedIds: Set<string>;
  contextImageIds: string[];

  // UI State
  isGenerating: boolean;
  pendingPrompts: Map<string, PendingPrompt>;
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

  // Actions
  initialize: () => Promise<void>;
  refreshData: () => Promise<void>;

  // Prompt navigation
  setCurrentPrompt: (id: string | null) => void;
  setCurrentImageIndex: (index: number) => void;
  nextImage: () => void;
  prevImage: () => void;

  // View modes
  setViewMode: (mode: ViewMode) => void;
  setLeftTab: (tab: LeftTab) => void;
  setRightTab: (tab: RightTab) => void;

  // Selection
  setSelectionMode: (mode: SelectionMode) => void;
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;

  // Context images
  setContextImages: (ids: string[]) => void;
  addContextImage: (id: string) => void;
  addContextImages: (ids: string[]) => void;
  removeContextImage: (id: string) => void;
  clearContextImages: () => void;

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
  duplicateDraftVariation: (draftId: string, variationId: string) => void;
  regenerateDraftVariation: (draftId: string, variationId: string) => Promise<void>;
  addMoreDraftVariations: (draftId: string, count?: number) => Promise<void>;
  polishDraftVariation: (draftId: string, variationId: string) => Promise<void>;
  polishDraftVariations: (draftId: string) => Promise<void>;
  generateFromDraft: (draftId: string) => Promise<void>;
  deleteDraft: (draftId: string) => void;
  getCurrentDraft: () => DraftPrompt | null;

  // Favorites (Collection-based)
  ensureFavoritesCollection: () => Promise<string>;  // Returns collection ID
  toggleFavorite: (imageId: string) => Promise<void>;
  batchFavorite: (favorite: boolean) => Promise<void>;
  isInFavoritesCollection: (imageId: string) => boolean;

  // Delete
  deleteImage: (imageId: string) => Promise<void>;
  deletePrompt: (promptId: string) => Promise<void>;
  batchDelete: () => Promise<void>;
  batchDeletePrompts: (promptIds: string[]) => Promise<void>;

  // Prompt selection (for bulk operations)
  selectedPromptIds: Set<string>;
  togglePromptSelection: (id: string) => void;
  selectAllPrompts: () => void;
  clearPromptSelection: () => void;

  // Image notes
  updateImageNotes: (imageId: string, notes: string, annotation?: string) => Promise<void>;

  // Design Library
  createLibraryItem: (data: {
    type: LibraryItemType;
    name: string;
    description?: string;
    text?: string;
    style_tags?: string[];
    prompt?: string;
    category?: string;
    tags?: string[];
  }) => Promise<void>;
  deleteLibraryItem: (id: string) => Promise<void>;
  useLibraryItem: (id: string) => Promise<LibraryItem | undefined>;
  extractDesignToken: (imageId: string, annotation?: string, likedTags?: string[]) => Promise<LibraryItem | undefined>;

  // Collections
  createCollection: (name: string, description?: string) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  addToCollection: (collectionId: string) => Promise<void>;
  viewCollection: (id: string) => void;
  setCurrentCollection: (id: string | null) => void;
  getCurrentCollection: () => Collection | null;
  getCurrentCollectionImages: () => ImageData[];
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
  generateConcept: (imageId: string, dimension: DesignDimension) => Promise<void>;
  confirmDimension: (imageId: string, axis: string) => Promise<void>;
  updateImageDimensions: (imageId: string, dimensions: Record<string, DesignDimension>) => Promise<void>;

  // Error handling
  setError: (error: string | null) => void;
  clearError: () => void;

  // Helpers
  getCurrentPrompt: () => Prompt | null;
  getCurrentImage: () => ImageData | null;
  getAllImages: () => { image: ImageData; promptId: string; promptTitle: string }[];
  getFavoriteImages: () => { image: ImageData; promptId: string; promptTitle: string }[];
  isImageFavorite: (imageId: string) => boolean;
}

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Initial state
      prompts: [],
      favorites: [],
      libraryItems: [],
      collections: [],
      stories: [],
      settings: null,

      currentPromptId: null,
      currentImageIndex: 0,
      viewMode: 'single',
      leftTab: 'prompts',
      rightTab: 'generate',

      selectionMode: 'none',
      selectedIds: new Set(),
      contextImageIds: [],

      isGenerating: false,
      pendingPrompts: new Map(),
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

      // Prompt selection for bulk operations
      selectedPromptIds: new Set(),

      // Design Axis System
      designPreferences: null,
      totalRated: 0,

      // Design Dimensions (Rich AI Analysis)
      pendingAnalysis: new Set<string>(),

      // Initialize app
      initialize: async () => {
        try {
          const [prompts, libraryItems, collections, settings, sessions] = await Promise.all([
            api.fetchPrompts(),
            api.fetchLibraryItems(),
            api.fetchCollections(),
            api.fetchSettings(),
            api.fetchSessions(),
          ]);

          const favResponse = await api.fetchFavorites();
          const favoriteIds = favResponse.map((f) => f.id);

          // Convert SessionData to Session type
          const sessionsTyped: Session[] = sessions.map((s) => ({
            id: s.id,
            name: s.name,
            notes: s.notes,
            created_at: s.created_at,
          }));

          set({
            prompts,
            libraryItems,
            collections,
            settings,
            favorites: favoriteIds,
            sessions: sessionsTyped,
            currentPromptId: prompts[0]?.id || null,
          });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      refreshData: async () => {
        try {
          const [prompts, libraryItems, collections] = await Promise.all([
            api.fetchPrompts(),
            api.fetchLibraryItems(),
            api.fetchCollections(),
          ]);

          const favResponse = await api.fetchFavorites();
          const favoriteIds = favResponse.map((f) => f.id);

          set({ prompts, libraryItems, collections, favorites: favoriteIds });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      // Prompt navigation
      setCurrentPrompt: (id) => {
        set({ currentPromptId: id, currentImageIndex: 0, currentCollectionId: null });
      },

      setCurrentImageIndex: (index) => {
        const prompt = get().getCurrentPrompt();
        const collectionImages = get().getCurrentCollectionImages();
        const images = prompt?.images || collectionImages;
        if (images.length > 0 && index >= 0 && index < images.length) {
          set({ currentImageIndex: index });
        }
      },

      nextImage: () => {
        const { currentImageIndex } = get();
        const prompt = get().getCurrentPrompt();
        const collectionImages = get().getCurrentCollectionImages();
        const images = prompt?.images || collectionImages;
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
        const prompt = get().getCurrentPrompt();
        const collectionImages = get().getCurrentCollectionImages();
        const images = prompt?.images || collectionImages;
        if (images.length > 0) {
          set({ selectedIds: new Set(images.map((img) => img.id)) });
        }
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
        set({ contextImageIds: get().contextImageIds.filter((i) => i !== id) });
      },
      clearContextImages: () => set({ contextImageIds: [] }),

      // Generation (supports concurrent generations)
      generate: async ({ prompt, title, count, image_size, aspect_ratio, seed, safety_level }) => {
        const { contextImageIds, pendingPrompts, currentSessionId } = get();

        // Create pending prompt
        const tempId = `pending-${Date.now()}`;
        const newPending = new Map(pendingPrompts);
        newPending.set(tempId, { title, count: count || 4 });

        // isGenerating is true if any pending prompts exist
        set({ isGenerating: true, pendingPrompts: newPending, error: null });

        try {
          const response = await api.generateImages({
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

          // Remove this pending prompt
          const updatedPending = new Map(get().pendingPrompts);
          updatedPending.delete(tempId);

          await get().refreshData();

          // Navigate to new prompt, derive isGenerating from pending count
          set({
            currentPromptId: response.prompt_id,
            currentImageIndex: 0,
            isGenerating: updatedPending.size > 0,
            pendingPrompts: updatedPending,
            contextImageIds: [],
          });
        } catch (error) {
          const updatedPending = new Map(get().pendingPrompts);
          updatedPending.delete(tempId);
          set({
            isGenerating: updatedPending.size > 0,
            pendingPrompts: updatedPending,
            error: (error as Error).message,
          });
        }
      },

      iterate: async (imageId) => {
        set({ isGenerating: true, error: null });

        try {
          const response = await api.iterateImage(imageId);
          await get().refreshData();

          set({
            currentPromptId: response.prompt_id,
            currentImageIndex: 0,
            isGenerating: false,
          });
        } catch (error) {
          set({ isGenerating: false, error: (error as Error).message });
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
          currentPromptId: null, // Clear current prompt to show draft view
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
            // Mark this draft as no longer generating on error
            set({
              draftPrompts: get().draftPrompts.map((d) =>
                d.id === draftId ? { ...d, isGenerating: false } : d
              ),
              isGeneratingVariations: false,
              streamingText: '',
              error: response.error || 'Failed to generate variations',
            });
          }
        } catch (error) {
          // Mark this draft as no longer generating on error
          set({
            draftPrompts: get().draftPrompts.map((d) =>
              d.id === draftId ? { ...d, isGenerating: false } : d
            ),
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
            })),
            context_image_ids: contextImageIds.length > 0 ? contextImageIds : undefined,
            session_id: currentSessionId || undefined,
            base_prompt: variationsBasePrompt, // Pass original base prompt
            ...variationsImageParams,
          });

          // Clear variations and refresh
          set({
            promptVariations: [],
            variationsBasePrompt: '',
            variationsTitle: '',
            variationsImageParams: {},
            streamingText: '',
          });

          await get().refreshData();

          set({
            currentPromptId: response.prompt_id,
            currentImageIndex: 0,
            isGenerating: false,
            contextImageIds: [],
          });
        } catch (error) {
          set({
            isGenerating: false,
            error: (error as Error).message,
          });
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
          set({ currentDraftId: id, currentPromptId: null });
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
        const { draftPrompts, currentSessionId, generatingImageDraftIds } = get();
        const draft = draftPrompts.find((d) => d.id === draftId);
        if (!draft || draft.variations.length === 0) return;

        // Add to generating set (allows concurrent batch generation)
        const newGeneratingIds = new Set(generatingImageDraftIds);
        newGeneratingIds.add(draftId);
        set({
          generatingImageDraftIds: newGeneratingIds,
          isGenerating: true, // Keep for backwards compat
          error: null
        });

        try {
          const response = await api.generateFromPrompts({
            title: draft.title,
            prompts: draft.variations.map((v) => ({
              text: v.text,
              mood: v.mood,
              design: v.design,
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
          });

          await get().refreshData();

          // Navigate to newly created prompt
          set({
            currentPromptId: response.prompt_id,
            currentImageIndex: 0,
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
        }
      },

      deleteDraft: (draftId) => {
        const { draftPrompts, currentDraftId, prompts } = get();
        set({
          draftPrompts: draftPrompts.filter((d) => d.id !== draftId),
          currentDraftId: currentDraftId === draftId ? null : currentDraftId,
          // Navigate to first prompt if we're viewing the deleted draft
          currentPromptId:
            currentDraftId === draftId ? prompts[0]?.id || null : get().currentPromptId,
        });
      },

      getCurrentDraft: () => {
        const { draftPrompts, currentDraftId } = get();
        return draftPrompts.find((d) => d.id === currentDraftId) || null;
      },

      // Favorites (Collection-based)
      ensureFavoritesCollection: async () => {
        const FAVORITES_COLLECTION_NAME = '⭐ Favorites';
        const { collections } = get();

        // Check if Favorites collection already exists
        let favCollection = collections.find((c) => c.name === FAVORITES_COLLECTION_NAME);

        if (!favCollection) {
          // Create the Favorites collection
          try {
            await api.createCollection({
              name: FAVORITES_COLLECTION_NAME,
              description: 'Your favorite images',
              image_ids: [],
            });
            const updatedCollections = await api.fetchCollections();
            set({ collections: updatedCollections });
            favCollection = updatedCollections.find((c) => c.name === FAVORITES_COLLECTION_NAME);
          } catch (error) {
            set({ error: (error as Error).message });
          }
        }

        return favCollection?.id ?? '';
      },

      toggleFavorite: async (imageId) => {
        const FAVORITES_COLLECTION_NAME = '⭐ Favorites';

        try {
          // Ensure Favorites collection exists
          const collectionId = await get().ensureFavoritesCollection();
          if (!collectionId) return;

          const { collections } = get();
          const favCollection = collections.find((c) => c.id === collectionId);

          if (!favCollection) return;

          const isCurrentlyFavorite = favCollection.image_ids.includes(imageId);

          if (isCurrentlyFavorite) {
            // Remove from Favorites collection
            await api.removeFromCollection(collectionId, [imageId]);
          } else {
            // Add to Favorites collection
            await api.addToCollection(collectionId, [imageId]);
          }

          // Refresh collections
          const updatedCollections = await api.fetchCollections();
          set({ collections: updatedCollections });

          // Update legacy favorites array for backwards compatibility
          const newFavCollection = updatedCollections.find((c) => c.name === FAVORITES_COLLECTION_NAME);
          if (newFavCollection) {
            set({ favorites: newFavCollection.image_ids });
          }
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      batchFavorite: async (favorite) => {
        const FAVORITES_COLLECTION_NAME = '⭐ Favorites';
        const { selectedIds } = get();
        if (selectedIds.size === 0) return;

        try {
          // Ensure Favorites collection exists
          const collectionId = await get().ensureFavoritesCollection();
          if (!collectionId) return;

          const imageIds = Array.from(selectedIds);

          if (favorite) {
            await api.addToCollection(collectionId, imageIds);
          } else {
            await api.removeFromCollection(collectionId, imageIds);
          }

          // Refresh collections
          const updatedCollections = await api.fetchCollections();
          set({ collections: updatedCollections });

          // Update legacy favorites array for backwards compatibility
          const newFavCollection = updatedCollections.find((c) => c.name === FAVORITES_COLLECTION_NAME);
          if (newFavCollection) {
            set({ favorites: newFavCollection.image_ids });
          }
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      isInFavoritesCollection: (imageId) => {
        const FAVORITES_COLLECTION_NAME = '⭐ Favorites';
        const { collections } = get();
        const favCollection = collections.find((c) => c.name === FAVORITES_COLLECTION_NAME);
        return favCollection?.image_ids.includes(imageId) ?? false;
      },

      // Delete
      deleteImage: async (imageId) => {
        try {
          await api.deleteImage(imageId);
          await get().refreshData();

          // Adjust current index if needed
          const { currentImageIndex } = get();
          const prompt = get().getCurrentPrompt();
          if (prompt && currentImageIndex >= prompt.images.length) {
            set({ currentImageIndex: Math.max(0, prompt.images.length - 1) });
          }
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      deletePrompt: async (promptId) => {
        try {
          await api.deletePrompt(promptId);
          await get().refreshData();

          const { prompts, currentPromptId } = get();
          if (currentPromptId === promptId) {
            set({ currentPromptId: prompts[0]?.id || null, currentImageIndex: 0 });
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

      batchDeletePrompts: async (promptIds) => {
        if (promptIds.length === 0) return;

        try {
          await api.batchDeletePrompts(promptIds);
          await get().refreshData();

          // Clear selection and navigate if needed
          const { currentPromptId, prompts } = get();
          const newSelectedPromptIds = new Set<string>();

          // If current prompt was deleted, navigate to first remaining
          if (currentPromptId && promptIds.includes(currentPromptId)) {
            const remaining = prompts.filter((p) => !promptIds.includes(p.id));
            set({
              currentPromptId: remaining[0]?.id || null,
              currentImageIndex: 0,
              selectedPromptIds: newSelectedPromptIds,
            });
          } else {
            set({ selectedPromptIds: newSelectedPromptIds });
          }
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      // Prompt selection
      togglePromptSelection: (id) => {
        const { selectedPromptIds } = get();
        const newSelected = new Set(selectedPromptIds);
        if (newSelected.has(id)) {
          newSelected.delete(id);
        } else {
          newSelected.add(id);
        }
        set({ selectedPromptIds: newSelected });
      },

      selectAllPrompts: () => {
        const { prompts } = get();
        set({ selectedPromptIds: new Set(prompts.map((p) => p.id)) });
      },

      clearPromptSelection: () => {
        set({ selectedPromptIds: new Set() });
      },

      // Image notes
      updateImageNotes: async (imageId, notes, annotation) => {
        try {
          await api.updateImageNotes(imageId, notes, annotation);

          // Update local state
          const { prompts } = get();
          const updatedPrompts = prompts.map((p) => ({
            ...p,
            images: p.images.map((img) =>
              img.id === imageId ? { ...img, notes, annotation: annotation ?? img.annotation } : img
            ),
          }));
          set({ prompts: updatedPrompts });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      // Design Library
      createLibraryItem: async (data) => {
        try {
          await api.createLibraryItem(data);
          const libraryItems = await api.fetchLibraryItems();
          set({ libraryItems });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      deleteLibraryItem: async (id) => {
        try {
          await api.deleteLibraryItem(id);
          const libraryItems = await api.fetchLibraryItems();
          set({ libraryItems });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      useLibraryItem: async (id) => {
        try {
          const item = await api.useLibraryItem(id);
          const libraryItems = await api.fetchLibraryItems();
          set({ libraryItems });
          return item;
        } catch (error) {
          set({ error: (error as Error).message });
          return undefined;
        }
      },

      extractDesignToken: async (imageId, annotation, likedTags) => {
        try {
          const response = await api.extractDesignToken({
            image_id: imageId,
            annotation,
            liked_tags: likedTags,
          });
          if (response.success && response.item) {
            const libraryItems = await api.fetchLibraryItems();
            set({ libraryItems });
            return response.item;
          } else {
            set({ error: response.error || 'Failed to extract design token' });
            return undefined;
          }
        } catch (error) {
          set({ error: (error as Error).message });
          return undefined;
        }
      },

      // Collections
      createCollection: async (name, description) => {
        const { selectedIds } = get();
        if (selectedIds.size === 0) return;

        try {
          await api.createCollection({
            name,
            description,
            image_ids: Array.from(selectedIds),
          });
          const collections = await api.fetchCollections();
          set({ collections, selectedIds: new Set(), selectionMode: 'none' });
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

      viewCollection: (id) => {
        // Set to view collection mode - clear prompt/draft selection
        set({
          currentCollectionId: id,
          currentPromptId: null,
          currentDraftId: null,
          currentImageIndex: 0,
          leftTab: 'collections',
        });
      },

      setCurrentCollection: (id) => {
        if (id) {
          set({
            currentCollectionId: id,
            currentPromptId: null,
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
        const { prompts, collections, currentCollectionId } = get();
        const collection = collections.find((c) => c.id === currentCollectionId);
        if (!collection) return [];

        // Build a map of all images across all prompts
        const imageMap = new Map<string, ImageData>();
        for (const prompt of prompts) {
          for (const image of prompt.images) {
            imageMap.set(image.id, image);
          }
        }

        // Return images in collection order
        return collection.image_ids
          .map((id) => imageMap.get(id))
          .filter((img): img is ImageData => img !== undefined);
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
            currentPromptId: response.prompt_id,
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

        // Switch to new session and filter prompts
        set({ currentSessionId: id });

        // Refresh data with session filter
        try {
          const prompts = id ? await api.fetchPromptsForSession(id) : await api.fetchPrompts();
          const session = get().sessions.find((s) => s.id === id);
          set({
            prompts,
            notes: session?.notes || '',
            currentPromptId: prompts[0]?.id || null,
            currentImageIndex: 0,
          });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      deleteSession: async (id) => {
        try {
          await api.deleteSession(id, false); // Don't delete prompts, just clear session_id

          const { sessions, currentSessionId } = get();
          const newSessions = sessions.filter((s) => s.id !== id);

          set({
            sessions: newSessions,
            currentSessionId: currentSessionId === id ? null : currentSessionId,
            notes: currentSessionId === id ? '' : get().notes,
          });

          // Refresh prompts if we just deleted the current session
          if (currentSessionId === id) {
            const prompts = await api.fetchPrompts();
            set({
              prompts,
              currentPromptId: prompts[0]?.id || null,
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
          const { prompts } = get();
          const updatedPrompts = prompts.map((p) => ({
            ...p,
            images: p.images.map((img) =>
              img.id === imageId ? { ...img, design_tags: tags } : img
            ),
          }));
          set({ prompts: updatedPrompts });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      toggleAxisLike: async (imageId, axis, tag, liked) => {
        try {
          await api.toggleAxisLike(imageId, axis, tag, liked);

          // Update local state
          const { prompts } = get();
          const updatedPrompts = prompts.map((p) => ({
            ...p,
            images: p.images.map((img) => {
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
          set({ prompts: updatedPrompts });

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

      generateConcept: async (imageId: string, dimension: DesignDimension) => {
        // Use existing pendingPrompts pattern for async generation
        const tempId = `concept-${Date.now()}`;
        const newPending = new Map(get().pendingPrompts);
        newPending.set(tempId, { title: `Concept: ${dimension.name}`, count: 1 });
        set({ isGenerating: true, pendingPrompts: newPending });

        try {
          const response = await api.generateConcept(imageId, dimension);
          if (!response.success) {
            throw new Error(response.error || 'Concept generation failed');
          }

          // Refresh data to get the new concept prompt
          await get().refreshData();

          // Navigate to the new concept prompt
          if (response.prompt_id) {
            set({ currentPromptId: response.prompt_id, currentImageIndex: 0 });
          }
        } catch (error) {
          set({ error: (error as Error).message });
        } finally {
          const updatedPending = new Map(get().pendingPrompts);
          updatedPending.delete(tempId);
          set({
            isGenerating: updatedPending.size > 0,
            pendingPrompts: updatedPending,
          });
        }
      },

      confirmDimension: async (imageId: string, axis: string) => {
        // Get current image to find its dimensions
        const { prompts } = get();
        let currentDimensions: Record<string, DesignDimension> = {};

        for (const prompt of prompts) {
          const img = prompt.images.find((i) => i.id === imageId);
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

      // Error handling
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),

      // Helpers
      getCurrentPrompt: () => {
        const { prompts, currentPromptId } = get();
        return prompts.find((p) => p.id === currentPromptId) || null;
      },

      getCurrentImage: () => {
        const prompt = get().getCurrentPrompt();
        const { currentImageIndex } = get();
        return prompt?.images[currentImageIndex] || null;
      },

      getAllImages: () => {
        const { prompts } = get();
        const result: { image: ImageData; promptId: string; promptTitle: string }[] = [];

        prompts.forEach((p) => {
          p.images.forEach((img) => {
            result.push({ image: img, promptId: p.id, promptTitle: p.title });
          });
        });

        return result;
      },

      getFavoriteImages: () => {
        const FAVORITES_COLLECTION_NAME = '⭐ Favorites';
        const { collections } = get();
        const favCollection = collections.find((c) => c.name === FAVORITES_COLLECTION_NAME);
        const favoriteIds = favCollection?.image_ids ?? [];

        const allImages = get().getAllImages();
        return allImages.filter((item) => favoriteIds.includes(item.image.id));
      },

      isImageFavorite: (imageId) => {
        // Now uses collection-based favorites
        return get().isInFavoritesCollection(imageId);
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
      }),
    }
  )
);
