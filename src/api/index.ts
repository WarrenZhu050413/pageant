/**
 * API Layer - Translation between frontend and backend terminology
 *
 * NAMING CONVENTION:
 * - Frontend (store/components): uses "Generation" (e.g., generations, currentGenerationId)
 * - Backend (server.py): uses "Prompt" (e.g., /api/prompts, metadata["prompts"])
 * - This API layer bridges the two, using backend's "prompts" endpoints
 *
 * The `Prompt` type is a legacy alias for `Generation` in src/types/index.ts.
 * Functions like fetchPrompts() return data that the store treats as Generation[].
 */
import type {
  Prompt,
  Collection,
  Settings,
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
  CreateTokenRequest,
  CreateTokenResponse,
  GenerateTokenConceptResponse,
  DraftPrompt,
  PromptVariation,
  ImageGenerationParams,
  AnnotationSuggestion,
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
  type: 'chunk' | 'complete' | 'error' | 'partial_variation';
  text?: string;  // For chunk events
  success?: boolean;
  variations?: GeneratePromptsResponse['variations'];
  base_prompt?: string;
  generated_title?: string;
  annotation_suggestions?: GeneratePromptsResponse['annotation_suggestions'];
  error?: string;
  // For partial_variation events - a single variation parsed from streaming JSON
  partialVariation?: GeneratePromptsResponse['variations'][0];
  partialIndex?: number;  // Which variation index (0-based)
}

/**
 * Try to extract complete scene objects from partial JSON.
 * Returns array of parsed scenes and the remaining unparsed text.
 */
function extractCompleteScenesFromPartialJson(
  accumulatedText: string,
  alreadyParsedCount: number
): { scenes: GeneratePromptsResponse['variations']; title?: string } {
  const scenes: GeneratePromptsResponse['variations'] = [];
  let title: string | undefined;

  // Try to extract the title first
  const titleMatch = accumulatedText.match(/"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
  if (titleMatch) {
    title = titleMatch[1];
  }

  // Find the scenes array start
  const scenesStart = accumulatedText.indexOf('"scenes"');
  if (scenesStart === -1) return { scenes, title };

  const arrayStart = accumulatedText.indexOf('[', scenesStart);
  if (arrayStart === -1) return { scenes, title };

  // Extract content after the array start
  const afterArrayStart = accumulatedText.slice(arrayStart + 1);

  // Use bracket counting to find complete objects, properly handling strings
  let depth = 0;
  let objectStart = -1;
  let sceneIndex = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < afterArrayStart.length; i++) {
    const char = afterArrayStart[i];

    // Handle escape sequences inside strings
    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\' && inString) {
      escapeNext = true;
      continue;
    }

    // Toggle string mode on unescaped quotes
    if (char === '"') {
      inString = !inString;
      continue;
    }

    // Only count braces when NOT inside a string
    if (!inString) {
      if (char === '{') {
        if (depth === 0) {
          objectStart = i;
        }
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0 && objectStart !== -1) {
          // Found a complete object
          if (sceneIndex >= alreadyParsedCount) {
            const objectStr = afterArrayStart.slice(objectStart, i + 1);
            try {
              const scene = JSON.parse(objectStr);
              // Convert backend schema to frontend schema
              scenes.push({
                id: scene.id || String(sceneIndex + 1),
                text: scene.description || '',
                title: scene.title || '',
                mood: scene.mood || '',
                type: scene.type || '',
                design: scene.design || {},
                design_dimensions: scene.design_dimensions || [],
                recommended_context_ids: scene.recommended_context_ids || [],
                context_reasoning: scene.context_reasoning || '',
              });
            } catch {
              // Incomplete or malformed JSON, skip
            }
          }
          sceneIndex++;
          objectStart = -1;
        }
      }
    }
  }

  return { scenes, title };
}

export async function* generatePromptVariationsStream(
  data: GeneratePromptsRequest
): AsyncGenerator<StreamEvent> {
  // Use POST with JSON body to avoid URL length limits (431 errors)
  const response = await fetch('/api/generate-prompts/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: data.prompt,
      count: data.count || 4,
      context_image_ids: data.context_image_ids || [],
    }),
  });

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
  // Track accumulated JSON text and already-yielded variations for incremental parsing
  let accumulatedJsonText = '';
  let yieldedVariationCount = 0;
  let yieldedTitle: string | undefined;

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

            // For chunk events, try to extract complete variations incrementally
            if (event.type === 'chunk' && event.text) {
              accumulatedJsonText += event.text;

              // Try to extract newly complete scenes
              const { scenes, title } = extractCompleteScenesFromPartialJson(
                accumulatedJsonText,
                yieldedVariationCount
              );

              // Yield title if we got it and haven't yielded it yet
              if (title && !yieldedTitle) {
                yieldedTitle = title;
              }

              // Yield each new complete variation
              for (const scene of scenes) {
                yield {
                  type: 'partial_variation',
                  partialVariation: scene,
                  partialIndex: yieldedVariationCount,
                  generated_title: yieldedTitle,
                };
                yieldedVariationCount++;
              }
            }

            // Always yield the original event too
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

export async function batchDownload(imageIds: string[]): Promise<void> {
  const response = await fetch('/api/batch/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_ids: imageIds }),
  });

  if (!response.ok) {
    throw new Error('Failed to download images');
  }

  // Get the blob and trigger download
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  // Extract filename from Content-Disposition header or use default
  const contentDisposition = response.headers.get('Content-Disposition');
  const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/);
  const filename = filenameMatch ? filenameMatch[1] : 'pageant-images.zip';

  // Create a link and click it to trigger download
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Hide/Unhide generations
export async function hideGenerations(promptIds: string[]): Promise<{ success: boolean; hidden: string[] }> {
  return request('/prompts/hide', {
    method: 'POST',
    body: JSON.stringify({ prompt_ids: promptIds }),
  });
}

export async function unhideGenerations(promptIds: string[]): Promise<{ success: boolean; unhidden: string[] }> {
  return request('/prompts/unhide', {
    method: 'POST',
    body: JSON.stringify({ prompt_ids: promptIds }),
  });
}

// Move generation between sessions
export async function moveGenerationToSession(
  promptId: string,
  sessionId: string | null
): Promise<{ success: boolean; prompt_id: string; session_id: string | null }> {
  return request(`/prompts/${promptId}/session`, {
    method: 'PATCH',
    body: JSON.stringify({ session_id: sessionId }),
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
  prompt: string,
  aspectRatio: string = '1:1'
): Promise<GenerateTokenConceptResponse> {
  return request<GenerateTokenConceptResponse>(`/tokens/${tokenId}/generate-concept`, {
    method: 'POST',
    body: JSON.stringify({ prompt, aspect_ratio: aspectRatio }),
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

export async function updateSettings(settings: {
  image_size?: string;
  aspect_ratio?: string;
  seed?: number;
  safety_level?: string;
  thinking_level?: string;
  temperature?: number;
  google_search_grounding?: boolean;
}): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

// Open folder in system file explorer
export async function openImagesFolder(): Promise<{
  success: boolean;
  path: string;
  opened: boolean;
  message?: string;
}> {
  return request<{
    success: boolean;
    path: string;
    opened: boolean;
    message?: string;
  }>('/open-folder', {
    method: 'POST',
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

// =============================================================================
// Semantic Search API
// =============================================================================

export interface SearchResult {
  id: string;
  image_path: string;
  prompt_id: string;
  score: number; // 0-1 similarity score
}

export interface SearchResponse {
  success: boolean;
  results: SearchResult[];
  error?: string;
}

/**
 * Search images using semantic embeddings.
 */
export async function searchImages(
  query: string,
  limit: number = 50
): Promise<SearchResponse> {
  return request<SearchResponse>('/search', {
    method: 'POST',
    body: JSON.stringify({ query, limit, mode: 'semantic' }),
  });
}

/**
 * Find images similar to a given image (image-to-image search).
 */
export async function findSimilarImages(
  imageId: string,
  limit: number = 20
): Promise<SearchResponse> {
  return request<SearchResponse>(`/search/similar/${imageId}?limit=${limit}`);
}

/**
 * Get all indexed image IDs for status indicator.
 */
export async function getIndexedImageIds(): Promise<{
  success: boolean;
  indexed_ids: string[];
  error?: string;
}> {
  return request('/search/indexed');
}

/**
 * Trigger indexing for specific images or all missing images.
 */
export async function triggerIndexing(imageIds?: string[]): Promise<{
  success: boolean;
  queued: number;
  error?: string;
}> {
  return request('/search/index', {
    method: 'POST',
    body: JSON.stringify({ image_ids: imageIds }),
  });
}

/**
 * Get search index statistics.
 */
export async function getSearchStats(): Promise<{
  success: boolean;
  indexed_count?: number;
  embedding_dim?: number;
  pending_count?: number;
  indexer_running?: boolean;
  error?: string;
}> {
  return request('/search/stats');
}

// =============================================================================
// Prompt Engineering Workspace
// =============================================================================

export interface PEOption {
  label: string;
  description: string;
}

export interface PEQuestion {
  question: string;
  header: string;
  options: PEOption[];
  multiSelect: boolean;
}

export interface PERound {
  questions: PEQuestion[];
  answers: Record<string, string | string[]>;
  optimized_prompt: string;
}

export interface PEGenerateQuestionsRequest {
  prompt: string;
  context_image_ids?: string[];
  history?: PERound[];
}

export interface PEGenerateQuestionsResponse {
  success: boolean;
  questions: PEQuestion[];
  error?: string;
}

export interface PEOptimizeRequest {
  prompt: string;
  questions: PEQuestion[];
  answers: Record<string, string | string[]>;
  context_image_ids?: string[];
  history?: PERound[];
}

export interface PEOptimizeResponse {
  success: boolean;
  optimized_prompt: string;
  prompt_summary: Record<string, string>;  // e.g. {"Style": "Photorealistic", "Lighting": "Golden Hour"}
  error?: string;
}

/**
 * Generate clarifying questions for a prompt.
 * Uses Gemini Flash to analyze the prompt and suggest targeted questions.
 */
export async function peGenerateQuestions(
  data: PEGenerateQuestionsRequest
): Promise<PEGenerateQuestionsResponse> {
  return request<PEGenerateQuestionsResponse>('/pe/questions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Optimize a prompt based on user's answers to questions.
 */
export async function peOptimizePrompt(
  data: PEOptimizeRequest
): Promise<PEOptimizeResponse> {
  return request<PEOptimizeResponse>('/pe/optimize', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// =============================================================================
// Image Analysis & Enhancement (for uploaded images)
// =============================================================================

export interface AnalyzeImagesResponse {
  success: boolean;
  analyzed: Array<{
    id: string;
    design_dimensions: Record<string, DesignDimension>;
    annotation: string;
  }>;
  errors: Array<{
    id: string;
    error: string;
  }>;
}

export interface EnhanceImageResponse {
  success: boolean;
  prompt_id: string;
  image: {
    id: string;
    image_path: string;
    mime_type: string;
    created_at: string;
    notes?: string;
    source_image_id?: string;
    design_dimensions?: Record<string, DesignDimension>;
    annotation?: string;
  };
}

/**
 * Analyze uploaded images to extract design dimensions and annotations.
 * Sends each image to Gemini for analysis.
 */
export async function analyzeUploadedImages(
  imageIds: string[]
): Promise<AnalyzeImagesResponse> {
  return request<AnalyzeImagesResponse>('/analyze-uploaded-images', {
    method: 'POST',
    body: JSON.stringify({ image_ids: imageIds }),
  });
}

/**
 * Enhance an image with professional photoshop-style improvements.
 * Creates a new image that is a polished, retouched version of the original.
 */
export async function enhanceImage(
  imageId: string
): Promise<EnhanceImageResponse> {
  return request<EnhanceImageResponse>('/enhance-image', {
    method: 'POST',
    body: JSON.stringify({ image_id: imageId }),
  });
}

export interface EnhanceImagesResponse {
  success: boolean;
  prompt_id: string;
  images: Array<{
    id: string;
    image_path: string;
    mime_type: string;
    created_at: string;
    notes?: string;
    source_image_id?: string;
    design_dimensions?: Record<string, DesignDimension>;
    annotation?: string;
  }>;
  total_requested: number;
  total_enhanced: number;
}

/**
 * Batch enhance multiple images with professional retouching.
 * All enhanced images are grouped into a single "Enhanced Uploaded Images" generation.
 */
export async function enhanceImages(
  imageIds: string[]
): Promise<EnhanceImagesResponse> {
  return request<EnhanceImagesResponse>('/enhance-images', {
    method: 'POST',
    body: JSON.stringify({ image_ids: imageIds }),
  });
}

// =============================================================================
// Draft Prompts (Server-side persistence)
// =============================================================================

// Transform draft variation from API snake_case to frontend camelCase
function transformDraftVariation(v: PromptVariation & {
  recommended_context_ids?: string[];
  context_reasoning?: string;
  user_notes?: string;
  is_edited?: boolean;
  emphasized_tags?: string[];
  design_dimensions?: PromptVariation['design_dimensions'];
}): PromptVariation {
  return {
    id: v.id,
    text: v.text,
    title: v.title,
    mood: v.mood,
    type: v.type,
    design: v.design,
    design_dimensions: v.design_dimensions,
    recommended_context_ids: v.recommended_context_ids,
    context_reasoning: v.context_reasoning,
    userNotes: v.user_notes || v.userNotes,
    isEdited: v.is_edited ?? v.isEdited,
    emphasizedTags: v.emphasized_tags || v.emphasizedTags,
  };
}

// Transform draft from API snake_case to frontend camelCase
function transformDraft(draft: DraftPrompt & {
  base_prompt?: string;
  created_at?: string;
  image_params?: ImageGenerationParams;
  context_image_ids?: string[];
  annotation_suggestions?: AnnotationSuggestion[];
  is_generating?: boolean;
  auto_generate?: boolean;
  explore_ratio?: number;
}): DraftPrompt {
  return {
    id: draft.id,
    basePrompt: draft.base_prompt || draft.basePrompt,
    title: draft.title,
    variations: (draft.variations || []).map(transformDraftVariation),
    createdAt: draft.created_at || draft.createdAt,
    imageParams: draft.image_params || draft.imageParams,
    contextImageIds: draft.context_image_ids || draft.contextImageIds,
    annotationSuggestions: draft.annotation_suggestions || draft.annotationSuggestions,
    isGenerating: draft.is_generating ?? draft.isGenerating,
    autoGenerate: draft.auto_generate ?? draft.autoGenerate,
    exploreRatio: draft.explore_ratio ?? draft.exploreRatio,
  };
}

// Transform draft to API snake_case for sending
function toDraftApiFormat(draft: Partial<DraftPrompt>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (draft.basePrompt !== undefined) result.base_prompt = draft.basePrompt;
  if (draft.title !== undefined) result.title = draft.title;
  if (draft.createdAt !== undefined) result.created_at = draft.createdAt;
  if (draft.imageParams !== undefined) result.image_params = draft.imageParams;
  if (draft.contextImageIds !== undefined) result.context_image_ids = draft.contextImageIds;
  if (draft.annotationSuggestions !== undefined) result.annotation_suggestions = draft.annotationSuggestions;
  if (draft.isGenerating !== undefined) result.is_generating = draft.isGenerating;
  if (draft.autoGenerate !== undefined) result.auto_generate = draft.autoGenerate;
  if (draft.exploreRatio !== undefined) result.explore_ratio = draft.exploreRatio;

  if (draft.variations !== undefined) {
    result.variations = draft.variations.map(v => ({
      id: v.id,
      text: v.text,
      title: v.title,
      mood: v.mood,
      type: v.type,
      design: v.design,
      design_dimensions: v.design_dimensions,
      recommended_context_ids: v.recommended_context_ids,
      context_reasoning: v.context_reasoning,
      user_notes: v.userNotes,
      is_edited: v.isEdited,
      emphasized_tags: v.emphasizedTags,
    }));
  }

  return result;
}

/**
 * Fetch all drafts from server.
 */
export async function fetchDrafts(): Promise<DraftPrompt[]> {
  const response = await request<{ drafts: DraftPrompt[] }>('/drafts');
  return (response.drafts || []).map(transformDraft);
}

/**
 * Create a new draft on server.
 */
export async function createDraft(
  draft: Omit<DraftPrompt, 'id'>
): Promise<DraftPrompt> {
  const response = await request<{ draft: DraftPrompt }>('/drafts', {
    method: 'POST',
    body: JSON.stringify(toDraftApiFormat(draft)),
  });
  return transformDraft(response.draft);
}

/**
 * Update an existing draft on server.
 */
export async function updateDraft(
  id: string,
  draft: Partial<DraftPrompt>
): Promise<DraftPrompt> {
  const response = await request<{ draft: DraftPrompt }>(`/drafts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(toDraftApiFormat(draft)),
  });
  return transformDraft(response.draft);
}

/**
 * Delete a draft from server.
 */
export async function deleteDraft(id: string): Promise<void> {
  await request(`/drafts/${id}`, { method: 'DELETE' });
}

