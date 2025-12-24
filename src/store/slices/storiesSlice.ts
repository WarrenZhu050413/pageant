import type { StateCreator } from 'zustand';
import type { Story } from '../../types';

export interface StoriesSlice {
  // State
  stories: Story[];
  currentStoryId: string | null;
  currentChapterId: string | null;

  // Actions (state-only, no API calls - those remain in main store)
  setStories: (stories: Story[]) => void;
  setCurrentStory: (id: string | null) => void;
  setCurrentChapter: (id: string | null) => void;
}

export const createStoriesSlice: StateCreator<StoriesSlice> = (set) => ({
  // Initial state
  stories: [],
  currentStoryId: null,
  currentChapterId: null,

  // Actions
  setStories: (stories) => set({ stories }),
  setCurrentStory: (id) => set({ currentStoryId: id }),
  setCurrentChapter: (id) => set({ currentChapterId: id }),
});
