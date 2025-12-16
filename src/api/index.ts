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
  variationPrompt: string
): Promise<Settings> {
  return request<Settings>('/settings', {
    method: 'PUT',
    body: JSON.stringify({ variation_prompt: variationPrompt }),
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
