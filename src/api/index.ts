import type {
  Prompt,
  Collection,
  Settings,
  GenerateRequest,
  GenerateResponse,
  UploadResponse,
  LikedAxes,
  DesignPreferences,
  DesignAxis,
  DesignDimension,
  DesignToken,
  GeneratePromptsRequest,
  GeneratePromptsResponse,
  GenerateFromPromptsRequest,
  PolishPromptsRequest,
  PolishPromptsResponse,
  AnalyzeDimensionsResponse,
  GenerateConceptResponse,
  SuggestDimensionsResponse,
  CreateTokenRequest,
  CreateTokenResponse,
  GenerateTokenConceptResponse,
} from '../types';
import {
  request,
  makeListFetcher,
  makeItemFetcher,
  makeDeleteFetcher,
} from './fetchers';

const API_BASE = '/api';

// Transform prompt from API snake_case to frontend camelCase
function transformPrompt(prompt: Prompt & { base_prompt?: string }): Prompt {
  const { base_prompt, ...rest } = prompt;
  return {
    ...rest,
    basePrompt: base_prompt || rest.basePrompt,
  };
}

// Prompts (with snake_case to camelCase transformation)
export async function fetchPrompts(): Promise<Prompt[]> {
  const response = await request<{ prompts: (Prompt & { base_prompt?: string })[] }>('/prompts');
  return (response.prompts || []).map(transformPrompt);
}
export async function fetchPrompt(id: string): Promise<Prompt> {
  const response = await request<Prompt & { base_prompt?: string }>(`/prompts/${id}`);
  return transformPrompt(response);
}
export const deletePrompt = makeDeleteFetcher('/prompts');

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

// Two-Phase Generation
export async function generatePromptVariations(
  data: GeneratePromptsRequest
): Promise<GeneratePromptsResponse> {
  return request<GeneratePromptsResponse>('/generate-prompts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Streaming prompt generation via Server-Sent Events
export interface StreamEvent {
  type: 'chunk' | 'complete' | 'error';
  text?: string;  // For chunk events
  success?: boolean;
  variations?: GeneratePromptsResponse['variations'];
  base_prompt?: string;
  generated_title?: string;
  annotation_suggestions?: GeneratePromptsResponse['annotation_suggestions'];
  error?: string;
}

export async function* generatePromptVariationsStream(
  data: GeneratePromptsRequest
): AsyncGenerator<StreamEvent> {
  const params = new URLSearchParams({
    prompt: data.prompt,
    count: String(data.count || 4),
  });
  if (data.title) params.append('title', data.title);
  if (data.context_image_ids?.length) {
    params.append('context_image_ids', data.context_image_ids.join(','));
  }

  const response = await fetch(`/api/generate-prompts/stream?${params}`);

  if (!response.ok) {
    yield { type: 'error', error: `HTTP ${response.status}` };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield { type: 'error', error: 'No response body' };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';  // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6)) as StreamEvent;
            yield event;
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function generateFromPrompts(
  data: GenerateFromPromptsRequest
): Promise<GenerateResponse> {
  return request<GenerateResponse>('/generate-images', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function polishPrompts(
  data: PolishPromptsRequest
): Promise<PolishPromptsResponse> {
  return request<PolishPromptsResponse>('/polish-prompts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Images
export async function updateImageNotes(
  imageId: string,
  notes: string,
  annotation?: string
): Promise<void> {
  await request(`/images/${imageId}/notes`, {
    method: 'PATCH',
    body: JSON.stringify({ notes, annotation }),
  });
}

export const deleteImage = makeDeleteFetcher('/images');

// Batch operations
export async function batchDelete(imageIds: string[]): Promise<void> {
  await request('/batch/delete', {
    method: 'POST',
    body: JSON.stringify({ image_ids: imageIds }),
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

// Design Tokens
export const fetchTokens = makeListFetcher<DesignToken>('/tokens', 'tokens');
export const deleteToken = makeDeleteFetcher('/tokens');

export async function createToken(data: CreateTokenRequest): Promise<DesignToken> {
  const response = await request<CreateTokenResponse>('/tokens', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!response.token) {
    throw new Error(response.error || 'Failed to create token');
  }
  return response.token;
}

export async function useToken(id: string): Promise<DesignToken> {
  const response = await request<{ token: DesignToken }>(`/tokens/${id}/use`, { method: 'POST' });
  return response.token;
}

export async function generateTokenConcept(
  tokenId: string,
  aspectRatio: string = '1:1'
): Promise<GenerateTokenConceptResponse> {
  return request<GenerateTokenConceptResponse>(`/tokens/${tokenId}/generate-concept`, {
    method: 'POST',
    body: JSON.stringify({ aspect_ratio: aspectRatio }),
  });
}

// Dimension Extraction (for Design Tokens)
export async function suggestDimensions(
  imageIds: string[],
  count: number = 5
): Promise<SuggestDimensionsResponse> {
  return request<SuggestDimensionsResponse>('/extract/suggest-dimensions', {
    method: 'POST',
    body: JSON.stringify({ image_ids: imageIds, count }),
  });
}

// Collections
export const fetchCollections = makeListFetcher<Collection>('/collections', 'collections');
export const fetchCollection = makeItemFetcher<Collection>('/collections');

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

export const deleteCollection = makeDeleteFetcher('/collections');

// Settings
export const fetchSettings = makeItemFetcher<Settings>('/settings');

export async function fetchDefaultSettings(): Promise<{
  variation_prompt: string;
  iteration_prompt: string;
}> {
  return request<{ variation_prompt: string; iteration_prompt: string }>('/settings/defaults');
}

export async function updateSettings(settings: {
  variation_prompt: string;
  iteration_prompt?: string;
  image_size?: string;
  aspect_ratio?: string;
  seed?: number;
  safety_level?: string;
}): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
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

export async function toggleDimensionLike(
  imageId: string,
  axis: string,
  liked: boolean
): Promise<{ success: boolean; liked_dimension_axes: string[] }> {
  return request(`/images/${imageId}/like-dimension`, {
    method: 'PATCH',
    body: JSON.stringify({ axis, liked }),
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

// Design Dimension Analysis
export async function analyzeDimensions(
  imageId: string,
  count: number = 5
): Promise<AnalyzeDimensionsResponse> {
  return request<AnalyzeDimensionsResponse>('/analyze-dimensions', {
    method: 'POST',
    body: JSON.stringify({ image_id: imageId, count }),
  });
}

export async function generateConcept(
  imageId: string,
  dimension: DesignDimension,
  aspectRatio: string = '1:1'
): Promise<GenerateConceptResponse> {
  return request<GenerateConceptResponse>('/generate-concept', {
    method: 'POST',
    body: JSON.stringify({
      image_id: imageId,
      dimension,
      aspect_ratio: aspectRatio,
    }),
  });
}

export async function updateImageDimensions(
  imageId: string,
  dimensions: Record<string, DesignDimension>
): Promise<{ id: string; design_dimensions: Record<string, DesignDimension> }> {
  return request(`/images/${imageId}/dimensions`, {
    method: 'PATCH',
    body: JSON.stringify({ dimensions }),
  });
}

export async function confirmDimension(
  imageId: string,
  axis: string,
  dimensions: Record<string, DesignDimension>
): Promise<{ id: string; design_dimensions: Record<string, DesignDimension> }> {
  // Update the specific dimension to set confirmed: true
  const updated = { ...dimensions };
  if (updated[axis]) {
    updated[axis] = { ...updated[axis], confirmed: true };
  }
  return updateImageDimensions(imageId, updated);
}

// Sessions
export interface SessionData {
  id: string;
  name: string;
  notes: string;
  created_at: string;
  prompt_count?: number;
}

export const fetchSessions = makeListFetcher<SessionData>('/sessions', 'sessions');

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
  const response = await request<{ prompts: (Prompt & { base_prompt?: string })[] }>(`/prompts?session_id=${sessionId}`);
  return (response.prompts || []).map(transformPrompt);
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

