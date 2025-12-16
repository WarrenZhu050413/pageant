import type {
  Prompt,
  Template,
  Collection,
  Story,
  Settings,
  GenerateRequest,
  GenerateResponse,
  UploadResponse,
  ImageData,
  LikedAxes,
  DesignPreferences,
  DesignAxis,
  LibraryItem,
  LibraryItemType,
} from '../types';

const API_BASE = '/api';

async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `Request failed: ${response.status}`);
  }

  return response.json();
}

// Prompts
export async function fetchPrompts(): Promise<Prompt[]> {
  const response = await request<{ prompts: Prompt[] }>('/prompts');
  return response.prompts || [];
}

export async function fetchPrompt(id: string): Promise<Prompt> {
  return request<Prompt>(`/prompts/${id}`);
}

export async function deletePrompt(id: string): Promise<void> {
  await request(`/prompts/${id}`, { method: 'DELETE' });
}

// Generation
export async function generateImages(data: GenerateRequest): Promise<GenerateResponse> {
  return request<GenerateResponse>('/generate', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function iterateImage(imageId: string): Promise<GenerateResponse> {
  return request<GenerateResponse>(`/iterate/${imageId}`, {
    method: 'POST',
  });
}

// Images
export async function updateImageNotes(
  imageId: string,
  notes: string,
  caption?: string
): Promise<void> {
  await request(`/images/${imageId}/notes`, {
    method: 'PATCH',
    body: JSON.stringify({ notes, caption }),
  });
}

export async function deleteImage(imageId: string): Promise<void> {
  await request(`/images/${imageId}`, { method: 'DELETE' });
}

// Favorites
export async function fetchFavorites(): Promise<ImageData[]> {
  const response = await request<{ favorites: ImageData[] }>('/favorites');
  return response.favorites || [];
}

export async function toggleFavorite(imageId: string): Promise<{ is_favorite: boolean }> {
  return request<{ is_favorite: boolean }>('/favorites', {
    method: 'POST',
    body: JSON.stringify({ image_id: imageId }),
  });
}

// Batch operations
export async function batchDelete(imageIds: string[]): Promise<void> {
  await request('/batch/delete', {
    method: 'POST',
    body: JSON.stringify({ image_ids: imageIds }),
  });
}

export async function batchFavorite(
  imageIds: string[],
  favorite: boolean
): Promise<void> {
  await request('/batch/favorite', {
    method: 'POST',
    body: JSON.stringify({ image_ids: imageIds, favorite }),
  });
}

export async function batchDeletePrompts(
  promptIds: string[]
): Promise<{ deleted_ids: string[]; errors: string[] }> {
  return request('/batch/delete-prompts', {
    method: 'POST',
    body: JSON.stringify({ prompt_ids: promptIds }),
  });
}

// Templates
export async function fetchTemplates(): Promise<Template[]> {
  const response = await request<{ templates: Template[] }>('/templates');
  return response.templates || [];
}

export async function createTemplate(data: {
  name: string;
  prompt: string;
  category: string;
  tags: string[];
}): Promise<Template> {
  return request<Template>('/templates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteTemplate(id: string): Promise<void> {
  await request(`/templates/${id}`, { method: 'DELETE' });
}

export async function useTemplate(id: string): Promise<void> {
  await request(`/templates/${id}/use`, { method: 'POST' });
}

// Design Library
export async function fetchLibraryItems(): Promise<LibraryItem[]> {
  const response = await request<{ items: LibraryItem[] }>('/library');
  return response.items || [];
}

export async function createLibraryItem(data: {
  type: LibraryItemType;
  name: string;
  description?: string;
  text?: string;
  style_tags?: string[];
  prompt?: string;
  category?: string;
  tags?: string[];
}): Promise<LibraryItem> {
  const response = await request<{ item: LibraryItem }>('/library', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.item;
}

export async function deleteLibraryItem(id: string): Promise<void> {
  await request(`/library/${id}`, { method: 'DELETE' });
}

export async function useLibraryItem(id: string): Promise<LibraryItem> {
  const response = await request<{ item: LibraryItem }>(`/library/${id}/use`, { method: 'POST' });
  return response.item;
}

// Collections
export async function fetchCollections(): Promise<Collection[]> {
  const response = await request<{ collections: Collection[] }>('/collections');
  return response.collections || [];
}

export async function fetchCollection(id: string): Promise<Collection> {
  return request<Collection>(`/collections/${id}`);
}

export async function createCollection(data: {
  name: string;
  description?: string;
  image_ids: string[];
}): Promise<Collection> {
  return request<Collection>('/collections', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCollection(
  id: string,
  data: Partial<{ name: string; description: string; image_ids: string[] }>
): Promise<Collection> {
  return request<Collection>(`/collections/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function addToCollection(
  collectionId: string,
  imageIds: string[]
): Promise<void> {
  await request(`/collections/${collectionId}/images`, {
    method: 'POST',
    body: JSON.stringify({ image_ids: imageIds }),
  });
}

export async function removeFromCollection(
  collectionId: string,
  imageIds: string[]
): Promise<void> {
  await request(`/collections/${collectionId}/images`, {
    method: 'DELETE',
    body: JSON.stringify({ image_ids: imageIds }),
  });
}

export async function deleteCollection(id: string): Promise<void> {
  await request(`/collections/${id}`, { method: 'DELETE' });
}

// Stories
export async function fetchStories(): Promise<Story[]> {
  return request<Story[]>('/stories');
}

export async function fetchStory(id: string): Promise<Story> {
  return request<Story>(`/stories/${id}`);
}

export async function createStory(data: {
  title: string;
  description?: string;
}): Promise<Story> {
  return request<Story>('/stories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateStory(
  id: string,
  data: { title?: string; description?: string }
): Promise<Story> {
  return request<Story>(`/stories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteStory(id: string): Promise<void> {
  await request(`/stories/${id}`, { method: 'DELETE' });
}

// Settings
export async function fetchSettings(): Promise<Settings> {
  return request<Settings>('/settings');
}

export async function updateSettings(
  variationPrompt: string,
  iterationPrompt?: string
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('/settings', {
    method: 'PUT',
    body: JSON.stringify({
      variation_prompt: variationPrompt,
      iteration_prompt: iterationPrompt,
    }),
  });
}

// Upload
export async function uploadImages(files: File[]): Promise<UploadResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Upload failed');
  }

  return response.json();
}

// Export
export function getExportFavoritesUrl(): string {
  return `${API_BASE}/export/favorites`;
}

export function getExportGalleryUrl(): string {
  return `${API_BASE}/export/gallery`;
}

// Image URL helper
export function getImageUrl(imagePath: string): string {
  return `/images/${imagePath}`;
}

// Design Axis System
export async function updateDesignTags(
  imageId: string,
  tags: string[]
): Promise<{ id: string; design_tags: string[] }> {
  return request(`/images/${imageId}/design-tags`, {
    method: 'PATCH',
    body: JSON.stringify({ tags }),
  });
}

export async function toggleAxisLike(
  imageId: string,
  axis: DesignAxis,
  tag: string,
  liked: boolean
): Promise<{ id: string; liked_axes: LikedAxes }> {
  return request(`/images/${imageId}/like-axis`, {
    method: 'PATCH',
    body: JSON.stringify({ axis, tag, liked }),
  });
}

export async function fetchDesignPreferences(): Promise<{
  preferences: DesignPreferences;
  total_rated: number;
}> {
  return request('/preferences');
}

export async function resetDesignPreferences(): Promise<{
  success: boolean;
  cleared_count: number;
}> {
  return request('/preferences/reset', { method: 'POST' });
}

// Sessions
export interface SessionData {
  id: string;
  name: string;
  notes: string;
  created_at: string;
  prompt_count?: number;
}

export async function fetchSessions(): Promise<SessionData[]> {
  const response = await request<{ sessions: SessionData[] }>('/sessions');
  return response.sessions || [];
}

export async function createSession(data: {
  name: string;
  notes?: string;
}): Promise<SessionData> {
  const response = await request<{ session: SessionData }>('/sessions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.session;
}

export async function updateSession(
  id: string,
  data: { name?: string; notes?: string }
): Promise<SessionData> {
  const response = await request<{ session: SessionData }>(`/sessions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return response.session;
}

export async function deleteSession(
  id: string,
  deletePrompts: boolean = false
): Promise<void> {
  await request(`/sessions/${id}?delete_prompts=${deletePrompts}`, {
    method: 'DELETE',
  });
}

export async function fetchPromptsForSession(sessionId: string): Promise<Prompt[]> {
  const response = await request<{ prompts: Prompt[] }>(`/prompts?session_id=${sessionId}`);
  return response.prompts || [];
}

export async function addPromptsToSession(
  sessionId: string,
  promptIds: string[]
): Promise<void> {
  await request(`/sessions/${sessionId}/prompts`, {
    method: 'POST',
    body: JSON.stringify(promptIds),
  });
}

export async function removePromptsFromSession(
  sessionId: string,
  promptIds: string[]
): Promise<void> {
  await request(`/sessions/${sessionId}/prompts`, {
    method: 'DELETE',
    body: JSON.stringify(promptIds),
  });
}
