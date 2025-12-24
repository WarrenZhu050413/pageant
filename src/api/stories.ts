/**
 * Stories API
 *
 * CRUD operations for stories and chapters used in sequential/narrative generation.
 */

import type { Story, ChapterLayout, StoryDesignMomentum } from '../types';
import { makeListFetcher, request } from './fetchers';

// List all stories
export const fetchStories = makeListFetcher<Story>('/stories', 'stories');

// Get single story
export async function fetchStory(id: string): Promise<Story> {
  return request<Story>(`/stories/${id}`);
}

// Create story
export interface CreateStoryRequest {
  title: string;
  description?: string;
}

export async function createStory(data: CreateStoryRequest): Promise<Story> {
  return request<Story>('/stories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Update story
export interface UpdateStoryRequest {
  title?: string;
  description?: string;
  character_ids?: string[];
  design_momentum?: StoryDesignMomentum;
}

export async function updateStory(
  id: string,
  data: UpdateStoryRequest
): Promise<Story> {
  return request<Story>(`/stories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Delete story
export async function deleteStory(id: string): Promise<void> {
  await request(`/stories/${id}`, { method: 'DELETE' });
}

// Add chapter to story
export interface AddChapterRequest {
  title?: string;
  text?: string;
  image_ids?: string[];
  layout?: ChapterLayout;
}

export async function addChapter(
  storyId: string,
  data: AddChapterRequest
): Promise<Story> {
  return request<Story>(`/stories/${storyId}/chapters`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Update chapter
export async function updateChapter(
  storyId: string,
  chapterId: string,
  data: AddChapterRequest
): Promise<Story> {
  return request<Story>(`/stories/${storyId}/chapters/${chapterId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Delete chapter
export async function deleteChapter(
  storyId: string,
  chapterId: string
): Promise<void> {
  await request(`/stories/${storyId}/chapters/${chapterId}`, {
    method: 'DELETE',
  });
}

// Reorder chapters
export async function reorderChapters(
  storyId: string,
  chapterIds: string[]
): Promise<Story> {
  return request<Story>(`/stories/${storyId}/chapters/reorder`, {
    method: 'POST',
    body: JSON.stringify({ chapter_ids: chapterIds }),
  });
}
