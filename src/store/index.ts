import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Prompt,
  Template,
  Collection,
  Story,
  Settings,
  Session,
  ViewMode,
  LeftTab,
  RightTab,
  SelectionMode,
  ImageData,
} from '../types';
import * as api from '../api';

interface PendingPrompt {
  title: string;
  count: number;
}

interface AppStore {
  // Data
  prompts: Prompt[];
  favorites: string[];
  templates: Template[];
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
  compareLeftId: string | null;
  compareRightId: string | null;
  contextImageIds: string[];

  // UI State
  isGenerating: boolean;
  pendingPrompts: Map<string, PendingPrompt>;
  error: string | null;

  // Sessions (persisted)
  sessions: Session[];
  currentSessionId: string | null;
  notes: string;

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
  setCompareImages: (leftId: string | null, rightId: string | null) => void;

  // Context images
  setContextImages: (ids: string[]) => void;
  addContextImage: (id: string) => void;
  removeContextImage: (id: string) => void;
  clearContextImages: () => void;

  // Generation
  generate: (params: {
    prompt: string;
    title: string;
    category?: string;
    count?: number;
  }) => Promise<void>;
  iterate: (imageId: string) => Promise<void>;

  // Favorites
  toggleFavorite: (imageId: string) => Promise<void>;
  batchFavorite: (favorite: boolean) => Promise<void>;

  // Delete
  deleteImage: (imageId: string) => Promise<void>;
  deletePrompt: (promptId: string) => Promise<void>;
  batchDelete: () => Promise<void>;

  // Image notes
  updateImageNotes: (imageId: string, notes: string, caption?: string) => Promise<void>;

  // Templates
  createTemplate: (data: { name: string; prompt: string; category: string; tags: string[] }) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  useTemplate: (id: string) => Promise<Template | undefined>;

  // Collections
  createCollection: (name: string, description?: string) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  addToCollection: (collectionId: string) => Promise<void>;
  viewCollection: (id: string) => void;

  // Settings
  updateSettings: (variationPrompt: string) => Promise<void>;

  // Upload
  uploadImages: (files: File[]) => Promise<void>;

  // Sessions
  createSession: (name: string) => void;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  updateNotes: (notes: string) => void;

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
      templates: [],
      collections: [],
      stories: [],
      settings: null,

      currentPromptId: null,
      currentImageIndex: 0,
      viewMode: 'single',
      leftTab: 'prompts',
      rightTab: 'info',

      selectionMode: 'none',
      selectedIds: new Set(),
      compareLeftId: null,
      compareRightId: null,
      contextImageIds: [],

      isGenerating: false,
      pendingPrompts: new Map(),
      error: null,

      sessions: [],
      currentSessionId: null,
      notes: '',

      // Initialize app
      initialize: async () => {
        try {
          const [prompts, templates, collections, settings] = await Promise.all([
            api.fetchPrompts(),
            api.fetchTemplates(),
            api.fetchCollections(),
            api.fetchSettings(),
          ]);

          const favResponse = await api.fetchFavorites();
          const favoriteIds = favResponse.map((f) => f.id);

          set({
            prompts,
            templates,
            collections,
            settings,
            favorites: favoriteIds,
            currentPromptId: prompts[0]?.id || null,
          });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      refreshData: async () => {
        try {
          const [prompts, templates, collections] = await Promise.all([
            api.fetchPrompts(),
            api.fetchTemplates(),
            api.fetchCollections(),
          ]);

          const favResponse = await api.fetchFavorites();
          const favoriteIds = favResponse.map((f) => f.id);

          set({ prompts, templates, collections, favorites: favoriteIds });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      // Prompt navigation
      setCurrentPrompt: (id) => {
        set({ currentPromptId: id, currentImageIndex: 0 });
      },

      setCurrentImageIndex: (index) => {
        const prompt = get().getCurrentPrompt();
        if (prompt && index >= 0 && index < prompt.images.length) {
          set({ currentImageIndex: index });
        }
      },

      nextImage: () => {
        const { currentImageIndex } = get();
        const prompt = get().getCurrentPrompt();
        if (prompt && currentImageIndex < prompt.images.length - 1) {
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
          viewMode: mode === 'batch' ? 'grid' : get().viewMode,
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

        // For compare mode, update compare images
        if (get().viewMode === 'compare') {
          const ids = Array.from(newSelectedIds);
          set({
            selectedIds: newSelectedIds,
            compareLeftId: ids[0] || null,
            compareRightId: ids[1] || null,
          });
        } else {
          set({ selectedIds: newSelectedIds });
        }
      },

      selectAll: () => {
        const prompt = get().getCurrentPrompt();
        if (prompt) {
          set({ selectedIds: new Set(prompt.images.map((img) => img.id)) });
        }
      },

      clearSelection: () => {
        set({ selectedIds: new Set(), compareLeftId: null, compareRightId: null });
      },

      setCompareImages: (leftId, rightId) => {
        set({ compareLeftId: leftId, compareRightId: rightId });
      },

      // Context images
      setContextImages: (ids) => set({ contextImageIds: ids }),
      addContextImage: (id) => {
        const { contextImageIds } = get();
        if (!contextImageIds.includes(id)) {
          set({ contextImageIds: [...contextImageIds, id] });
        }
      },
      removeContextImage: (id) => {
        set({ contextImageIds: get().contextImageIds.filter((i) => i !== id) });
      },
      clearContextImages: () => set({ contextImageIds: [] }),

      // Generation
      generate: async ({ prompt, title, category, count }) => {
        const { contextImageIds, pendingPrompts } = get();

        // Create pending prompt
        const tempId = `pending-${Date.now()}`;
        const newPending = new Map(pendingPrompts);
        newPending.set(tempId, { title, count: count || 4 });

        set({ isGenerating: true, pendingPrompts: newPending, error: null });

        try {
          const response = await api.generateImages({
            prompt,
            title,
            category,
            count,
            context_image_ids: contextImageIds.length > 0 ? contextImageIds : undefined,
          });

          // Remove pending and refresh
          newPending.delete(tempId);
          set({ pendingPrompts: newPending });

          await get().refreshData();

          // Navigate to new prompt
          set({
            currentPromptId: response.prompt_id,
            currentImageIndex: 0,
            isGenerating: false,
            contextImageIds: [],
          });
        } catch (error) {
          newPending.delete(tempId);
          set({
            isGenerating: false,
            pendingPrompts: newPending,
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

      // Favorites
      toggleFavorite: async (imageId) => {
        try {
          const result = await api.toggleFavorite(imageId);
          const { favorites } = get();

          if (result.is_favorite) {
            set({ favorites: [...favorites, imageId] });
          } else {
            set({ favorites: favorites.filter((id) => id !== imageId) });
          }
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      batchFavorite: async (favorite) => {
        const { selectedIds } = get();
        if (selectedIds.size === 0) return;

        try {
          await api.batchFavorite(Array.from(selectedIds), favorite);
          await get().refreshData();

          const { favorites } = get();
          if (favorite) {
            set({ favorites: [...new Set([...favorites, ...selectedIds])] });
          } else {
            set({ favorites: favorites.filter((id) => !selectedIds.has(id)) });
          }
        } catch (error) {
          set({ error: (error as Error).message });
        }
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

      // Image notes
      updateImageNotes: async (imageId, notes, caption) => {
        try {
          await api.updateImageNotes(imageId, notes, caption);

          // Update local state
          const { prompts } = get();
          const updatedPrompts = prompts.map((p) => ({
            ...p,
            images: p.images.map((img) =>
              img.id === imageId ? { ...img, notes, caption: caption ?? img.caption } : img
            ),
          }));
          set({ prompts: updatedPrompts });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      // Templates
      createTemplate: async (data) => {
        try {
          await api.createTemplate(data);
          const templates = await api.fetchTemplates();
          set({ templates });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      deleteTemplate: async (id) => {
        try {
          await api.deleteTemplate(id);
          const templates = await api.fetchTemplates();
          set({ templates });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      useTemplate: async (id) => {
        try {
          await api.useTemplate(id);
          const { templates } = get();
          return templates.find((t) => t.id === id);
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

      viewCollection: (_id) => {
        // Set to view collection mode (virtual prompt)
        // TODO: Implement actual collection viewing with collection ID
        set({
          currentPromptId: null,
          currentImageIndex: 0,
          leftTab: 'collections',
        });
      },

      // Settings
      updateSettings: async (variationPrompt) => {
        try {
          const settings = await api.updateSettings(variationPrompt);
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

      // Sessions
      createSession: (name) => {
        const id = `session-${Date.now()}`;
        const session: Session = {
          id,
          name,
          notes: '',
          created_at: new Date().toISOString(),
        };

        set((state) => ({
          sessions: [session, ...state.sessions].slice(0, 5),
          currentSessionId: id,
          notes: '',
        }));
      },

      switchSession: (id) => {
        const { sessions, currentSessionId, notes } = get();

        // Save current session notes
        if (currentSessionId) {
          const updatedSessions = sessions.map((s) =>
            s.id === currentSessionId ? { ...s, notes } : s
          );
          set({ sessions: updatedSessions });
        }

        // Load new session
        const session = sessions.find((s) => s.id === id);
        if (session) {
          set({ currentSessionId: id, notes: session.notes });
        }
      },

      deleteSession: (id) => {
        const { sessions, currentSessionId } = get();
        const newSessions = sessions.filter((s) => s.id !== id);

        set({
          sessions: newSessions,
          currentSessionId: currentSessionId === id ? null : currentSessionId,
          notes: currentSessionId === id ? '' : get().notes,
        });
      },

      updateNotes: (notes) => {
        set({ notes });
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
        const { favorites } = get();
        const allImages = get().getAllImages();
        return allImages.filter((item) => favorites.includes(item.image.id));
      },

      isImageFavorite: (imageId) => {
        return get().favorites.includes(imageId);
      },
    }),
    {
      name: 'pageant-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        currentSessionId: state.currentSessionId,
        notes: state.notes,
      }),
    }
  )
);
